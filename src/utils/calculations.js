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
    const itemDisc = Math.max(0, Math.min(100, Number(item.discount || 0)));
    const base_amount = round2(qty * rate);
    const itemDiscountAmount = round2(base_amount * (itemDisc / 100));
    const amount = round2(base_amount - itemDiscountAmount);
    const finalAmount = round2(amount * globalFactor);
    const totalCost = round2(qty * purchaseRate);
    const profit = round2(finalAmount - totalCost);
    const profitMargin = finalAmount > 0 ? round2((profit / finalAmount) * 100) : 0;

    return {
      ...item,
      discount: itemDisc,
      base_amount,
      amount,
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
  const totalProfit = round2(grandTotal - totalCost);
  const totalProfitMargin = grandTotal > 0 ? round2((totalProfit / grandTotal) * 100) : 0;

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
