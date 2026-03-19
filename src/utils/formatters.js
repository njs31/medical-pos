export function formatCurrency(value = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function todayIso() {
  const now = new Date();
  const tz = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tz).toISOString().slice(0, 10);
}

export function parseExpiry(expiry) {
  const [month, year] = String(expiry || '').split('/').map(Number);
  if (!month || !year) return null;
  return new Date(2000 + year, month, 0);
}

export function isExpired(expiry) {
  const date = parseExpiry(expiry);
  if (!date) return false;
  return date < new Date();
}

export function isExpiringWithin(expiry, days = 60) {
  const date = parseExpiry(expiry);
  if (!date) return false;
  const now = new Date();
  const end = new Date();
  end.setDate(now.getDate() + days);
  return date >= now && date <= end;
}
