import { getDb } from './db.js';

export function getAllSuppliers() {
  const db = getDb();
  return db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all();
}

export function addSupplier(supplier) {
  const db = getDb();
  const { name, details } = supplier;
  const result = db.prepare('INSERT INTO suppliers (name, details) VALUES (?, ?)').run(name, details);
  return { id: result.lastInsertRowid, ...supplier };
}

export function updateSupplier(id, supplier) {
  const db = getDb();
  const { name, details } = supplier;
  db.prepare('UPDATE suppliers SET name = ?, details = ? WHERE id = ?').run(name, details, id);
  return { id, ...supplier };
}

export function deleteSupplier(id) {
  const db = getDb();
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
  return { success: true };
}
