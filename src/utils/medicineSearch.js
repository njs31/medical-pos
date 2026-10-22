/**
 * Local medicine search — filters an in-memory catalogue so bill/inventory
 * search never depends on a racing IPC round-trip.
 */
export function filterMedicines(catalog, query, limit = 50) {
  const tokens = String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);

  if (!tokens.length || !Array.isArray(catalog) || catalog.length === 0) {
    return [];
  }

  const matched = [];
  for (const item of catalog) {
    const haystack = [
      item.name,
      item.hsn_code,
      item.batch,
      item.supplier_name,
      item.combination,
    ]
      .map((v) => String(v || '').toLowerCase())
      .join(' ');

    if (!tokens.every((token) => haystack.includes(token))) continue;
    matched.push(item);
  }

  matched.sort((a, b) => {
    const stockA = Number(a.stock_qty) > 0 ? 0 : 1;
    const stockB = Number(b.stock_qty) > 0 ? 0 : 1;
    if (stockA !== stockB) return stockA - stockB;
    return String(a.name || '').localeCompare(String(b.name || ''), undefined, {
      sensitivity: 'base',
    });
  });

  return matched.slice(0, limit);
}
