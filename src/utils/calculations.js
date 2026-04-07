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

  const computedItems = items.map((item) => {
    const qty = Number(item.qty || 0);
    const rate = Number(item.rate || 0);
    const itemDisc = Number(item.discount || 0);
    const base_amount = round2(qty * rate);
    const itemDiscountAmount = round2(base_amount * (itemDisc / 100));
    const amount = round2(base_amount - itemDiscountAmount);

    return {
      ...item,
      discount: itemDisc,
      base_amount,
      amount,
    };
  });

  const subtotal = round2(computedItems.reduce((sum, item) => sum + item.base_amount, 0));
  const subtotalAfterItemDiscounts = round2(computedItems.reduce((sum, item) => sum + item.amount, 0));
  const globalDiscountAmount = round2(subtotalAfterItemDiscounts * (globalDiscountPercent_capped / 100));
  
  const totalDiscountAmount = round2((subtotal - subtotalAfterItemDiscounts) + globalDiscountAmount);
  const grandTotal = round2(subtotalAfterItemDiscounts - globalDiscountAmount);

  return {
    items: computedItems,
    subtotal,
    discountPercent: globalDiscountPercent_capped,
    discountAmount: totalDiscountAmount,
    grandTotal,
  };
}
