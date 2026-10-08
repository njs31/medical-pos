import { getDb } from './db.js';
import { runWithStockCheckpoint } from './stockTimeline.js';

const MEDICINE_COLUMNS = `
  id, name, pack, hsn_code, batch, expiry, mrp, rate, purchase_rate,
  sgst_percent, cgst_percent, stock_qty, reorder_level, tablets_per_sheet,
  supplier_name, item_category, rack_number, product_type, combination, created_at
`;

function escapeLike(token) {
  return String(token).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function getAllMedicines() {
  return getDb()
    .prepare(`SELECT ${MEDICINE_COLUMNS} FROM medicines ORDER BY name COLLATE NOCASE ASC`)
    .all();
}

export function searchMedicines(query = '') {
  const tokens = String(query || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map(escapeLike);

  if (!tokens.length) return [];

  // Every word must match somewhere (name, salt, batch, supplier, or HSN).
  const conditions = tokens
    .map(
      () => `(
      name LIKE ? ESCAPE '\\'
      OR hsn_code LIKE ? ESCAPE '\\'
      OR batch LIKE ? ESCAPE '\\'
      OR supplier_name LIKE ? ESCAPE '\\'
      OR combination LIKE ? ESCAPE '\\'
    )`,
    )
    .join(' AND ');

  const params = [];
  for (const token of tokens) {
    const term = `%${token}%`;
    params.push(term, term, term, term, term);
  }

  return getDb()
    .prepare(`
      SELECT ${MEDICINE_COLUMNS}
      FROM medicines
      WHERE ${conditions}
      ORDER BY
        CASE WHEN COALESCE(stock_qty, 0) > 0 THEN 0 ELSE 1 END,
        name COLLATE NOCASE ASC,
        expiry COLLATE NOCASE ASC
      LIMIT 50
    `)
    .all(...params);
}

function insertMedicine(data) {
  const stmt = getDb().prepare(`
    INSERT INTO medicines (
      name, pack, hsn_code, batch, expiry, mrp, rate, purchase_rate,
      sgst_percent, cgst_percent, stock_qty, reorder_level, tablets_per_sheet, supplier_name, item_category, rack_number, product_type, combination
    ) VALUES (
      @name, @pack, @hsn_code, @batch, @expiry, @mrp, @rate, @purchase_rate,
      @sgst_percent, @cgst_percent, @stock_qty, @reorder_level, @tablets_per_sheet, @supplier_name, @item_category, @rack_number, @product_type, @combination
    )
  `);
  const info = stmt.run(data);
  return getDb().prepare(`SELECT ${MEDICINE_COLUMNS} FROM medicines WHERE id = ?`).get(info.lastInsertRowid);
}

export function addMedicine(data) {
  return runWithStockCheckpoint(`Added ${data.name || 'product'}`, 'add', () => insertMedicine(data));
}

export function addMedicines(rows) {
  return runWithStockCheckpoint(`Bulk added ${rows.length} product${rows.length === 1 ? '' : 's'}`, 'bulk_add', () => {
    const insert = getDb().prepare(`
      INSERT INTO medicines (
        name, pack, hsn_code, batch, expiry, mrp, rate, purchase_rate,
        sgst_percent, cgst_percent, stock_qty, reorder_level, tablets_per_sheet, supplier_name, item_category, rack_number, product_type, combination
      ) VALUES (
        @name, @pack, @hsn_code, @batch, @expiry, @mrp, @rate, @purchase_rate,
        @sgst_percent, @cgst_percent, @stock_qty, @reorder_level, @tablets_per_sheet, @supplier_name, @item_category, @rack_number, @product_type, @combination
      )
    `);
    const tx = getDb().transaction((items) => items.forEach((item) => insert.run(item)));
    tx(rows);
    return getAllMedicines();
  });
}

export function updateMedicine(id, data) {
  return runWithStockCheckpoint(`Updated ${data.name || `product #${id}`}`, 'update', () => {
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
        rack_number = @rack_number,
        product_type = @product_type,
        combination = @combination
      WHERE id = @id
    `).run({ ...data, id });
    return getDb().prepare(`SELECT ${MEDICINE_COLUMNS} FROM medicines WHERE id = ?`).get(id);
  });
}

export function deleteMedicine(id) {
  const existing = getDb().prepare('SELECT name FROM medicines WHERE id = ?').get(id);
  return runWithStockCheckpoint(`Deleted ${existing?.name || `product #${id}`}`, 'delete', () => {
    return getDb().prepare('DELETE FROM medicines WHERE id = ?').run(id);
  });
}

export function adjustMedicineStock(id, qty) {
  const existing = getDb().prepare('SELECT name FROM medicines WHERE id = ?').get(id);
  const direction = Number(qty) >= 0 ? '+' : '';
  return runWithStockCheckpoint(
    `Adjusted stock for ${existing?.name || `#${id}`} (${direction}${qty})`,
    'adjust',
    () => {
      getDb().prepare('UPDATE medicines SET stock_qty = stock_qty + ? WHERE id = ?').run(qty, id);
      return getDb().prepare(`SELECT ${MEDICINE_COLUMNS} FROM medicines WHERE id = ?`).get(id);
    },
  );
}

export function importMedicines(rows) {
  return addMedicines(rows);
}
