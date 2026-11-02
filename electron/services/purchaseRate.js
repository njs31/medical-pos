/**
 * Cost = what you pay the supplier per unit.
 * MRP = what you sell at.
 * Reject barcodes, line totals, and mis-mapped columns.
 */
export function resolvePurchaseRate({ rate = 0, amount = 0, qty = 0, mrp = 0 } = {}) {
  const candidates = [];
  if (rate > 0) candidates.push(rate);
  if (amount > 0 && qty > 0) candidates.push(amount / qty);

  for (const candidate of candidates) {
    const cost = Number(candidate);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    // Barcode / HSN / invoice totals are usually large integers with no paise.
    if (cost >= 10000 && Number.isInteger(cost)) continue;
    if (mrp > 0 && cost > mrp * 1.01) continue;
    return Number(cost.toFixed(4));
  }
  return 0;
}
