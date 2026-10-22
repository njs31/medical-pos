import { describe, expect, it } from 'vitest';
import {
  currentExpiryMonth,
  expiresInMonth,
  formatExpiryMonthLabel,
  getExpiryMonthKey,
  shiftExpiryMonth,
} from './expiryMonth.js';

describe('getExpiryMonthKey', () => {
  it('parses MM/YY into full year and month', () => {
    expect(getExpiryMonthKey('08/27')).toEqual({ year: 2027, month: 8 });
    expect(getExpiryMonthKey('12/26')).toEqual({ year: 2026, month: 12 });
  });

  it('accepts single-digit month', () => {
    expect(getExpiryMonthKey('1/27')).toEqual({ year: 2027, month: 1 });
  });

  it('returns null for invalid or empty expiry', () => {
    expect(getExpiryMonthKey('')).toBeNull();
    expect(getExpiryMonthKey(null)).toBeNull();
    expect(getExpiryMonthKey('invalid')).toBeNull();
    expect(getExpiryMonthKey('13/27')).toBeNull();
    expect(getExpiryMonthKey('00/27')).toBeNull();
  });
});

describe('expiresInMonth', () => {
  it('matches products in the selected month', () => {
    expect(expiresInMonth('10/26', 2026, 10)).toBe(true);
    expect(expiresInMonth('08/27', 2027, 8)).toBe(true);
  });

  it('does not match adjacent months', () => {
    expect(expiresInMonth('10/26', 2026, 9)).toBe(false);
    expect(expiresInMonth('10/26', 2026, 11)).toBe(false);
  });

  it('handles year boundary (Dec vs Jan)', () => {
    expect(expiresInMonth('12/26', 2026, 12)).toBe(true);
    expect(expiresInMonth('12/26', 2027, 1)).toBe(false);
    expect(expiresInMonth('01/27', 2027, 1)).toBe(true);
    expect(expiresInMonth('01/27', 2026, 12)).toBe(false);
  });

  it('returns false for invalid expiry', () => {
    expect(expiresInMonth('', 2026, 10)).toBe(false);
    expect(expiresInMonth('bad', 2026, 10)).toBe(false);
  });
});

describe('currentExpiryMonth', () => {
  it('returns the calendar month for the given date', () => {
    expect(currentExpiryMonth(new Date(2026, 9, 22))).toEqual({ year: 2026, month: 10 });
    expect(currentExpiryMonth(new Date(2026, 0, 1))).toEqual({ year: 2026, month: 1 });
  });
});

describe('formatExpiryMonthLabel', () => {
  it('formats a readable label', () => {
    expect(formatExpiryMonthLabel(2026, 10)).toBe('October 2026');
    expect(formatExpiryMonthLabel(2027, 1)).toBe('January 2027');
  });

  it('returns empty string for invalid input', () => {
    expect(formatExpiryMonthLabel(2026, 0)).toBe('');
    expect(formatExpiryMonthLabel(2026, 13)).toBe('');
  });
});

describe('shiftExpiryMonth', () => {
  it('moves forward and backward across year boundary', () => {
    expect(shiftExpiryMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftExpiryMonth({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
  });
});
