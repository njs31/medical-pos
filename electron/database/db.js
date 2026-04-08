import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { app } from 'electron';

let db;

const DEFAULT_OLD_SHOP_NAME = 'CITY CARE PHARMACY';
const DEFAULT_OLD_ADDRESS = '21 Wellness Avenue, Sector 5, New Delhi - 110001';
const DEFAULT_NEW_SHOP_NAME = 'DHARVI SREE POLY CLINIC';
const DEFAULT_NEW_ADDRESS =
  'GROUND FLOOR, VIJAY NAGAR, D.NO:2-22-134/A1, opp. HUDA PARK, Vijaya Nagar Colony, Kukatpally, Hyderabad, Telangana 500072';
// [name, pack, hsn, batch, expiry, mrp, rate, purchase, sgst, cgst, stock, reorder, tab/sheet, supplier, category, rack]
const sampleMedicines = [
  // Medicine (3)
  ['DOLO 650 TAB',         '', '', 'D650A',  '08/27', 33,  33,  22,  0, 0, 150, 10, 15, 'Ankur Pharmacy', 'Medicine', 'A1'],
  ['PAN 40 TAB',           '', '', 'P4024',  '07/28', 132, 132, 91,  0, 0,  80, 20, 15, 'Ankur Pharmacy', 'Medicine', 'A2'],
  ['AZITHROMYCIN 500 TAB', '', '', 'AZ500B', '12/28', 89,  89,  63,  0, 0,  45, 10,  5, 'Ankur Pharmacy', 'Medicine', 'A3'],
  // General (3)
  ['BETADINE SOLUTION',    '', '', 'BT100',  '06/28', 75,  75,  50,  0, 0,  30,  5,  0, 'Ankur Pharmacy', 'General',  'C1'],
  ['VICKS VAPORUB 25GM',   '', '', 'VV250',  '03/29', 65,  65,  45,  0, 0,  40,  5,  0, 'Ankur Pharmacy', 'General',  'C2'],
  ['ORS POWDER',           '', '', 'ORS55',  '09/27', 22,  22,  12,  0, 0,  70, 20,  0, 'Ankur Pharmacy', 'General',  'C3'],
  // Surgical (3)
  ['SURGICAL GLOVES M',   '', '', 'SG100',  '12/29', 12,  12,   8,  0, 0, 200, 20,  0, 'Ankur Pharmacy', 'Surgical', 'D1'],
  ['COTTON ROLL 500GM',   '', '', 'CT500',  '11/30', 95,  95,  70,  0, 0,  20,  5,  0, 'Ankur Pharmacy', 'Surgical', 'D2'],
  ['CREPE BANDAGE 6CM',   '', '', 'CB600',  '05/29', 45,  45,  30,  0, 0,  50, 10,  0, 'Ankur Pharmacy', 'Surgical', 'D3'],
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
      sgst_percent, cgst_percent, stock_qty, reorder_level, tablets_per_sheet,
      supplier_name, item_category, rack_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      'DHARVI SREE POLY CLINIC',
      'GROUND FLOOR, VIJAY NAGAR, D.NO:2-22-134/A1, opp. HUDA PARK, Vijaya Nagar Colony, Kukatpally, Hyderabad, Telangana 500072',
      '+91 91 00 4382 23',
      '',
      '',
      'A000',
      1,
      0,
      'Goods once sold will not be taken back. Please check medicines before leaving the counter.',
      'GET WELL SOON',
      'A5'
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

function seedSuppliers(database) {
  const count = database.prepare('SELECT COUNT(*) as count FROM suppliers').get().count;
  if (count > 0) return;

  const insert = database.prepare('INSERT INTO suppliers (name, details) VALUES (?, ?)');
  const suppliers = [
    ['Ankur Pharmacy', 'TS/MDL/2019-45345'],
    ['Sri Balaji Traders', 'TS/MDL/2023-104310'],
    ['Sri Soumya Medicals', 'DL.20 & 21: TG/15/03/2015-8662, DL.20B & 21B: TG/15/03/2015-8664'],
    ['Sree Venkateshwara Medisolutions Private Limited', 'TS/MDL/2023-104202'],
    ['AK Medicals Private Limited', 'CIN: U47721TS2025PTC205896'],
  ];

  for (const [name, details] of suppliers) {
    insert.run(name, details);
  }
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

export function initDatabase() {
  if (db) return db;

  const userData = app.getPath('userData');
  fs.mkdirSync(userData, { recursive: true });
  const dbPath = path.join(userData, 'pharmacy-pos.sqlite');
  const isFirstRun = !fs.existsSync(dbPath);
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
      sgst_percent REAL DEFAULT 0,
      cgst_percent REAL DEFAULT 0,
      stock_qty INTEGER DEFAULT 0,
      reorder_level INTEGER DEFAULT 10,
      tablets_per_sheet INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      supplier_name TEXT,
      item_category TEXT DEFAULT 'Medicine',
      rack_number TEXT
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      details TEXT,
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
      amount REAL,
      discount REAL DEFAULT 0
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

  // Migration: add tablets_per_sheet column to existing databases
  const medColumns = db.prepare(`PRAGMA table_info(medicines)`).all();
  const hasTabletsPerSheet = medColumns.some((column) => column.name === 'tablets_per_sheet');
  if (!hasTabletsPerSheet) {
    db.exec(`ALTER TABLE medicines ADD COLUMN tablets_per_sheet INTEGER DEFAULT 0`);
  }

  const billItemsCols = db.prepare(`PRAGMA table_info(bill_items)`).all();
  if (!billItemsCols.some((col) => col.name === 'discount')) {
    db.exec(`ALTER TABLE bill_items ADD COLUMN discount REAL DEFAULT 0`);
  }
  if (!billItemsCols.some((col) => col.name === 'tablets_per_sheet')) {
    db.exec(`ALTER TABLE bill_items ADD COLUMN tablets_per_sheet INTEGER DEFAULT 0`);
  }
  if (!billItemsCols.some((col) => col.name === 'item_category')) {
    db.exec(`ALTER TABLE bill_items ADD COLUMN item_category TEXT DEFAULT 'Medicine'`);
  }

  const hasSupplierName = medColumns.some((column) => column.name === 'supplier_name');
  if (!hasSupplierName) {
    db.exec(`ALTER TABLE medicines ADD COLUMN supplier_name TEXT`);
  }

  const hasItemCategory = medColumns.some((column) => column.name === 'item_category');
  if (!hasItemCategory) {
    db.exec(`ALTER TABLE medicines ADD COLUMN item_category TEXT DEFAULT 'Medicine'`);
  }

  const hasRackNumber = medColumns.some((column) => column.name === 'rack_number');
  if (!hasRackNumber) {
    db.exec(`ALTER TABLE medicines ADD COLUMN rack_number TEXT DEFAULT ''`);
  }

  if (isFirstRun) {
    seedMedicines(db);
    seedSuppliers(db);
  }

  seedSettings(db);
  migrateDefaultShopSettings(db);
  
  // Custom migration for DHARVI SREE POLY CLINIC
  db.prepare(`UPDATE shop_settings SET shop_name = ?, phone = ?, paper_size = 'A5' WHERE id = 1`).run('DHARVI SREE POLY CLINIC', '+91 91 00 4382 23');
  
  return db;
}
