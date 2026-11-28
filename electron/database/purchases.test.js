import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

// Real SQLite (Node's built-in driver) behind a small better-sqlite3-style adapter,
// so the actual SQL in purchases.js / stockTimeline.js / medicines.js runs.
let testDb;
vi.mock('./db.js', () => ({ getDb: () => testDb }));

const { addMedicine, adjustMedicineStock, updateMedicine } = await import('./medicines.js');
const { runWithStockCheckpoint } = await import('./stockTimeline.js');
const { applySupplierImport } = await import('../services/supplierImport.js');
const {
  ensurePurchaseLog,
  listDistributors,
  getDistributorPurchases,
  purchasesFromDiff,
  supplierKey,
} = await import('./purchases.js');

function openDb() {
  const raw = new DatabaseSync(':memory:');
  const db = {
    prepare: (sql) => raw.prepare(sql),
    exec: (sql) => raw.exec(sql),
    transaction: (fn) => (...args) => {
      raw.exec('BEGIN');
      try {
        const result = fn(...args);
        raw.exec('COMMIT');
        return result;
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
  db.exec(`
    CREATE TABLE medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, pack TEXT, hsn_code TEXT,
      batch TEXT, expiry TEXT, mrp REAL, rate REAL, purchase_rate REAL,
      sgst_percent REAL DEFAULT 0, cgst_percent REAL DEFAULT 0, stock_qty INTEGER DEFAULT 0,
      reorder_level INTEGER DEFAULT 10, tablets_per_sheet INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, supplier_name TEXT,
      item_category TEXT DEFAULT 'Medicine', rack_number TEXT,
      product_type TEXT DEFAULT 'Generic', combination TEXT DEFAULT ''
    );
    CREATE TABLE suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE stock_checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT NOT NULL, source TEXT DEFAULT 'system',
      added_count INTEGER DEFAULT 0, removed_count INTEGER DEFAULT 0, changed_count INTEGER DEFAULT 0,
      snapshot_json TEXT NOT NULL, diff_json TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

const med = (overrides = {}) => ({
  name: 'DOLO 650 TAB', pack: '15S', hsn_code: '3004', batch: 'B1', expiry: '05/28',
  mrp: 30, rate: 2, purchase_rate: 2, sgst_percent: 6, cgst_percent: 6, stock_qty: 150,
  reorder_level: 10, tablets_per_sheet: 15, supplier_name: 'Sri Soumya Medicals',
  item_category: 'Medicine', rack_number: '', product_type: 'Ethical', combination: '',
  ...overrides,
});

beforeEach(() => {
  testDb = openDb();
});

describe('purchasesFromDiff', () => {
  it('counts new batches and stock increases only, for intake sources', () => {
    const diff = {
      added: [{ id: 1, name: 'A', stock_qty: 10, supplier_name: 'X', purchase_rate: 1 }],
      changed: [
        { id: 2, name: 'B', supplier_name: 'Y', changes: { stock_qty: { from: 5, to: 12 } } },
        { id: 3, name: 'C', supplier_name: 'Y', changes: { stock_qty: { from: 9, to: 4 } } },
        { id: 4, name: 'D', supplier_name: 'Y', changes: { mrp: { from: 1, to: 2 } } },
      ],
      removed: [],
    };
    expect(purchasesFromDiff(diff, 'supplier_import').map((e) => [e.name, e.qty])).toEqual([['A', 10], ['B', 7]]);
    expect(purchasesFromDiff(diff, 'bill')).toEqual([]);
    expect(purchasesFromDiff(diff, 'update')).toEqual([]);
    expect(purchasesFromDiff(diff, 'restore')).toEqual([]);
  });

  it('treats supplier name spelling differences as one distributor', () => {
    expect(supplierKey('  sri   soumya Medicals ')).toBe(supplierKey('SRI SOUMYA MEDICALS'));
  });
});

describe('purchase log', () => {
  it('back-fills from checkpoints and older batches, then records new intake live', () => {
    // Before the purchase log existed: one batch from seed data (no checkpoint)…
    testDb.prepare(`INSERT INTO medicines (name, batch, stock_qty, purchase_rate, supplier_name, tablets_per_sheet)
      VALUES ('OLD SYRUP', 'S1', 7, 40, 'Ankur Pharmacy', 0)`).run();
    // …and one added through the app (has a checkpoint).
    addMedicine(med());

    expect(ensurePurchaseLog(testDb)).toBe(true);
    expect(ensurePurchaseLog(testDb)).toBe(false); // runs once only

    // New activity after the log exists.
    addMedicine(med({ name: 'PAN 40', batch: 'P9', stock_qty: 30, supplier_name: 'SRI SOUMYA MEDICALS', purchase_rate: 5 }));
    const dolo = testDb.prepare(`SELECT id FROM medicines WHERE name = 'DOLO 650 TAB'`).get();
    adjustMedicineStock(dolo.id, -15); // a sale-style deduction: not a purchase
    updateMedicine(dolo.id, { ...med(), stock_qty: 500 }); // an edit: not a purchase
    applySupplierImport(
      [{ name: 'DOLO 650 TAB', batch: 'B1', stock_qty: 45, rate: 30, tablets_per_sheet: 15, supplier_name: 'Sri Soumya Medicals' }],
      {},
    );

    const list = listDistributors(testDb);
    const soumya = list.find((row) => row.supplier_key === 'SRI SOUMYA MEDICALS');
    expect(soumya.entries).toBe(3); // DOLO add + PAN add + DOLO import
    expect(soumya.medicines).toBe(2);
    expect(list.find((row) => row.supplier_key === 'ANKUR PHARMACY').earlier_entries).toBe(1);

    const rows = getDistributorPurchases('sri soumya medicals', testDb);
    expect(rows.map((r) => [r.name, r.qty, r.source])).toEqual([
      ['DOLO 650 TAB', 45, 'supplier_import'],
      ['PAN 40', 30, 'add'],
      ['DOLO 650 TAB', 150, 'add'],
    ]);
    expect(rows[0].current_stock).toBe(545); // 500 after edit + 45 imported
    expect(rows[0].purchase_rate).toBe(2); // ₹30 per strip ÷ 15 tablets

    const earlier = getDistributorPurchases('Ankur Pharmacy', testDb);
    expect(earlier).toHaveLength(1);
    expect(earlier[0]).toMatchObject({ name: 'OLD SYRUP', qty: 7, source: 'existing' });
  });

  it('lists saved suppliers with no purchases, and keeps stock changes working without the log', () => {
    testDb.prepare(`INSERT INTO suppliers (name) VALUES ('AK Medicals Private Limited')`).run();
    // Log table missing (e.g. setup failed): stock changes must still succeed.
    expect(() => addMedicine(med())).not.toThrow();
    expect(testDb.prepare('SELECT COUNT(*) AS n FROM medicines').get().n).toBe(1);

    ensurePurchaseLog(testDb);
    const ak = listDistributors(testDb).find((row) => row.supplier_key === 'AK MEDICALS PRIVATE LIMITED');
    expect(ak).toMatchObject({ entries: 0, medicines: 0 });
  });

  it('ignores sales and checkpoint restores', () => {
    ensurePurchaseLog(testDb);
    addMedicine(med());
    runWithStockCheckpoint('Sale INV-1', 'bill', () => {
      testDb.prepare('UPDATE medicines SET stock_qty = stock_qty + 20').run();
    });
    runWithStockCheckpoint('Restore', 'restore', () => {
      testDb.prepare('UPDATE medicines SET stock_qty = stock_qty + 20').run();
    });
    expect(getDistributorPurchases('Sri Soumya Medicals', testDb)).toHaveLength(1);
  });
});

describe('addSupplier', () => {
  it('saves a new supplier once, whatever the spelling', async () => {
    const { addSupplier, getAllSuppliers } = await import('./suppliers.js');
    const first = addSupplier({ name: '  New  Pharma Distributors ', details: '' });
    expect(first).toMatchObject({ name: 'New Pharma Distributors', existed: false });
    const again = addSupplier({ name: 'NEW PHARMA DISTRIBUTORS' });
    expect(again).toMatchObject({ id: first.id, name: 'New Pharma Distributors', existed: true });
    expect(getAllSuppliers()).toHaveLength(1);
    expect(() => addSupplier({ name: '   ' })).toThrow('Supplier name is required');
  });
});
