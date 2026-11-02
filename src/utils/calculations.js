export function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function calculateLineItem(item) {
  const qty = Number(item.qty || 0);
  const rate = Number(item.rate || 0);
  const baseAmount = round2(qty * rate);

  return {
    baseAmount,
  };
}

export function calculateBillTotals(items = [], discountPercent = 0) {
  const rawDiscount = Number(discountPercent || 0);
  const globalDiscountPercent_capped = Math.max(0, Math.min(100, rawDiscount));
  const globalFactor = 1 - globalDiscountPercent_capped / 100;

  const computedItems = items.map((item) => {
    const qty = Number(item.qty || 0);
    const rate = Number(item.rate || 0);
    const purchaseRate = Number(item.purchase_rate || 0);
    const hasCost = purchaseRate > 0;
    const itemDisc = Math.max(0, Math.min(100, Number(item.discount || 0)));
    const base_amount = round2(qty * rate);
    const itemDiscountAmount = round2(base_amount * (itemDisc / 100));
    const amount = round2(base_amount - itemDiscountAmount);
    const finalAmount = round2(amount * globalFactor);
    // Profit = what you sell for − what you paid (purchase cost).
    // If purchase cost is missing, do NOT treat full amount as profit.
    const totalCost = hasCost ? round2(qty * purchaseRate) : 0;
    const profit = hasCost ? round2(finalAmount - totalCost) : null;
    const profitMargin =
      hasCost && finalAmount > 0 ? round2((profit / finalAmount) * 100) : null;

    return {
      ...item,
      discount: itemDisc,
      base_amount,
      amount,
      has_cost: hasCost,
      total_cost: totalCost,
      profit,
      profit_margin: profitMargin,
    };
  });

  const subtotal = round2(computedItems.reduce((sum, item) => sum + item.base_amount, 0));
  const subtotalAfterItemDiscounts = round2(computedItems.reduce((sum, item) => sum + item.amount, 0));
  const globalDiscountAmount = round2(subtotalAfterItemDiscounts * (globalDiscountPercent_capped / 100));

  const totalDiscountAmount = round2((subtotal - subtotalAfterItemDiscounts) + globalDiscountAmount);
  const grandTotal = round2(subtotalAfterItemDiscounts - globalDiscountAmount);
  const totalCost = round2(computedItems.reduce((sum, item) => sum + item.total_cost, 0));
  const itemsWithCost = computedItems.filter((item) => item.has_cost);
  const hasAnyCost = itemsWithCost.length > 0;
  // Only sum profit for lines that have a known purchase cost.
  const totalProfit = hasAnyCost
    ? round2(itemsWithCost.reduce((sum, item) => sum + (Number(item.profit) || 0), 0))
    : null;
  const revenueWithCost = round2(itemsWithCost.reduce((sum, item) => {
    const itemDisc = Math.max(0, Math.min(100, Number(item.discount || 0)));
    const base = round2(Number(item.qty || 0) * Number(item.rate || 0));
    const afterItemDisc = round2(base * (1 - itemDisc / 100));
    return sum + round2(afterItemDisc * globalFactor);
  }, 0));
  const totalProfitMargin =
    hasAnyCost && revenueWithCost > 0 ? round2((totalProfit / revenueWithCost) * 100) : null;

  return {
    items: computedItems,
    subtotal,
    discountPercent: globalDiscountPercent_capped,
    discountAmount: totalDiscountAmount,
    grandTotal,
    totalCost,
    totalProfit,
    totalProfitMargin,
  };
}
