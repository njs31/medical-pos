import { getDb } from './db.js';

const COMPARE_FIELDS = [
  'name',
  'pack',
  'hsn_code',
  'batch',
  'expiry',
  'mrp',
  'rate',
  'purchase_rate',
  'sgst_percent',
  'cgst_percent',
  'stock_qty',
  'reorder_level',
  'tablets_per_sheet',
  'supplier_name',
  'item_category',
  'rack_number',
  'product_type',
  'combination',
];

const SELECT_COLUMNS_SQL = `
  SELECT
    id, name, pack, hsn_code, batch, expiry, mrp, rate, purchase_rate,
    sgst_percent, cgst_percent, stock_qty, reorder_level, tablets_per_sheet,
    created_at, supplier_name, item_category, rack_number, product_type, combination
  FROM medicines
  ORDER BY id ASC
`;

const MAX_DELTA_DEPTH = 50;

function captureMedicinesSnapshot(database = getDb()) {
  return database.prepare(SELECT_COLUMNS_SQL).all();
}

function valuesEqual(a, b) {
  if (a == null && b == null) return true;
  if (typeof a === 'number' || typeof b === 'number') {
    return Number(a || 0) === Number(b || 0);
  }
  return String(a ?? '') === String(b ?? '');
}

function summarizeMedicine(row) {
  return {
    id: row.id,
    name: row.name,
    batch: row.batch || '',
    expiry: row.expiry || '',
    stock_qty: Number(row.stock_qty || 0),
    mrp: Number(row.mrp || 0),
    purchase_rate: Number(row.purchase_rate || 0),
    rack_number: row.rack_number || '',
    item_category: row.item_category || 'Medicine',
    supplier_name: row.supplier_name || '',
  };
}

export function diffSnapshots(before = [], after = []) {
  const beforeMap = new Map(before.map((row) => [row.id, row]));
  const afterMap = new Map(after.map((row) => [row.id, row]));

  const added = [];
  const removed = [];
  const changed = [];

  for (const [id, row] of afterMap) {
    if (!beforeMap.has(id)) {
      added.push(summarizeMedicine(row));
      continue;
    }
    const prev = beforeMap.get(id);
    const fieldChanges = {};
    let hasChange = false;
    for (const field of COMPARE_FIELDS) {
      if (!valuesEqual(prev[field], row[field])) {
        fieldChanges[field] = { from: prev[field], to: row[field] };
        hasChange = true;
      }
    }
    if (hasChange) {
      changed.push({
        ...summarizeMedicine(row),
        changes: fieldChanges,
      });
    }
  }

  for (const [id, row] of beforeMap) {
    if (!afterMap.has(id)) {
      removed.push(summarizeMedicine(row));
    }
  }

  return { added, removed, changed };
}

function hasDiff(diff) {
  return diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;
}

/**
 * Resolves full snapshot array for any checkpoint ID (handling legacy full arrays or delta objects).
 */
export function resolveSnapshot(id, database = getDb()) {
  const checkStmt = database.prepare('SELECT id, snapshot_json FROM stock_checkpoints WHERE id = ?');
  const chain = [];
  let currentId = id;

  while (currentId) {
    const row = checkStmt.get(currentId);
    if (!row) break;

    let parsed;
    try {
      parsed = JSON.parse(row.snapshot_json || '[]');
    } catch {
      break;
    }

    if (Array.isArray(parsed)) {
      // Reached base full snapshot
      let snapshotMap = new Map(parsed.map((item) => [item.id, { ...item }]));

      // Apply deltas in chronological order
      for (let i = chain.length - 1; i >= 0; i--) {
        const delta = chain[i];
        if (!delta || !delta.diff) continue;

        // 1. Remove deleted items
        if (Array.isArray(delta.diff.removed)) {
          for (const rem of delta.diff.removed) {
            snapshotMap.delete(rem.id);
          }
        }

        // 2. Apply field changes
        if (Array.isArray(delta.diff.changed)) {
          for (const chg of delta.diff.changed) {
            const existing = snapshotMap.get(chg.id);
            if (existing && chg.changes) {
              for (const [field, change] of Object.entries(chg.changes)) {
                existing[field] = change.to;
              }
            }
          }
        }

        // 3. Add new items (if full row data present in delta or after snapshot)
        if (Array.isArray(delta.diff.added)) {
          for (const add of delta.diff.added) {
            if (!snapshotMap.has(add.id)) {
              snapshotMap.set(add.id, { ...add });
            }
          }
        }
      }

      return Array.from(snapshotMap.values());
    } else if (parsed && parsed.__delta && parsed.base_id) {
      chain.push(parsed);
      currentId = parsed.base_id;
    } else {
      break;
    }
  }

  return [];
}

