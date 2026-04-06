import { getDb } from './db.js';

function expiryKey(expiry) {
  const [month, year] = String(expiry || '').split('/').map(Number);
  if (!month || !year) return 0;
  return year * 100 + month;
}

export function getAllMedicines() {
  return getDb()
    .prepare('SELECT * FROM medicines ORDER BY name COLLATE NOCASE ASC')
    .all()
    .map((row) => ({
      ...row,
      expiry_sort: expiryKey(row.expiry),
    }));
}

export function searchMedicines(query = '') {
  const term = `%${query.trim()}%`;
  return getDb()
    .prepare(`
      SELECT *
      FROM medicines
      WHERE name LIKE ? OR hsn_code LIKE ? OR batch LIKE ?
      ORDER BY name COLLATE NOCASE ASC
      LIMIT 20
    `)
    .all(term, term, term);
}

export function addMedicine(data) {
  const stmt = getDb().prepare(`
    INSERT INTO medicines (
      name, pack, hsn_code, batch, expiry, mrp, rate, purchase_rate,
      sgst_percent, cgst_percent, stock_qty, reorder_level, tablets_per_sheet, supplier_name, item_category, rack_number
    ) VALUES (
      @name, @pack, @hsn_code, @batch, @expiry, @mrp, @rate, @purchase_rate,
      @sgst_percent, @cgst_percent, @stock_qty, @reorder_level, @tablets_per_sheet, @supplier_name, @item_category, @rack_number
    )
  `);
  const info = stmt.run(data);
  return getDb().prepare('SELECT * FROM medicines WHERE id = ?').get(info.lastInsertRowid);
}

export function updateMedicine(id, data) {
  getDb().prepare(`
    UPDATE medicines SET
      name = @name,
      pack = @pack,
      hsn_code = @hsn_code,
      batch = @batch,
      expiry = @expiry,
      mrp = @mrp,
      rate = @rate,
      purchase_rate = @purchase_rate,
      sgst_percent = @sgst_percent,
      cgst_percent = @cgst_percent,
      stock_qty = @stock_qty,
      reorder_level = @reorder_level,
      tablets_per_sheet = @tablets_per_sheet,
      supplier_name = @supplier_name,
      item_category = @item_category,
      rack_number = @rack_number
    WHERE id = @id
  `).run({ ...data, id });
  return getDb().prepare('SELECT * FROM medicines WHERE id = ?').get(id);
}

export function deleteMedicine(id) {
  return getDb().prepare('DELETE FROM medicines WHERE id = ?').run(id);
}

export function adjustMedicineStock(id, qty) {
  getDb().prepare('UPDATE medicines SET stock_qty = stock_qty + ? WHERE id = ?').run(qty, id);
  return getDb().prepare('SELECT * FROM medicines WHERE id = ?').get(id);
}

export function importMedicines(rows) {
  const insert = getDb().prepare(`
    INSERT INTO medicines (
      name, pack, hsn_code, batch, expiry, mrp, rate, purchase_rate,
      sgst_percent, cgst_percent, stock_qty, reorder_level, tablets_per_sheet, supplier_name, item_category, rack_number
    ) VALUES (
      @name, @pack, @hsn_code, @batch, @expiry, @mrp, @rate, @purchase_rate,
      @sgst_percent, @cgst_percent, @stock_qty, @reorder_level, @tablets_per_sheet, @supplier_name, @item_category, @rack_number
    )
  `);
  const tx = getDb().transaction((items) => items.forEach((item) => insert.run(item)));
  tx(rows);
  return getAllMedicines();
}
