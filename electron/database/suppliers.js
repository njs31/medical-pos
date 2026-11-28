import { getDb } from './db.js';

export function getAllSuppliers() {
  const db = getDb();
  return db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all();
}

function nameKey(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Adds a supplier, or returns the existing one if the name is already saved (any case/spacing). */
export function addSupplier(supplier) {
  const db = getDb();
  const name = String(supplier?.name || '').trim().replace(/\s+/g, ' ');
  const details = supplier?.details ?? '';
  if (!name) throw new Error('Supplier name is required');

  const existing = db
    .prepare('SELECT * FROM suppliers')
    .all()
    .find((row) => nameKey(row.name) === nameKey(name));
  if (existing) return { ...existing, existed: true };

  const result = db.prepare('INSERT INTO suppliers (name, details) VALUES (?, ?)').run(name, details);
  return { id: Number(result.lastInsertRowid), name, details, existed: false };
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