function getDeltaDepth(prevId, database = getDb()) {
  let depth = 0;
  let currentId = prevId;
  const stmt = database.prepare('SELECT id, snapshot_json FROM stock_checkpoints WHERE id = ?');

  while (currentId && depth <= MAX_DELTA_DEPTH) {
    const row = stmt.get(currentId);
    if (!row) break;
    try {
      const parsed = JSON.parse(row.snapshot_json || '[]');
      if (Array.isArray(parsed)) break;
      if (parsed && parsed.__delta && parsed.base_id) {
        depth++;
        currentId = parsed.base_id;
      } else {
        break;
      }
    } catch {
      break;
    }
  }
  return depth;
}

function insertCheckpoint(before, after, message, source) {
  const database = getDb();
  const diff = diffSnapshots(before, after);
  if (!hasDiff(diff) && source !== 'manual') {
    return null;
  }

  const prev = database
    .prepare('SELECT id, snapshot_json FROM stock_checkpoints ORDER BY id DESC LIMIT 1')
    .get();

  let snapshotStorage;
  const isSpecialSource = source === 'manual' || source === 'restore';
  const depth = prev ? getDeltaDepth(prev.id, database) : 0;

  // Use lightweight delta encoding for auto checkpoints when depth < MAX_DELTA_DEPTH
  if (prev && !isSpecialSource && depth < MAX_DELTA_DEPTH) {
    snapshotStorage = JSON.stringify({
      __delta: true,
      base_id: prev.id,
      diff,
    });
  } else {
    // Store periodic or manual full snapshot
    snapshotStorage = JSON.stringify(after);
  }

  const info = database
    .prepare(
      `
      INSERT INTO stock_checkpoints (
        message, source, added_count, removed_count, changed_count,
        snapshot_json, diff_json, created_at
      ) VALUES (
        @message, @source, @added_count, @removed_count, @changed_count,
        @snapshot_json, @diff_json, datetime('now', 'localtime')
      )
    `,
    )
    .run({
      message: String(message || 'Stock update').slice(0, 500),
      source: String(source || 'system').slice(0, 64),
      added_count: diff.added.length,
      removed_count: diff.removed.length,
      changed_count: diff.changed.length,
      snapshot_json: snapshotStorage,
      diff_json: JSON.stringify(diff),
    });

  // Keep database light: automatically prune old automatic checkpoints beyond 1000 records
  pruneAutoCheckpoints(database);

  return getStockCheckpointById(info.lastInsertRowid);
}

export function runWithStockCheckpoint(message, source, fn) {
  const database = getDb();
  const before = captureMedicinesSnapshot(database);
  const result = fn();
  const after = captureMedicinesSnapshot(database);
  insertCheckpoint(before, after, message, source);
  return result;
}

export function createManualStockCheckpoint(message = 'Manual checkpoint') {
  const database = getDb();
  const snapshot = captureMedicinesSnapshot(database);
  const previous = database
    .prepare('SELECT id FROM stock_checkpoints ORDER BY id DESC LIMIT 1')
    .get();
  const before = previous ? resolveSnapshot(previous.id, database) : [];
  const checkpoint = insertCheckpoint(before, snapshot, message, 'manual');
  if (checkpoint) return checkpoint;

  const info = database
    .prepare(
      `
      INSERT INTO stock_checkpoints (
        message, source, added_count, removed_count, changed_count,
        snapshot_json, diff_json, created_at
      ) VALUES (
        @message, 'manual', 0, 0, 0,
        @snapshot_json, @diff_json, datetime('now', 'localtime')
      )
    `,
    )
    .run({
      message: String(message || 'Manual checkpoint').slice(0, 500),
      snapshot_json: JSON.stringify(snapshot),
      diff_json: JSON.stringify({ added: [], removed: [], changed: [] }),
    });

  return getStockCheckpointById(info.lastInsertRowid);
}

export function listStockCheckpoints(limit = 200) {
  return getDb()
    .prepare(
      `
      SELECT
        id, message, source, added_count, removed_count, changed_count, created_at
      FROM stock_checkpoints
      ORDER BY id DESC
      LIMIT ?
    `,
    )
    .all(Math.min(Math.max(Number(limit) || 200, 1), 500));
}

