import { getDb } from './db.js';

// Purchase log: one row per stock intake of a batch, so the shop can see which
// medicines were bought from each distributor. Rows are derived from the same
// before/after diff the Stock Timeline records, so every intake path (Add Stock,
// Bulk Add / CSV, supplier file import, inward stock patches) is covered.
// Sales, edits, deletes and restores are not purchases and are skipped.

export const PURCHASE_SOURCES = new Set(['add', 'bulk_add', 'supplier_import', 'stock_patch']);

// Entries back-filled from batches that pre-date the stock history. Their
// quantity is the batch's stock at the time the log was created, not the
// quantity originally bought.
export const EARLIER_STOCK_SOURCE = 'existing';

export function supplierKey(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Turns one stock diff into purchase entries: new batches and stock increases. */
export function purchasesFromDiff(diff, source) {
  if (!PURCHASE_SOURCES.has(source) || !diff) return [];
  const entries = [];

  for (const row of Array.isArray(diff.added) ? diff.added : []) {
    const qty = Number(row.stock_qty) || 0;
    if (qty > 0) entries.push({ row, qty });
  }

  for (const row of Array.isArray(diff.changed) ? diff.changed : []) {
    const change = row.changes?.stock_qty;
    if (!change) continue;
    const qty = (Number(change.to) || 0) - (Number(change.from) || 0);
    if (qty > 0) entries.push({ row, qty });
  }

  return entries.map(({ row, qty }) => ({
    supplier_name: String(row.supplier_name || '').trim(),
    supplier_key: supplierKey(row.supplier_name),
    medicine_id: row.id ?? null,
    name: String(row.name || '').trim(),
    batch: String(row.batch || '').trim(),
    expiry: String(row.expiry || '').trim(),
    qty,
    purchase_rate: Number(row.purchase_rate) || 0,
    mrp: Number(row.mrp) || 0,
    item_category: row.item_category || 'Medicine',
    source,
  }));
}

function insertStatement(database) {
  return database.prepare(`
    INSERT INTO purchases (
      purchased_at, supplier_name, supplier_key, medicine_id, name, batch, expiry,
      qty, purchase_rate, mrp, item_category, source, checkpoint_id
    ) VALUES (
      @purchased_at, @supplier_name, @supplier_key, @medicine_id, @name, @batch, @expiry,
      @qty, @purchase_rate, @mrp, @item_category, @source, @checkpoint_id
    )
  `);
}

/**
 * Records purchases for a stock checkpoint that was just saved.
 * `purchasedAt` is a UTC "YYYY-MM-DD HH:MM:SS" string; defaults to now.
 */
export function recordPurchasesFromDiff(diff, source, checkpointId = null, purchasedAt = null, database = getDb()) {
  const entries = purchasesFromDiff(diff, source);
  if (!entries.length) return 0;
  const when = purchasedAt || database.prepare(`SELECT datetime('now') AS now`).get().now;
  const insert = insertStatement(database);
  for (const entry of entries) {
    insert.run({ ...entry, purchased_at: when, checkpoint_id: checkpointId });
  }
  return entries.length;
}

function backfillPurchases(database) {
  // 1) Real intake history from past stock checkpoints (oldest first).
  //    Checkpoints store local time; convert to UTC like the rest of the app.
  const sources = [...PURCHASE_SOURCES];
  const checkpoints = database.prepare(`
    SELECT id, source, diff_json, datetime(created_at, 'utc') AS created_utc
    FROM stock_checkpoints
    WHERE source IN (${sources.map(() => '?').join(', ')})
    ORDER BY id ASC
  `).all(...sources);

  for (const checkpoint of checkpoints) {
    let diff;
    try {
      diff = JSON.parse(checkpoint.diff_json || '{}');
    } catch {
      continue;
    }
    recordPurchasesFromDiff(diff, checkpoint.source, checkpoint.id, checkpoint.created_utc, database);
  }

  // 2) Batches older than the stock history: one "earlier stock" entry each,
  //    under the supplier saved on the batch.
  const insert = insertStatement(database);
  const older = database.prepare(`
    SELECT m.* FROM medicines m
    WHERE NOT EXISTS (SELECT 1 FROM purchases p WHERE p.medicine_id = m.id)
      AND (COALESCE(m.stock_qty, 0) > 0 OR TRIM(COALESCE(m.supplier_name, '')) != '')
  `).all();
  for (const row of older) {
    insert.run({
      purchased_at: row.created_at || null,
      supplier_name: String(row.supplier_name || '').trim(),
      supplier_key: supplierKey(row.supplier_name),
      medicine_id: row.id,
      name: String(row.name || '').trim(),
      batch: String(row.batch || '').trim(),
      expiry: String(row.expiry || '').trim(),
      qty: Math.max(0, Number(row.stock_qty) || 0),
      purchase_rate: Number(row.purchase_rate) || 0,
      mrp: Number(row.mrp) || 0,
      item_category: row.item_category || 'Medicine',
      source: EARLIER_STOCK_SOURCE,
      checkpoint_id: null,
    });
  }
}

/** Creates the purchase log on first run and fills it from existing history. */
export function ensurePurchaseLog(database = getDb()) {
  const exists = database
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'purchases'`)
    .get();
  if (exists) return false;

  database.transaction(() => {
    database.exec(`
      CREATE TABLE purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchased_at DATETIME,
        supplier_name TEXT DEFAULT '',
        supplier_key TEXT DEFAULT '',
        medicine_id INTEGER,
        name TEXT NOT NULL,
        batch TEXT DEFAULT '',
        expiry TEXT DEFAULT '',
        qty REAL DEFAULT 0,
        purchase_rate REAL DEFAULT 0,
        mrp REAL DEFAULT 0,
        item_category TEXT DEFAULT 'Medicine',
        source TEXT DEFAULT '',
        checkpoint_id INTEGER
      );
      CREATE INDEX idx_purchases_supplier ON purchases(supplier_key, purchased_at);
      CREATE INDEX idx_purchases_medicine ON purchases(medicine_id);
    `);
    backfillPurchases(database);
  })();
  return true;
}

/** One row per distributor (plus saved suppliers with no purchases yet). */
export function listDistributors(database = getDb()) {
  const rows = database.prepare(`
    SELECT
      supplier_key,
      COUNT(*) AS entries,
      COUNT(DISTINCT UPPER(TRIM(name))) AS medicines,
      SUM(qty * purchase_rate) AS value,
      MAX(purchased_at) AS last_purchased_at,
      SUM(CASE WHEN source = '${EARLIER_STOCK_SOURCE}' THEN 1 ELSE 0 END) AS earlier_entries
    FROM purchases
    GROUP BY supplier_key
  `).all();

  // Show the most recently used spelling of each distributor's name.
  const latestName = database.prepare(`
    SELECT supplier_name FROM purchases WHERE supplier_key = ?
    ORDER BY purchased_at DESC, id DESC LIMIT 1
  `);
  const byKey = new Map(
    rows.map((row) => [row.supplier_key, {
      ...row,
      value: Number(row.value) || 0,
      supplier_name: row.supplier_key ? latestName.get(row.supplier_key)?.supplier_name || row.supplier_key : '',
    }]),
  );

  for (const supplier of database.prepare('SELECT name FROM suppliers').all()) {
    const key = supplierKey(supplier.name);
    if (key && !byKey.has(key)) {
      byKey.set(key, {
        supplier_key: key,
        supplier_name: String(supplier.name).trim(),
        entries: 0,
        medicines: 0,
        value: 0,
        last_purchased_at: null,
        earlier_entries: 0,
      });
    }
  }

  return [...byKey.values()].sort((a, b) => {
    if (!a.supplier_key !== !b.supplier_key) return a.supplier_key ? -1 : 1; // "Unknown" last
    return String(b.last_purchased_at || '').localeCompare(String(a.last_purchased_at || ''))
      || a.supplier_name.localeCompare(b.supplier_name);
  });
}

/** Every purchase from one distributor, newest first, with today's stock of the batch. */
export function getDistributorPurchases(key, database = getDb()) {
  return database.prepare(`
    SELECT
      p.*,
      m.stock_qty AS current_stock,
      m.tablets_per_sheet AS tablets_per_sheet,
      m.pack AS pack
    FROM purchases p
    LEFT JOIN medicines m ON m.id = p.medicine_id
    WHERE p.supplier_key = ?
    ORDER BY p.purchased_at DESC, p.id DESC
  `).all(supplierKey(key));
}
