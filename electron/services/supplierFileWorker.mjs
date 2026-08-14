import fs from 'node:fs/promises';
import path from 'node:path';

const EMPTY = String();

function ensurePdfDomPolyfills() {
  if (typeof globalThis.DOMMatrix !== 'function') {
    class DOMMatrixPolyfill {
      constructor(init) {
        this.a = 1;
        this.b = 0;
        this.c = 0;
        this.d = 1;
        this.e = 0;
        this.f = 0;
        this.m11 = 1;
        this.m12 = 0;
        this.m13 = 0;
        this.m14 = 0;
        this.m21 = 0;
        this.m22 = 1;
        this.m23 = 0;
        this.m24 = 0;
        this.m31 = 0;
        this.m32 = 0;
        this.m33 = 1;
        this.m34 = 0;
        this.m41 = 0;
        this.m42 = 0;
        this.m43 = 0;
        this.m44 = 1;
        this.is2D = true;
        this.isIdentity = true;
        if (Array.isArray(init) && init.length >= 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
          this.m11 = this.a;
          this.m12 = this.b;
          this.m21 = this.c;
          this.m22 = this.d;
          this.m41 = this.e;
          this.m42 = this.f;
          this.isIdentity = false;
        }
      }
      multiply() {
        return new DOMMatrixPolyfill();
      }
      inverse() {
        return new DOMMatrixPolyfill();
      }
      translate() {
        return new DOMMatrixPolyfill();
      }
      scale() {
        return new DOMMatrixPolyfill();
      }
      transformPoint(point) {
        return point || { x: 0, y: 0, z: 0, w: 1 };
      }
    }
    globalThis.DOMMatrix = DOMMatrixPolyfill;
  }

  if (typeof globalThis.ImageData !== 'function') {
    globalThis.ImageData = class ImageData {
      constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(Math.max(0, width * height * 4));
      }
    };
  }

  if (typeof globalThis.Path2D !== 'function') {
    globalThis.Path2D = class Path2D {};
  }
}

// Must run before pdf-parse/pdfjs load (Windows packaged apps often lack @napi-rs/canvas).
ensurePdfDomPolyfills();

function normalizeHeader(header) {
  return String(header || EMPTY)
    .replace(/^\uFEFF/, EMPTY)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, EMPTY);
}

function parseNumber(value, fallback = 0) {
  const normalized = String(value ?? EMPTY)
    .replace(/[\u20B9,\s]/g, EMPTY)
    .replace(/[^\d.-]/g, EMPTY)
    .trim();
  if (!normalized || normalized === '-' || normalized === '.') return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeExpiry(expiry) {
  const raw = String(expiry || EMPTY).trim().replace(/\s+/g, EMPTY);
  if (!raw || raw === '-' || raw === '--') return EMPTY;

  let match = raw.match(/^(\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (match) {
    const month = String(parseInt(match[1], 10)).padStart(2, '0');
    const year = match[2].length === 4 ? match[2].slice(-2) : match[2].padStart(2, '0');
    return month + '/' + year;
  }

  match = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (match) {
    const month = String(parseInt(match[2], 10)).padStart(2, '0');
    const year = match[3].length === 4 ? match[3].slice(-2) : match[3].padStart(2, '0');
    return month + '/' + year;
  }

  return raw;
}

function cleanProductName(name) {
  return String(name || EMPTY)
    .replace(/\(\d+(?:\.\d+)?\)\s*$/g, EMPTY)
    .replace(/\s+/g, ' ')
    .trim();
}

const FIELD_SYNONYMS = {
  name: ['item_name', 'product_name', 'product', 'medicine_name', 'medicine', 'item', 'particulars', 'description', 'drug_name', 'name'],
  pack: ['pack', 'pack_size', 'packing', 'pkg'],
  batch: ['batch', 'batch_no', 'batch_number', 'batchno', 'bno', 'lot', 'lot_no'],
  expiry: ['expiry', 'exp', 'exp_date', 'expiry_date', 'expdt', 'expire'],
  qty: ['qty', 'quantity', 'stock', 'stock_qty', 'qnty', 'bill_qty', 'inv_qty', 'nos'],
  free_qty: ['f_qty', 'free', 'free_qty', 'fqty', 'sch'],
  mrp: ['mrp', 'm_r_p', 'maximum_retail_price', 'retail_price'],
  rate: ['rate', 'srate', 'ftrate', 'ptr', 'pts', 'purchase_rate', 'buying_rate', 'cost', 'unit_rate', 'net_rate'],
  amount: ['amount', 'amt', 'value', 'taxable', 'net_amount', 'line_amount'],
  hsn_code: ['hsn', 'hsn_code', 'hsncode', 'sac'],
  rack_number: ['rack', 'rack_no', 'rack_number', 'location'],
  supplier_name: ['supplier_name', 'party_name', 'distributor', 'sold_by'],
};

function scoreHeader(header, synonyms) {
  const h = normalizeHeader(header);
  if (!h) return 0;
  if (synonyms.includes(h)) return 100;
  for (const syn of synonyms) {
    if (h.includes(syn) || syn.includes(h)) return 70;
  }
  return 0;
}

function mapHeaders(headers) {
  const mapping = {};
  const used = new Set();
  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    let best = { index: -1, score: 0 };
    headers.forEach((header, index) => {
      if (used.has(index)) return;
      const score = scoreHeader(header, synonyms);
      if (score > best.score) best = { index, score };
    });
    if (best.score >= 70) {
      mapping[field] = best.index;
      used.add(best.index);
    }
  }
  return mapping;
}

function getLowStockThreshold(stockQty) {
  const qty = parseNumber(stockQty, 0);
  if (qty <= 0) return 0;
  return Math.max(1, Math.ceil(qty * 0.2));
}

function rowFromMappedValues(values, mapping, meta = {}) {
  const get = (field) => {
    const index = mapping[field];
    if (index == null) return EMPTY;
    return String(values[index] ?? EMPTY).trim();
  };

  const qty = Math.round(parseNumber(get('qty')));
  const freeQty = Math.round(parseNumber(get('free_qty')));
  const stockQty = qty + freeQty;
  const name = cleanProductName(get('name'));
  if (!name || stockQty <= 0) return null;

  const mrp = parseNumber(get('mrp'));
  const rate = parseNumber(get('rate'));
  const amount = parseNumber(get('amount'));
  const purchaseRate = rate > 0 ? rate : amount > 0 && stockQty > 0 ? amount / stockQty : 0;

  return {
    name,
    pack: get('pack'),
    hsn_code: get('hsn_code'),
    batch: get('batch'),
    expiry: normalizeExpiry(get('expiry')),
    mrp,
    rate: purchaseRate,
    purchase_rate: purchaseRate,
    amount,
    stock_qty: stockQty,
    reorder_level: getLowStockThreshold(stockQty),
    tablets_per_sheet: 0,
    supplier_name: get('supplier_name') || meta.supplier_name || EMPTY,
    item_category: 'Medicine',
    rack_number: get('rack_number'),
    product_type: 'Ethical',
    combination: EMPTY,
  };
}

function parseTabularContent(rows, meta = {}) {
  if (!rows.length) return [];
  let headerIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 12); i += 1) {
    const mapping = mapHeaders(rows[i]);
    const score = Object.keys(mapping).length + (mapping.name != null ? 5 : 0) + (mapping.qty != null ? 3 : 0);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = i;
    }
  }
  const mapping = mapHeaders(rows[headerIndex]);
  if (mapping.name == null || mapping.qty == null) return [];
  const items = [];
  for (const values of rows.slice(headerIndex + 1)) {
    const item = rowFromMappedValues(values, mapping, meta);
    if (item) items.push(item);
  }
  return items;
}

