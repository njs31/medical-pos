const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const dateFormatterIst = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

const dateFormatterLocal = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const timeFormatterIst = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

export function formatCurrency(value = 0) {
  return currencyFormatter.format(Number(value || 0));
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

const formattedDateCache = new Map();
const formattedTimeCache = new Map();

export function formatDate(value) {
  if (!value) return '';
  const cached = formattedDateCache.get(value);
  if (cached !== undefined) return cached;

  const isoDate = parseIsoDateOnly(value);
  let result;
  if (isoDate) {
    result = `${isoDate.day}/${isoDate.month}/${isoDate.year}`;
  } else {
    const sqliteDate = parseSqliteTimestampUtc(value);
    if (sqliteDate) {
      result = dateFormatterIst.format(sqliteDate);
    } else {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        result = value;
      } else {
        result = dateFormatterLocal.format(date);
      }
    }
  }

  if (formattedDateCache.size > 5000) formattedDateCache.clear();
  formattedDateCache.set(value, result);
  return result;
}

export function formatBillTime(value) {
  if (!value) return '';
  const cached = formattedTimeCache.get(value);
  if (cached !== undefined) return cached;

  let result;
  const sqliteDate = parseSqliteTimestampUtc(value);
  if (sqliteDate) {
    result = timeFormatterIst.format(sqliteDate);
  } else {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      result = String(value);
    } else {
      result = timeFormatterIst.format(date);
    }
  }

  if (formattedTimeCache.size > 5000) formattedTimeCache.clear();
  formattedTimeCache.set(value, result);
  return result;
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

const expiryCache = new Map();
export function parseExpiry(expiry) {
  const key = String(expiry || '');
  if (expiryCache.has(key)) return expiryCache.get(key);
  const [month, year] = key.split('/').map(Number);
  const result = !month || !year ? null : new Date(2000 + year, month, 0);
  if (expiryCache.size > 5000) expiryCache.clear();
  expiryCache.set(key, result);
  return result;
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
