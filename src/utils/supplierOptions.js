/** Same rule as the purchase log: ignore case and extra spaces. */
export function supplierKey(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Every distributor the shop knows: saved suppliers (Settings) first, plus any
 * supplier name already used on stock. One entry per distributor, sorted A–Z.
 */
export function buildSupplierOptions(savedSuppliers = [], usedNames = []) {
  const byKey = new Map();
  for (const supplier of savedSuppliers) {
    const key = supplierKey(supplier?.name);
    if (key && !byKey.has(key)) byKey.set(key, { name: String(supplier.name).trim(), saved: true });
  }
  for (const name of usedNames) {
    const key = supplierKey(name);
    if (key && !byKey.has(key)) byKey.set(key, { name: String(name).trim().replace(/\s+/g, ' '), saved: false });
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** The known spelling for a typed/detected name, or null if it is a new distributor. */
export function findSupplierOption(options, name) {
  const key = supplierKey(name);
  if (!key) return null;
  return options.find((option) => supplierKey(option.name) === key) || null;
}
