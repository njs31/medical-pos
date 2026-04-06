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
  const discountPercent_capped = Math.max(0, Math.min(100, rawDiscount));
  const subtotal = round2(items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.rate || 0), 0));
  const discountAmount = round2(subtotal * (discountPercent_capped / 100));
  const grandTotal = round2(subtotal - discountAmount);

  const computedItems = items.map((item) => {
    const values = calculateLineItem(item);
    return {
      ...item,
      amount: values.baseAmount,
      base_amount: values.baseAmount,
    };
  });

  return {
    items: computedItems,
    subtotal,
    discountPercent: discountPercent_capped,
    discountAmount,
    grandTotal,
  };
}
