import { getDb } from './db.js';
import { runWithStockCheckpoint } from './stockTimeline.js';

// Inward stock shipped with an app update, for entries that cannot be imported
// on the shop computer itself. Each patch is applied once per database and
// recorded in applied_stock_patches, so restarts and reinstalls never double
// the quantities. Quantities already include free goods.
const STOCK_PATCHES = [
  {
    id: 'IC19092-2026-09-12',
    label: 'Inward stock - invoice IC19092 (12/09/2026)',
    supplier_name: '',
    items: [
      { name: 'THYRONORM-25MG TABS', pack: '100S', hsn_code: '30049082', batch: 'CCR26018',  expiry: '05/28', mrp: 186.60, rate: 142.17, stock_qty: 2, reorder_level: 1 },
      { name: 'METSMALL 1000 TAB',   pack: '15S',  hsn_code: '30049099', batch: 'E2601253',  expiry: '05/29', mrp: 56.05,  rate: 42.70,  stock_qty: 3, reorder_level: 1 },
      { name: 'VOMIKIND MD4 TAB',    pack: '10S',  hsn_code: '30049035', batch: 'D45Z011',   expiry: '02/28', mrp: 48.11,  rate: 36.66,  stock_qty: 6, reorder_level: 2 },
      { name: 'CAL-123 CAP',         pack: '15S',  hsn_code: '30049099', batch: 'CALP26012', expiry: '05/28', mrp: 215.00, rate: 163.81, stock_qty: 2, reorder_level: 1 },
    ],
  },
];

function ensurePatchTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS applied_stock_patches (
      id TEXT PRIMARY KEY,
      label TEXT DEFAULT '',
      item_count INTEGER DEFAULT 0,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function isApplied(database, patchId) {
  return Boolean(
    database.prepare('SELECT id FROM applied_stock_patches WHERE id = ?').get(patchId),
  );
}

function applyPatch(database, patch) {
  const findExact = database.prepare(`
    SELECT id FROM medicines
    WHERE UPPER(TRIM(name)) = UPPER(TRIM(@name))
      AND UPPER(TRIM(COALESCE(batch, ''))) = UPPER(TRIM(@batch))
    LIMIT 1
  `);

  const insert = database.prepare(`
    INSERT INTO medicines (
      name, pack, hsn_code, batch, expiry, mrp, rate, purchase_rate,
      sgst_percent, cgst_percent, stock_qty, reorder_level, tablets_per_sheet,
      supplier_name, item_category, rack_number, product_type, combination
    ) VALUES (
      @name, @pack, @hsn_code, @batch, @expiry, @mrp, @rate, @purchase_rate,
      0, 0, @stock_qty, @reorder_level, 0,
      @supplier_name, 'Medicine', '', 'Ethical', ''
    )
  `);

  // Existing batch: top up the quantity and refresh the printed details.
  const update = database.prepare(`
    UPDATE medicines SET
      stock_qty = stock_qty + @stock_qty,
      mrp = CASE WHEN @mrp > 0 THEN @mrp ELSE mrp END,
      rate = CASE WHEN @rate > 0 THEN @rate ELSE rate END,
      purchase_rate = CASE WHEN @purchase_rate > 0 THEN @purchase_rate ELSE purchase_rate END,
      expiry = CASE WHEN @expiry != '' THEN @expiry ELSE expiry END,
      pack = CASE WHEN @pack != '' THEN @pack ELSE pack END,
      hsn_code = CASE WHEN @hsn_code != '' THEN @hsn_code ELSE hsn_code END
    WHERE id = @id
  `);

  let added = 0;
  let updated = 0;

  const tx = database.transaction(() => {
    for (const item of patch.items) {
      const payload = {
        name: item.name,
        pack: item.pack || '',
        hsn_code: item.hsn_code || '',
        batch: item.batch || '',
        expiry: item.expiry || '',
        mrp: item.mrp || 0,
        rate: item.rate || 0,
        purchase_rate: item.purchase_rate || item.rate || 0,
        stock_qty: Math.round(item.stock_qty || 0),
        reorder_level: item.reorder_level ?? 0,
        supplier_name: item.supplier_name || patch.supplier_name || '',
      };
      if (!payload.name || payload.stock_qty <= 0) continue;

      const existing = findExact.get(payload);
      if (existing) {
        update.run({ ...payload, id: existing.id });
        updated += 1;
      } else {
        insert.run(payload);
        added += 1;
      }
    }

    // Recorded in the same transaction as the stock change, so the patch can
    // never be half-applied.
    database
      .prepare('INSERT INTO applied_stock_patches (id, label, item_count) VALUES (?, ?, ?)')
      .run(patch.id, patch.label, added + updated);
  });

  tx();
  return { added, updated };
}

export function applyPendingStockPatches() {
  const database = getDb();
  ensurePatchTable(database);

  const results = [];
  for (const patch of STOCK_PATCHES) {
    if (isApplied(database, patch.id)) continue;
    // Checkpointed so the shop can undo it from Stock Timeline.
    const result = runWithStockCheckpoint(patch.label, 'stock_patch', () =>
      applyPatch(database, patch),
    );
    results.push({ id: patch.id, ...result });
  }
  return results;
}
