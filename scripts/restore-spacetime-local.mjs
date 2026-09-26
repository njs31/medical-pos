import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.homedir(), 'Library/Application Support/pharmacy-pos/pharmacy-pos.sqlite');
const snapshotPath = path.resolve('tmp/spacetime-snapshot.json');
const token = process.env.SPACETIME_TOKEN || '';

if (!fs.existsSync(snapshotPath)) {
  console.error('Missing snapshot at', snapshotPath);
  process.exit(1);
}

const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF');

function cols(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

function insertRows(table, rows) {
  if (!rows?.length) return 0;
  const columns = cols(table).filter((c) => Object.prototype.hasOwnProperty.call(rows[0], c));
  if (!columns.length) return 0;
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((c) => `@${c}`).join(', ')})`;
  const stmt = db.prepare(sql);
  for (const row of rows) {
    const payload = {};
    for (const c of columns) payload[c] = row[c] ?? null;
    stmt.run(payload);
  }
  return rows.length;
}

const counts = db.transaction(() => {
  for (const t of [
    'bill_items',
    'emergency_bill_items',
    'bills',
    'emergency_bills',
    'medicines',
    'suppliers',
    'shop_settings',
    'stock_checkpoints',
  ]) {
    try {
      db.exec(`DELETE FROM ${t}`);
    } catch {
      // table may not exist yet
    }
  }

  const result = {
    medicines: insertRows('medicines', snapshot.medicines),
    suppliers: insertRows('suppliers', snapshot.suppliers),
    bills: insertRows('bills', snapshot.bills),
    bill_items: insertRows('bill_items', snapshot.bill_items),
    emergency_bills: insertRows('emergency_bills', snapshot.emergency_bills),
    emergency_bill_items: insertRows('emergency_bill_items', snapshot.emergency_bill_items),
  };

  insertRows(
    'shop_settings',
    snapshot.shop_settings?.length ? snapshot.shop_settings : [{ id: 1, shop_name: 'FIRST CARE MEDICALS' }],
  );

  db.prepare(`
    UPDATE shop_settings SET
      spacetime_host = ?,
      spacetime_database = ?,
      spacetime_token = ?,
      backup_device_id = COALESCE(NULLIF(backup_device_id, ''), ?)
    WHERE id = 1
  `).run(
    'https://maincloud.spacetimedb.com',
    'medical-pos-backup',
    token,
    '3e9ebebf-59f8-4207-a9b3-25143924cdfb',
  );

  return result;
})();

db.pragma('foreign_keys = ON');
db.pragma('wal_checkpoint(TRUNCATE)');

const verify = {
  medicines: db.prepare('SELECT COUNT(*) as c FROM medicines').get().c,
  bills: db.prepare('SELECT COUNT(*) as c FROM bills').get().c,
  shop: db.prepare('SELECT shop_name, spacetime_database FROM shop_settings WHERE id = 1').get(),
};
db.close();

console.log(JSON.stringify({ ok: true, exported_at: snapshot.exported_at, counts, verify }, null, 2));