export function getStockCheckpointById(id) {
  const row = getDb()
    .prepare('SELECT * FROM stock_checkpoints WHERE id = ?')
    .get(id);
  if (!row) return null;

  let diff = { added: [], removed: [], changed: [] };
  try {
    diff = JSON.parse(row.diff_json || '{}');
  } catch {
    diff = { added: [], removed: [], changed: [] };
  }

  return {
    id: row.id,
    message: row.message,
    source: row.source,
    added_count: row.added_count,
    removed_count: row.removed_count,
    changed_count: row.changed_count,
    created_at: row.created_at,
    diff: {
      added: Array.isArray(diff.added) ? diff.added : [],
      removed: Array.isArray(diff.removed) ? diff.removed : [],
      changed: Array.isArray(diff.changed) ? diff.changed : [],
    },
  };
}

export function restoreStockCheckpoint(id) {
  const database = getDb();
  const row = database
    .prepare('SELECT id, message FROM stock_checkpoints WHERE id = ?')
    .get(id);
  if (!row) {
    throw new Error('Checkpoint not found');
  }

  const snapshot = resolveSnapshot(id, database);
  if (!Array.isArray(snapshot)) {
    throw new Error('Checkpoint snapshot is invalid');
  }

  return runWithStockCheckpoint(
    `Restored to checkpoint #${row.id}${row.message ? ` — ${row.message}` : ''}`,
    'restore',
    () => {
      database.pragma('foreign_keys = OFF');
      try {
        const insertStmt = database.prepare(`
          INSERT INTO medicines (
            id, name, pack, hsn_code, batch, expiry, mrp, rate, purchase_rate,
            sgst_percent, cgst_percent, stock_qty, reorder_level, tablets_per_sheet,
            created_at, supplier_name, item_category, rack_number, product_type, combination
          ) VALUES (
            @id, @name, @pack, @hsn_code, @batch, @expiry, @mrp, @rate, @purchase_rate,
            @sgst_percent, @cgst_percent, @stock_qty, @reorder_level, @tablets_per_sheet,
            @created_at, @supplier_name, @item_category, @rack_number, @product_type, @combination
          )
        `);

        const tx = database.transaction(() => {
          database.prepare('DELETE FROM medicines').run();
          for (const item of snapshot) {
            insertStmt.run({
              id: item.id,
              name: item.name,
              pack: item.pack ?? '',
              hsn_code: item.hsn_code ?? '',
              batch: item.batch ?? '',
              expiry: item.expiry ?? '',
              mrp: Number(item.mrp || 0),
              rate: Number(item.rate || 0),
              purchase_rate: Number(item.purchase_rate || 0),
              sgst_percent: Number(item.sgst_percent || 0),
              cgst_percent: Number(item.cgst_percent || 0),
              stock_qty: Number(item.stock_qty || 0),
              reorder_level: Number(item.reorder_level || 0),
              tablets_per_sheet: Number(item.tablets_per_sheet || 0),
              created_at: item.created_at || new Date().toISOString(),
              supplier_name: item.supplier_name ?? '',
              item_category: item.item_category || 'Medicine',
              rack_number: item.rack_number ?? '',
              product_type: item.product_type || 'Ethical',
              combination: item.combination ?? '',
            });
          }
          const maxId = snapshot.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
          try {
            database.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run('medicines');
            if (maxId > 0) {
              database.prepare('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)').run('medicines', maxId);
            }
          } catch {
            // sqlite_sequence may not exist yet on empty DBs; ignore.
          }
        });
        tx();
      } finally {
        database.pragma('foreign_keys = ON');
      }
      return { success: true, restored_id: row.id, item_count: snapshot.length };
    },
  );
}

/**
 * Periodically prunes old automatic checkpoints beyond 1000 while preserving all manual and restore checkpoints.
 */
function pruneAutoCheckpoints(database = getDb(), keepAutoLimit = 1000) {
  try {
    const autoCount = database
      .prepare("SELECT COUNT(*) as count FROM stock_checkpoints WHERE source NOT IN ('manual', 'restore')")
      .get()?.count || 0;

    if (autoCount > keepAutoLimit + 100) {
      database
        .prepare(`
          DELETE FROM stock_checkpoints
          WHERE id IN (
            SELECT id FROM stock_checkpoints
            WHERE source NOT IN ('manual', 'restore')
            ORDER BY id ASC
            LIMIT ?
          )
        `)
        .run(autoCount - keepAutoLimit);
    }
  } catch {
    // Ignore pruning errors if DB is locked
  }
}

