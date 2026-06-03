import { getDb } from './db.js';

export function exportAllData() {
  const database = getDb();

  return {
    exported_at: new Date().toISOString(),
    medicines: database.prepare('SELECT * FROM medicines ORDER BY id ASC').all(),
    suppliers: database.prepare('SELECT * FROM suppliers ORDER BY id ASC').all(),
    bills: database.prepare('SELECT * FROM bills ORDER BY id ASC').all(),
    bill_items: database.prepare('SELECT * FROM bill_items ORDER BY id ASC').all(),
    emergency_bills: database.prepare('SELECT * FROM emergency_bills ORDER BY id ASC').all(),
    emergency_bill_items: database.prepare('SELECT * FROM emergency_bill_items ORDER BY id ASC').all(),
    shop_settings: database.prepare('SELECT * FROM shop_settings ORDER BY id ASC').all(),
  };
}

export function getExportCounts(snapshot) {
  return {
    medicines: snapshot.medicines?.length || 0,
    suppliers: snapshot.suppliers?.length || 0,
    bills: snapshot.bills?.length || 0,
    bill_items: snapshot.bill_items?.length || 0,
    emergency_bills: snapshot.emergency_bills?.length || 0,
    emergency_bill_items: snapshot.emergency_bill_items?.length || 0,
  };
}