function parsePdfInvoiceLines(text, meta = {}) {
  const lines = String(text || EMPTY)
    .split(/\n/)
    .map((line) => line.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const items = [];
  const seen = new Set();
  const patternA = new RegExp(
    '^([A-Z0-9]{3,})\\s+(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)\\s+([A-Z][A-Z0-9][A-Z0-9\\s\\-&./]*?)\\s+([A-Z0-9][A-Z0-9\\-/]*)\\s+(\\d{1,2}/\\d{2})\\s+(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)',
    'i',
  );

  for (const line of lines) {
    if (/total|taxable|gst%|sub\s*tot|net amount|round off|page no/i.test(line)) continue;
    const match = line.match(patternA);
    if (!match) continue;
    const stockQty = Math.round(parseNumber(match[2]) + parseNumber(match[3]));
    const item = {
      name: cleanProductName(match[4]),
      pack: EMPTY,
      hsn_code: EMPTY,
      batch: match[5],
      expiry: normalizeExpiry(match[6]),
      mrp: parseNumber(match[8]),
      rate: parseNumber(match[7]),
      purchase_rate: parseNumber(match[7]),
      amount: 0,
      stock_qty: stockQty,
      reorder_level: getLowStockThreshold(stockQty),
      tablets_per_sheet: 0,
      supplier_name: meta.supplier_name || EMPTY,
      item_category: 'Medicine',
      rack_number: match[1],
      product_type: 'Ethical',
      combination: EMPTY,
    };
    if (!item.name || item.stock_qty <= 0) continue;
    const key = item.name.toUpperCase() + '|' + String(item.batch).toUpperCase() + '|' + item.expiry;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}

async function parseExcel(filePath, meta) {
  const XLSX = await import('xlsx');
  const buffer = await fs.readFile(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: EMPTY,
    raw: false,
  });
  return parseTabularContent(rows, meta);
}

async function parsePdf(filePath, meta) {
  ensurePdfDomPolyfills();

  try {
    const canvas = await import('@napi-rs/canvas');
    if (canvas.DOMMatrix) globalThis.DOMMatrix = canvas.DOMMatrix;
    if (canvas.ImageData) globalThis.ImageData = canvas.ImageData;
    if (canvas.Path2D) globalThis.Path2D = canvas.Path2D;
  } catch {
    ensurePdfDomPolyfills();
  }

  const mod = await import('pdf-parse');
  const PDFParse = mod.PDFParse || mod.default?.PDFParse || mod.default;
  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return parsePdfInvoiceLines(result?.text || EMPTY, meta);
}

const filePath = process.argv[2];
const ext = String(process.argv[3] || path.extname(filePath || EMPTY)).toLowerCase();

(async () => {
  try {
    if (!filePath) throw new Error('Missing file path');
    const meta = { supplier_name: EMPTY };
    let items = [];
    if (ext === '.xlsx' || ext === '.xls') items = await parseExcel(filePath, meta);
    else if (ext === '.pdf') items = await parsePdf(filePath, meta);
    else throw new Error('Worker only handles PDF/Excel');
    process.send?.({ ok: true, items });
    process.exit(0);
  } catch (error) {
    process.send?.({ ok: false, error: error?.message || String(error) });
    process.exit(1);
  }
})();
