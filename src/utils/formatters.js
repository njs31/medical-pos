export function formatCurrency(value = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPlainNumber(value = 0) {
  const quantity = Number(value) || 0;
  return Number.isInteger(quantity) ? String(quantity) : String(Number(quantity.toFixed(2)));
}

function parseIsoDateOnly(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return { year, month, day };
}

function parseSqliteTimestampUtc(value) {
  const match = String(value || '').match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!match) return null;
  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  return new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ));
}

export function formatDate(value) {
  if (!value) return '';
  const isoDate = parseIsoDateOnly(value);
  if (isoDate) {
    return `${isoDate.day}/${isoDate.month}/${isoDate.year}`;
  }

  const sqliteDate = parseSqliteTimestampUtc(value);
  if (sqliteDate) {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(sqliteDate);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatBillTime(value) {
  if (!value) return '';

  const sqliteDate = parseSqliteTimestampUtc(value);
  if (sqliteDate) {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(sqliteDate);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function todayIso() {
  const now = new Date();
  const tz = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tz).toISOString().slice(0, 10);
}

export function normalizeExpiry(expiry) {
  const parts = String(expiry || '').split('/');
  if (parts.length !== 2) return String(expiry || '').trim();
  const m = parseInt(parts[0], 10);
  const y = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(y)) return String(expiry || '').trim();
  const formattedMonth = String(m).padStart(2, '0');
  const formattedYear = String(y).length === 4 ? String(y).slice(-2) : String(y).padStart(2, '0');
  return `${formattedMonth}/${formattedYear}`;
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

export function isExpiringWithin(expiry, days = 90) {
  const date = parseExpiry(expiry);
  if (!date) return false;
  const now = new Date();
  const end = new Date();
  end.setDate(now.getDate() + days);
  return date >= now && date <= end;
}

export function getQuantityBreakdown(qty, tps, itemCategory = 'Medicine') {
  const quantity = Number(qty) || 0;
  const perSheet = Number(tps) || 0;
  const usesSheets = itemCategory === 'Medicine' && perSheet > 0;

  if (!usesSheets) {
    return {
      quantity,
      perSheet,
      usesSheets: false,
      sheets: 0,
      tablets: quantity,
      compact: formatPlainNumber(quantity),
    };
  }

  const sheets = Math.floor(quantity / perSheet);
  const tablets = quantity % perSheet;

  let compact = `${sheets}S, ${tablets}T`;
  if (sheets === 0) compact = `${tablets}T`;
  if (tablets === 0) compact = `${sheets}S`;

  return {
    quantity,
    perSheet,
    usesSheets: true,
    sheets,
    tablets,
    compact,
  };
}

export function formatInventoryQty(qty, tps, itemCategory = 'Medicine') {
  const breakdown = getQuantityBreakdown(qty, tps, itemCategory);
  if (!breakdown.usesSheets) return breakdown.compact;
  return `${breakdown.compact} / ${formatPlainNumber(breakdown.quantity)}`;
}

export function formatBillQty(qty, tps, itemCategory = 'Medicine') {
  return getQuantityBreakdown(qty, tps, itemCategory).compact;
}

export function getPurchaseCostTooltip(purchaseRate, tps, itemCategory = 'Medicine') {
  const unitCost = Number(purchaseRate) || 0;
  const perSheet = Number(tps) || 0;

  if (itemCategory === 'Medicine' && perSheet > 0) {
    return `Purchase cost\nPer sheet: ${formatCurrency(unitCost * perSheet)}\nPer tablet: ${formatCurrency(unitCost)}`;
  }

  return `Purchase cost\nPer quantity: ${formatCurrency(unitCost)}`;
}
