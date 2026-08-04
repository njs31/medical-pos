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

function captureMedicinesSnapshot(database = getDb()) {
  return database.prepare('SELECT * FROM medicines ORDER BY id ASC').all();
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

function insertCheckpoint(before, after, message, source) {
  const diff = diffSnapshots(before, after);
  if (!hasDiff(diff) && source !== 'manual') {
    return null;
  }

  const info = getDb()
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
      snapshot_json: JSON.stringify(after),
      diff_json: JSON.stringify(diff),
    });

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
  const snapshot = captureMedicinesSnapshot();
  const previous = getDb()
    .prepare('SELECT snapshot_json FROM stock_checkpoints ORDER BY id DESC LIMIT 1')
    .get();
  const before = previous ? JSON.parse(previous.snapshot_json || '[]') : [];
  const checkpoint = insertCheckpoint(before, snapshot, message, 'manual');
  if (checkpoint) return checkpoint;

  // Force a manual marker even when inventory is unchanged vs last checkpoint.
  const info = getDb()
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

function insertMedicineRow(database, row) {
  database
    .prepare(
      `
      INSERT INTO medicines (
        id, name, pack, hsn_code, batch, expiry, mrp, rate, purchase_rate,
        sgst_percent, cgst_percent, stock_qty, reorder_level, tablets_per_sheet,
        created_at, supplier_name, item_category, rack_number, product_type, combination
      ) VALUES (
        @id, @name, @pack, @hsn_code, @batch, @expiry, @mrp, @rate, @purchase_rate,
        @sgst_percent, @cgst_percent, @stock_qty, @reorder_level, @tablets_per_sheet,
        @created_at, @supplier_name, @item_category, @rack_number, @product_type, @combination
      )
    `,
    )
    .run({
      id: row.id,
      name: row.name,
      pack: row.pack ?? '',
      hsn_code: row.hsn_code ?? '',
      batch: row.batch ?? '',
      expiry: row.expiry ?? '',
      mrp: Number(row.mrp || 0),
      rate: Number(row.rate || 0),
      purchase_rate: Number(row.purchase_rate || 0),
      sgst_percent: Number(row.sgst_percent || 0),
      cgst_percent: Number(row.cgst_percent || 0),
      stock_qty: Number(row.stock_qty || 0),
      reorder_level: Number(row.reorder_level || 0),
      tablets_per_sheet: Number(row.tablets_per_sheet || 0),
      created_at: row.created_at || new Date().toISOString(),
      supplier_name: row.supplier_name ?? '',
      item_category: row.item_category || 'Medicine',
      rack_number: row.rack_number ?? '',
      product_type: row.product_type || 'Generic',
      combination: row.combination ?? '',
    });
}

export function restoreStockCheckpoint(id) {
  const row = getDb()
    .prepare('SELECT id, message, snapshot_json FROM stock_checkpoints WHERE id = ?')
    .get(id);
  if (!row) {
    throw new Error('Checkpoint not found');
  }

  let snapshot;
  try {
    snapshot = JSON.parse(row.snapshot_json || '[]');
  } catch {
    throw new Error('Checkpoint snapshot is corrupted');
  }
  if (!Array.isArray(snapshot)) {
    throw new Error('Checkpoint snapshot is invalid');
  }

  return runWithStockCheckpoint(
    `Restored to checkpoint #${row.id}${row.message ? ` — ${row.message}` : ''}`,
    'restore',
    () => {
      const database = getDb();
      database.pragma('foreign_keys = OFF');
      try {
        const tx = database.transaction(() => {
          database.prepare('DELETE FROM medicines').run();
          for (const item of snapshot) {
            insertMedicineRow(database, item);
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
