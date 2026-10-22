/**
 * Helpers for browsing products by expiry calendar month (MM/YY storage).
 */

/**
 * @param {string} expiry - e.g. "08/27" or "8/27"
 * @returns {{ year: number, month: number } | null} full year + 1–12 month
 */
export function getExpiryMonthKey(expiry) {
  const raw = String(expiry || '').trim();
  if (!raw) return null;
  const parts = raw.split('/');
  if (parts.length !== 2) return null;
  const month = Number(parts[0]);
  let year = Number(parts[1]);
  if (!Number.isFinite(month) || !Number.isFinite(year)) return null;
  if (month < 1 || month > 12) return null;
  if (year < 0) return null;
  // Two-digit years → 2000+YY (same as parseExpiry)
  if (year < 100) year = 2000 + year;
  return { year, month };
}

/**
 * True when the product's expiry month/year equals the given calendar month.
 */
export function expiresInMonth(expiry, year, month) {
  const key = getExpiryMonthKey(expiry);
  if (!key) return false;
  return key.year === Number(year) && key.month === Number(month);
}

/**
 * Current local calendar month for the expiry picker default.
 */
export function currentExpiryMonth(now = new Date()) {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatExpiryMonthLabel(year, month) {
  const m = Number(month);
  const y = Number(year);
  if (!Number.isFinite(m) || m < 1 || m > 12 || !Number.isFinite(y)) return '';
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Shift a { year, month } by delta months (can be negative). */
export function shiftExpiryMonth({ year, month }, delta = 1) {
  const d = new Date(Number(year), Number(month) - 1 + Number(delta), 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
