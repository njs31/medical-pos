import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { app } from 'electron';

let db;

const DEFAULT_OLD_SHOP_NAME = 'CITY CARE PHARMACY';
const DEFAULT_OLD_ADDRESS = '21 Wellness Avenue, Sector 5, New Delhi - 110001';
const DEFAULT_NEW_SHOP_NAME = 'First Care Medicals and Surgicals';
const DEFAULT_NEW_ADDRESS =
  'GROUND FLOOR, VIJAY NAGAR, D.NO:2-22-134/A1, opp. HUDA PARK, Vijaya Nagar Colony, Kukatpally, Hyderabad, Telangana 500072';

const sampleMedicines = [
  ['TELMA BETA 40/25 MG TAB', '10', '30049079', '25009', '04/27', 239, 239, 190, 6, 6, 50, 10],
  ['CLOSONE 0.05% OINTMENT 20GM', '20GM', '30043200', 'C74', '11/27', 491, 491, 405, 6, 6, 20, 5],
  ['SOMPRAZ 40 MG TAB', '15', '30049039', '1419', '05/28', 180, 180, 145, 6, 6, 60, 15],
  ['ECOSPRIN 75MG TAB', '14', '30049062', '10867', '09/26', 5.4, 5.4, 3.6, 6, 6, 100, 20],
  ['ROSUVAS 10MG TAB', '10', '3004', '2324', '04/28', 345.9, 345.9, 280, 6, 6, 30, 10],
  ['AZEE 500 TAB', '5', '30042011', 'AZ501', '12/27', 89, 89, 63, 6, 6, 45, 10],
  ['PAN 40 TAB', '15', '30049039', 'P4024', '07/28', 132, 132, 91, 6, 6, 80, 20],
  ['AUGMENTIN 625 TAB', '10', '30041029', 'AG625', '02/27', 210, 210, 165, 6, 6, 25, 10],
  ['DOLO 650 TAB', '15', '30049099', 'D6501', '08/27', 33, 33, 22, 6, 6, 150, 25],
  ['MONTEK LC TAB', '10', '30049099', 'ML210', '01/28', 185, 185, 130, 6, 6, 55, 10],
  ['DERIPHYLLIN RETARD 150 TAB', '30', '30049099', 'DR150', '10/27', 64, 64, 41, 6, 6, 35, 8],
  ['GLIMESTAR M2 TAB', '15', '30049099', 'GM221', '06/28', 198, 198, 150, 6, 6, 40, 12],
  ['ZIFI 200 TAB', '10', '30042011', 'ZF200', '03/27', 126, 126, 94, 6, 6, 28, 8],
  ['LIVOGEN XT TAB', '10', '30045010', 'LX110', '12/28', 174, 174, 127, 6, 6, 42, 10],
  ['ORS POWDER', '21GM', '21069099', 'ORS55', '09/27', 22, 22, 12, 6, 6, 70, 20],
];

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

function seedMedicines(database) {
  const count = database.prepare('SELECT COUNT(*) as count FROM medicines').get().count;
  if (count > 0) return;

  const insert = database.prepare(`
    INSERT INTO medicines (
      name, pack, hsn_code, batch, expiry, mrp, rate, purchase_rate,
      sgst_percent, cgst_percent, stock_qty, reorder_level
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = database.transaction((rows) => {
    for (const row of rows) insert.run(...row);
  });
  insertMany(sampleMedicines);
}

function seedSettings(database) {
  const row = database.prepare('SELECT COUNT(*) as count FROM shop_settings').get();
  if (row.count > 0) return;
  database.prepare(`
    INSERT INTO shop_settings (
      id, shop_name, address, phone, gstin, default_doctor,
      invoice_prefix, invoice_start, default_discount, terms, footer_message, paper_size
    ) VALUES (
      1,
      'First Care Medicals and Surgicals',
      'GROUND FLOOR, VIJAY NAGAR, D.NO:2-22-134/A1, opp. HUDA PARK, Vijaya Nagar Colony, Kukatpally, Hyderabad, Telangana 500072',
      '+91 98765 43210',
      '07ABCDE1234F1Z5',
      'Dr. Mehta',
      'A000',
      1,
      0,
      'Goods once sold will not be taken back. Please check medicines before leaving the counter.',
      'GET WELL SOON',
      'A4'
    )
  `).run();
}

function migrateDefaultShopSettings(database) {
  database.prepare(`
    UPDATE shop_settings
    SET shop_name = ?, address = ?
    WHERE id = 1 AND shop_name = ? AND address = ?
  `).run(
    DEFAULT_NEW_SHOP_NAME,
    DEFAULT_NEW_ADDRESS,
    DEFAULT_OLD_SHOP_NAME,
    DEFAULT_OLD_ADDRESS,
  );
}

export function initDatabase() {
  if (db) return db;

  const userData = app.getPath('userData');
  fs.mkdirSync(userData, { recursive: true });
  const dbPath = path.join(userData, 'pharmacy-pos.sqlite');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pack TEXT,
      hsn_code TEXT,
      batch TEXT,
      expiry TEXT,
      mrp REAL,
      rate REAL,
      purchase_rate REAL,
      sgst_percent REAL DEFAULT 6,
      cgst_percent REAL DEFAULT 6,
      stock_qty INTEGER DEFAULT 0,
      reorder_level INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE,
      patient_name TEXT,
      patient_phone TEXT,
      doctor_name TEXT,
      dr_reg_no TEXT,
      date TEXT,
      subtotal REAL,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      sgst_total REAL,
      cgst_total REAL,
      grand_total REAL,
      total_items INTEGER DEFAULT 0,
      status TEXT DEFAULT 'saved',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER REFERENCES bills(id) ON DELETE CASCADE,
      medicine_id INTEGER REFERENCES medicines(id),
      product_name TEXT,
      pack TEXT,
      hsn_code TEXT,
      batch TEXT,
      expiry TEXT,
      qty REAL,
      mrp REAL,
      rate REAL,
      sgst_percent REAL,
      cgst_percent REAL,
      amount REAL
    );

    CREATE TABLE IF NOT EXISTS shop_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      shop_name TEXT,
      address TEXT,
      phone TEXT,
      gstin TEXT,
      logo_path TEXT,
      default_doctor TEXT,
      invoice_prefix TEXT DEFAULT 'A000',
      invoice_start INTEGER DEFAULT 1,
      default_discount REAL DEFAULT 0,
      terms TEXT,
      footer_message TEXT DEFAULT 'GET WELL SOON',
      paper_size TEXT DEFAULT 'A4',
      show_hsn INTEGER DEFAULT 1,
      copies INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const billColumns = db.prepare(`PRAGMA table_info(bills)`).all();
  const hasPatientPhone = billColumns.some((column) => column.name === 'patient_phone');
  if (!hasPatientPhone) {
    db.exec(`ALTER TABLE bills ADD COLUMN patient_phone TEXT`);
  }

  seedMedicines(db);
  seedSettings(db);
  migrateDefaultShopSettings(db);
  return db;
}
