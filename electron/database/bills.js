import { getDb } from './db.js';
import { getSettings } from './settings.js';

function nextInvoiceNumber() {
  const settings = getSettings();
  const lastBill = getDb()
    .prepare('SELECT invoice_no FROM bills ORDER BY id DESC LIMIT 1')
    .get();

  const numericStart = Number(settings.invoice_start || 1);
  const template = settings.invoice_prefix || 'A000';
  const templateMatch = String(template).match(/^(.*?)(0+)$/);
  const configuredPrefix = templateMatch ? templateMatch[1] : template;
  const configuredWidth = templateMatch ? templateMatch[2].length + 1 : 4;

  if (!lastBill?.invoice_no) {
    return `${configuredPrefix}${String(numericStart).padStart(configuredWidth, '0')}`;
  }

  const match = String(lastBill.invoice_no).match(/(\D*)(\d+)$/);
  if (!match) {
    return `${configuredPrefix}${String(numericStart).padStart(configuredWidth, '0')}`;
  }

  const [, detectedPrefix, value] = match;
  return `${detectedPrefix}${String(Number(value) + 1).padStart(value.length, '0')}`;
}

export function previewNextInvoiceNo() {
  return nextInvoiceNumber();
}

export function createBill(billData) {
  const database = getDb();
  const invoiceNo = billData.invoice_no || nextInvoiceNumber();

  const insertBill = database.prepare(`
    INSERT INTO bills (
      invoice_no, patient_name, patient_phone, doctor_name, date,
      subtotal, discount_percent, discount_amount, sgst_total, cgst_total,
      grand_total, total_items, status
    ) VALUES (
      @invoice_no, @patient_name, @patient_phone, @doctor_name, @date,
      @subtotal, @discount_percent, @discount_amount, @sgst_total, @cgst_total,
      @grand_total, @total_items, @status
    )
  `);

  const insertItem = database.prepare(`
    INSERT INTO bill_items (
      bill_id, medicine_id, product_name, pack, hsn_code, batch, expiry,
      qty, mrp, rate, sgst_percent, cgst_percent, amount, discount, tablets_per_sheet
    ) VALUES (
      @bill_id, @medicine_id, @product_name, @pack, @hsn_code, @batch, @expiry,
      @qty, @mrp, @rate, @sgst_percent, @cgst_percent, @amount, @discount, @tablets_per_sheet
    )
  `);

  const reduceStock = database.prepare('UPDATE medicines SET stock_qty = stock_qty - ? WHERE id = ?');

  const tx = database.transaction(() => {
    const billInfo = insertBill.run({
      sgst_total: 0,
      cgst_total: 0,
      ...billData,
      invoice_no: invoiceNo,
      total_items: billData.items.length,
    });

    for (const item of billData.items) {
      insertItem.run({
        sgst_percent: 0,
        cgst_percent: 0,
        discount: item.discount || 0,
        tablets_per_sheet: Number(item.tablets_per_sheet) || 0,
        ...item,
        bill_id: billInfo.lastInsertRowid,
        medicine_id: item.medicine_id || null,
      });
      if (item.medicine_id) reduceStock.run(item.qty, item.medicine_id);
    }

    return billInfo.lastInsertRowid;
  });

  const billId = tx();
  return getBillById(billId);
}

