export function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function calculateLineItem(item, discountRatio = 1) {
  const qty = Number(item.qty || 0);
  const rate = Number(item.rate || 0);
  const baseAmount = round2(qty * rate);
  const discountedBase = round2(baseAmount * discountRatio);
  const sgstAmount = round2(discountedBase * (Number(item.sgst_percent || 0) / 100));
  const cgstAmount = round2(discountedBase * (Number(item.cgst_percent || 0) / 100));
  const lineTotal = round2(discountedBase + sgstAmount + cgstAmount);

  return {
    baseAmount,
    discountedBase,
    sgstAmount,
    cgstAmount,
    lineTotal,
  };
}

export function calculateBillTotals(items = [], discountPercent = 0) {
  const rawDiscount = Number(discountPercent || 0);
  const discountPercent_capped = Math.max(0, Math.min(100, rawDiscount));
  const subtotal = round2(items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.rate || 0), 0));
  const discountAmount = round2(subtotal * (discountPercent_capped / 100));
  const taxableAmount = round2(subtotal - discountAmount);
  const discountRatio = subtotal > 0 ? taxableAmount / subtotal : 1;

  let sgstTotal = 0;
  let cgstTotal = 0;
  let grandTotal = taxableAmount;

  const computedItems = items.map((item) => {
    const values = calculateLineItem(item, discountRatio);
    sgstTotal = round2(sgstTotal + values.sgstAmount);
    cgstTotal = round2(cgstTotal + values.cgstAmount);
    grandTotal = round2(grandTotal + values.sgstAmount + values.cgstAmount);
    return {
      ...item,
      amount: values.baseAmount,
      base_amount: values.baseAmount,
      sgst_amount: values.sgstAmount,
      cgst_amount: values.cgstAmount,
    };
  });

  const gstPercent = Number(computedItems[0]?.sgst_percent || 0);
  const gstFormula = `${taxableAmount.toFixed(2)}*${gstPercent}%+${gstPercent}%=${sgstTotal.toFixed(2)} SGST+${cgstTotal.toFixed(2)} CGST`;

  return {
    items: computedItems,
    subtotal,
    discountPercent: Number(discountPercent || 0),
    discountAmount,
    taxableAmount,
    sgstTotal,
    cgstTotal,
    grandTotal,
    gstFormula: '',
    discountPercent: discountPercent_capped,
  };
}
