import { describe, expect, it } from 'vitest';
import { resolvePurchaseRate } from './purchaseRate.js';

describe('resolvePurchaseRate', () => {
  it('uses supplier unit rate when it is below MRP', () => {
    expect(resolvePurchaseRate({ rate: 32.18, mrp: 42.24 })).toBe(32.18);
    expect(resolvePurchaseRate({ rate: 160, mrp: 210 })).toBe(160);
  });

  it('rejects barcode-like costs that dwarf MRP', () => {
    expect(resolvePurchaseRate({ rate: 102836, mrp: 480 })).toBe(0);
    expect(resolvePurchaseRate({ rate: 1128154, mrp: 202.39 })).toBe(0);
  });

  it('falls back to amount/qty when unit rate is missing', () => {
    expect(resolvePurchaseRate({ rate: 0, amount: 320, qty: 10, mrp: 42 })).toBe(32);
  });

  it('rejects amount/qty fallback when it exceeds MRP', () => {
    expect(resolvePurchaseRate({ rate: 0, amount: 5000, qty: 1, mrp: 480 })).toBe(0);
  });
});