export function getBills(filters = {}) {
  const clauses = [];
  const params = {};

  if (filters.search) {
    clauses.push('(patient_name LIKE @search OR invoice_no LIKE @search)');
    params.search = `%${filters.search}%`;
  }
  if (filters.from) {
    clauses.push('date(date) >= date(@from)');
    params.from = filters.from;
  }
  if (filters.to) {
    clauses.push('date(date) <= date(@to)');
    params.to = filters.to;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return getDb().prepare(`
    SELECT *
    FROM bills
    ${where}
    ORDER BY date(date) DESC, id DESC
  `).all(params);
}

export function getBillItems(billId) {
  return getDb()
    .prepare(`
      SELECT * 
      FROM bill_items 
      WHERE bill_id = ? 
      ORDER BY id ASC
    `)
    .all(billId);
}

export function getBillById(id) {
  const bill = getDb().prepare('SELECT * FROM bills WHERE id = ?').get(id);
  if (!bill) return null;
  return {
    ...bill,
    items: getBillItems(id),
    settings: getSettings(),
  };
}

export function deleteBill(id) {
  const items = getBillItems(id);
  const restore = getDb().prepare('UPDATE medicines SET stock_qty = stock_qty + ? WHERE id = ?');
  const tx = getDb().transaction(() => {
    for (const item of items) {
      if (item.medicine_id) restore.run(item.qty, item.medicine_id);
    }
    getDb().prepare('DELETE FROM bills WHERE id = ?').run(id);
  });
  tx();
  return { success: true };
}

export function getDashboardSummary() {
  const today = getDb().prepare(`
    SELECT
      COALESCE(SUM(grand_total), 0) as sales,
      COUNT(*) as bills_count
    FROM bills
    WHERE date(date) = date('now', 'localtime')
  `).get();

  const lowStock = getDb().prepare(`
    SELECT COUNT(*) as count
    FROM medicines
    WHERE stock_qty <= reorder_level
  `).get();

  const expiringSoon = getDb().prepare(`
    SELECT COUNT(*) as count
    FROM medicines
    WHERE substr(expiry, 4, 2) || substr(expiry, 1, 2) >= strftime('%y%m', 'now')
      AND substr(expiry, 4, 2) || substr(expiry, 1, 2) <= strftime('%y%m', date('now', '+90 days'))
  `).get();

  const expiredCount = getDb().prepare(`
    SELECT COUNT(*) as count
    FROM medicines
    WHERE substr(expiry, 4, 2) || substr(expiry, 1, 2) < strftime('%y%m', 'now')
  `).get();

  const recentBills = getDb().prepare(`
    SELECT id, invoice_no, patient_name, grand_total, date
    FROM bills
    ORDER BY id DESC
    LIMIT 10
  `).all();

  return {
    todaysSales: today.sales,
    billsGeneratedToday: today.bills_count,
    lowStockItems: lowStock.count,
    expiringSoonItems: expiringSoon.count,
    expiredItems: expiredCount.count,
    recentBills,
  };
}

export function getSalesSummary(from, to) {
  const params = { from, to };
  const totals = getDb().prepare(`
    SELECT
      COALESCE(SUM(grand_total), 0) as total_sales,
      COUNT(*) as total_bills,
      COALESCE(SUM(sgst_total + cgst_total), 0) as total_gst
    FROM bills
    WHERE date(date) BETWEEN date(@from) AND date(@to)
  `).get(params);

  const dayWise = getDb().prepare(`
    SELECT date(date) as date, COALESCE(SUM(grand_total), 0) as sales
    FROM bills
    WHERE date(date) BETWEEN date(@from) AND date(@to)
    GROUP BY date(date)
    ORDER BY date(date) ASC
  `).all(params);

  const topMedicines = getDb().prepare(`
    SELECT product_name, SUM(qty) as qty, SUM(amount) as revenue
    FROM bill_items
    JOIN bills ON bills.id = bill_items.bill_id
    WHERE date(bills.date) BETWEEN date(@from) AND date(@to)
    GROUP BY product_name
    ORDER BY qty DESC, revenue DESC
    LIMIT 10
  `).all(params);

  return { totals, dayWise, topMedicines };
}

export function getStockReport() {
  const inventoryValuation = getDb().prepare(`
    SELECT COALESCE(SUM(stock_qty * COALESCE(purchase_rate, rate, 0)), 0) as value
    FROM medicines
  `).get();

  const lowStockList = getDb().prepare(`
    SELECT *, MAX(reorder_level - stock_qty, 0) as suggested_order
    FROM medicines
    WHERE stock_qty <= reorder_level
    ORDER BY stock_qty ASC
  `).all();

  const expiryBuckets = {
    expired: getDb().prepare(`
      SELECT * FROM medicines
      WHERE substr(expiry, 4, 2) || substr(expiry, 1, 2) < strftime('%y%m', 'now')
      ORDER BY expiry ASC
    `).all(),
    within30: getDb().prepare(`
      SELECT * FROM medicines
      WHERE substr(expiry, 4, 2) || substr(expiry, 1, 2) >= strftime('%y%m', 'now')
        AND substr(expiry, 4, 2) || substr(expiry, 1, 2) <= strftime('%y%m', date('now', '+30 days'))
      ORDER BY expiry ASC
    `).all(),
    within60: getDb().prepare(`
      SELECT * FROM medicines
      WHERE substr(expiry, 4, 2) || substr(expiry, 1, 2) >= strftime('%y%m', 'now')
        AND substr(expiry, 4, 2) || substr(expiry, 1, 2) <= strftime('%y%m', date('now', '+60 days'))
      ORDER BY expiry ASC
    `).all(),
    within90: getDb().prepare(`
      SELECT * FROM medicines
      WHERE substr(expiry, 4, 2) || substr(expiry, 1, 2) >= strftime('%y%m', 'now')
        AND substr(expiry, 4, 2) || substr(expiry, 1, 2) <= strftime('%y%m', date('now', '+90 days'))
      ORDER BY expiry ASC
    `).all(),
  };

  return {
    inventoryValuation: inventoryValuation.value,
    lowStockList,
    expiryBuckets,
  };
}

