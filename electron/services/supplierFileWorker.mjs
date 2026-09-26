import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const EMPTY = String();

/**
 * Plain Node (ELECTRON_RUN_AS_NODE) ignores NODE_PATH for ESM imports and cannot
 * read app.asar. Resolve packages from the unpacked node_modules path passed by the bridge.
 */
async function importDependency(packageName) {
  const roots = [
    process.env.SUPPLIER_IMPORT_NODE_MODULES,
    path.join(process.cwd(), 'node_modules'),
  ].filter(Boolean);

  for (const root of roots) {
    const pkgJsonPath = path.join(root, packageName, 'package.json');
    if (!fsSync.existsSync(pkgJsonPath)) continue;
    try {
      const require = createRequire(pkgJsonPath);
      return require(packageName);
    } catch {
      try {
        const pkg = JSON.parse(fsSync.readFileSync(pkgJsonPath, 'utf8'));
        const entry =
          pkg.module ||
          pkg.exports?.['.']?.import ||
          pkg.exports?.['.']?.default ||
          pkg.exports?.['.'] ||
          pkg.main ||
          'index.js';
        const entryPath = path.resolve(path.dirname(pkgJsonPath), Array.isArray(entry) ? entry[0] : entry);
        return await import(pathToFileURL(entryPath).href);
      } catch {
        /* try next root */
      }
    }
  }

  try {
    return await import(packageName);
  } catch (error) {
    throw new Error(
      `Missing dependency "${packageName}". ` +
        `Looked in: ${roots.join(', ') || '(none)'}. ` +
        `${error?.message || error}`,
    );
  }
}

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
    .replace(/^﻿/, EMPTY)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, EMPTY);
}

function parseNumber(value, fallback = 0) {
  const normalized = String(value ?? EMPTY)
    .replace(/[₹,\s]/g, EMPTY)
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

  // Textual months: JUN-28, 06 JUN 2028
  match = raw.match(/^(\d{0,2})[\-\/\s]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\-\/\s]?(\d{2,4})$/i);
  if (match) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const month = String(months.indexOf(match[2].toLowerCase()) + 1).padStart(2, '0');
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
  name: [
    'item_name', 'itemname', 'product_name', 'productname', 'prod_name', 'prodname', 'product', 'medicine_name',
    'medicine', 'item', 'items', 'particulars', 'particular', 'description', 'item_description', 'drug_name',
    'name', 'goods_description', 'product_description',
  ],
  pack: ['pack', 'pack_size', 'packing', 'pkg', 'pck', 'packsize', 'unit'],
  batch: ['batch', 'batch_no', 'batch_number', 'batchno', 'bno', 'b_no', 'lot', 'lot_no', 'lotno', 'batch_code'],
  expiry: ['expiry', 'exp', 'exp_date', 'expiry_date', 'expdt', 'exp_dt', 'expire', 'expdate', 'exp_month'],
  qty: ['qty', 'quantity', 'stock', 'stock_qty', 'qnty', 'bill_qty', 'inv_qty', 'nos', 'pcs', 'qty_strip', 'issue_qty'],
  free_qty: ['f_qty', 'free', 'free_qty', 'fqty', 'fq', 'sch', 'scheme', 'sch_qty', 'bonus'],
  mrp: ['mrp', 'm_r_p', 'maximum_retail_price', 'retail_price', 'mrp_rs', 'mrp_rate'],
  rate: [
    'rate', 'srate', 'ftrate', 'ptr', 'pts', 'p_rate', 'prate', 'purchase_rate', 'purch_rate', 'buying_rate',
    'cost', 'unit_rate', 'net_rate', 'trade_rate', 'basic_rate',
  ],
  amount: ['amount', 'amt', 'value', 'taxable', 'net_amount', 'line_amount', 'total', 'net_value', 'taxable_value'],
  hsn_code: ['hsn', 'hsn_code', 'hsncode', 'hsn_sac', 'sac'],
  rack_number: ['rack', 'rack_no', 'rack_number', 'location', 'shelf'],
  supplier_name: ['supplier_name', 'supplier', 'party_name', 'distributor', 'sold_by', 'company', 'mfr', 'mfg'],
};

// Fields where a loose partial match causes more harm than a miss.
const EXACT_FIELDS = new Set(['batch', 'expiry', 'qty', 'mrp', 'hsn_code']);

function scoreHeader(header, synonyms, { exactOnly = false } = {}) {
  const h = normalizeHeader(header);
  if (!h) return 0;
  if (synonyms.includes(h)) return 100;
  if (exactOnly) return 0;
  for (const syn of synonyms) {
    const hParts = h.split('_');
    const sParts = syn.split('_');
    if (hParts.some((part) => sParts.includes(part) && part.length > 2)) return 60;
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
      const score = scoreHeader(header, synonyms, { exactOnly: EXACT_FIELDS.has(field) });
      if (score > best.score) best = { index, score };
    });
    const threshold = EXACT_FIELDS.has(field) ? 100 : 60;
    if (best.score >= threshold) {
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

const JUNK_LINE = /(sub\s*total|grand\s*total|total\s*(amount|qty|value)?\s*[:=]?\s*$|taxable|gst\s*%|cgst|sgst|igst|round\s*off|net\s*amount|amount\s*in\s*words|page\s*\d|terms|declaration|signature|bank\s*detail|e\s*&\s*o\.?e|goods once sold|drug\s*lic|gstin|d\.?l\.?\s*no|invoice\s*no|bill\s*no|phone|mobile|email)/i;

const LOOKS_LIKE_DATE = /^\d{1,2}[\/\-.]\d{1,2}([\/\-.]\d{2,4})?$|^\d{1,2}[\/\-.]\d{2,4}$/;
const EXPIRY_TOKEN = /^(0?[1-9]|1[0-2])[\/\-](\d{2}|\d{4})$|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$|^\d{0,2}[\-\s]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\-\s]?\d{2,4}$/i;
const MONEY_TOKEN = /^\d{1,7}\.\d{1,3}$/;
const INT_TOKEN = /^\d{1,5}$/;
const HSN_TOKEN = /^\d{6,8}$/;

function looksLikeProductName(value) {
  const v = String(value || EMPTY).trim();
  if (v.length < 3) return false;
  if (LOOKS_LIKE_DATE.test(v)) return false;
  if (/^\d+(\.\d+)?$/.test(v)) return false;
  // Needs a run of letters, e.g. DOLO, Augmentin.
  return /[A-Za-z]{3,}/.test(v);
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
  if (!looksLikeProductName(name)) return null;
  if (JUNK_LINE.test(name)) return null;

  const mrp = parseNumber(get('mrp'));
  const rate = parseNumber(get('rate'));
  const amount = parseNumber(get('amount'));
  const purchaseRate = rate > 0 ? rate : amount > 0 && stockQty > 0 ? amount / stockQty : 0;
  if (stockQty <= 0) return null;

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
    free_qty: freeQty,
    reorder_level: getLowStockThreshold(stockQty),
    tablets_per_sheet: 0,
    supplier_name: get('supplier_name') || meta.supplier_name || EMPTY,
    item_category: 'Medicine',
    rack_number: get('rack_number'),
    product_type: 'Ethical',
    combination: EMPTY,
  };
}

/**
 * Some invoices print the product name on one line and its batch/qty/rate on
 * the next. A name with no quantity followed by a quantity with no name is one
 * logical row, so fold the pair together.
 */
function mergeWrappedRows(rows, mapping) {
  const out = [];
  for (const cells of rows) {
    const row = [...cells];
    const name = String(row[mapping.name] ?? EMPTY).trim();
    const qty = String(row[mapping.qty] ?? EMPTY).trim();
    const pending = out[out.length - 1];

    if (qty && pending) {
      const pendingName = String(pending[mapping.name] ?? EMPTY).trim();
      const pendingQty = String(pending[mapping.qty] ?? EMPTY).trim();
      // The line above carries a product name but no numbers: this line completes it.
      if (pendingName && !pendingQty && looksLikeProductName(pendingName)) {
        const width = Math.max(pending.length, row.length);
        for (let i = 0; i < width; i += 1) {
          if (i === mapping.name) continue; // keep the name from the line above
          const incoming = String(row[i] ?? EMPTY).trim();
          if (incoming && !String(pending[i] ?? EMPTY).trim()) pending[i] = incoming;
        }
        continue;
      }
    }
    out.push(row);
  }
  return out;
}

function parseTabularContent(rows, meta = {}) {
  if (!rows.length) return [];
  let headerIndex = -1;
  let bestScore = 2;
  const limit = Math.min(rows.length, 25);
  for (let i = 0; i < limit; i += 1) {
    const mapping = mapHeaders(rows[i]);
    const score =
      Object.keys(mapping).length + (mapping.name != null ? 5 : 0) + (mapping.qty != null ? 3 : 0);
    if (mapping.name != null && mapping.qty != null && score > bestScore) {
      bestScore = score;
      headerIndex = i;
    }
  }
  if (headerIndex < 0) return [];

  const mapping = mapHeaders(rows[headerIndex]);
  const items = [];
  for (const values of mergeWrappedRows(rows.slice(headerIndex + 1), mapping)) {
    const joined = values.join(' ');
    if (JUNK_LINE.test(joined) && !looksLikeProductName(values[mapping.name] || EMPTY)) continue;
    const item = rowFromMappedValues(values, mapping, meta);
    if (item) items.push(item);
  }
  return items;
}

/**
 * Header-free fallback: classify each token on a line by shape, so a layout we
 * have never seen still yields rows. Money/integer/expiry/batch tokens are
 * identified by pattern, then the amount column is spotted by reconciling
 * qty x rate, leaving MRP (higher) and rate (lower).
 */
function rowFromLooseTokens(tokens, meta = {}) {
  const cells = tokens.map((t) => String(t || EMPTY).trim()).filter(Boolean);
  if (cells.length < 4) return null;

  let expiry = EMPTY;
  const moneys = [];
  const ints = [];
  const words = [];
  let hsn = EMPTY;
  const leftovers = [];

  for (const cell of cells) {
    if (!expiry && EXPIRY_TOKEN.test(cell)) {
      expiry = normalizeExpiry(cell);
      continue;
    }
    if (MONEY_TOKEN.test(cell)) {
      moneys.push(parseNumber(cell));
      continue;
    }
    if (HSN_TOKEN.test(cell) && !hsn) {
      hsn = cell;
      continue;
    }
    if (INT_TOKEN.test(cell)) {
      ints.push(parseNumber(cell));
      continue;
    }
    if (looksLikeProductName(cell)) {
      words.push(cell);
      continue;
    }
    leftovers.push(cell);
  }

  // Longest word-ish cell is the product; short codes are batch candidates.
  words.sort((a, b) => b.length - a.length);
  const name = cleanProductName(words[0] || EMPTY);
  if (!looksLikeProductName(name) || JUNK_LINE.test(name)) return null;

  const batchCandidates = [...leftovers, ...words.slice(1)].filter(
    (c) => /\d/.test(c) && /^[A-Za-z0-9\-\/]{3,18}$/.test(c),
  );
  const batch = batchCandidates[0] || EMPTY;

  const qty = ints.length ? Math.round(ints[0]) : 0;
  const freeQty = ints.length > 1 && ints[1] <= qty * 2 + 5 ? Math.round(ints[1]) : 0;
  const stockQty = qty + freeQty;
  if (stockQty <= 0) return null;

  // Drop the value column: the money closest to qty x candidate rate.
  let money = [...moneys];
  if (money.length >= 3) {
    let dropIndex = -1;
    let bestDelta = Infinity;
    for (let i = 0; i < money.length; i += 1) {
      for (let j = 0; j < money.length; j += 1) {
        if (i === j) continue;
        const delta = Math.abs(money[i] - money[j] * qty);
        if (delta < bestDelta && delta <= Math.max(1, money[i] * 0.02)) {
          bestDelta = delta;
          dropIndex = i;
        }
      }
    }
    if (dropIndex >= 0) money.splice(dropIndex, 1);
  }
  money.sort((a, b) => b - a);
  const mrp = money.length ? money[0] : 0;
  const rate = money.length > 1 ? money[1] : 0;

  return {
    name,
    pack: EMPTY,
    hsn_code: hsn,
    batch,
    expiry,
    mrp,
    rate,
    purchase_rate: rate,
    amount: 0,
    stock_qty: stockQty,
    free_qty: freeQty,
    reorder_level: getLowStockThreshold(stockQty),
    tablets_per_sheet: 0,
    supplier_name: meta.supplier_name || EMPTY,
    item_category: 'Medicine',
    rack_number: EMPTY,
    product_type: 'Ethical',
    combination: EMPTY,
  };
}

function parseLooseRows(rows, meta = {}) {
  const items = [];
  for (const cells of rows) {
    const joined = cells.join(' ');
    if (!joined.trim() || JUNK_LINE.test(joined)) continue;
    const item = rowFromLooseTokens(cells, meta);
    if (item) items.push(item);
  }
  return items;
}

function splitTextToRows(text, { splitOnSpaces = false } = {}) {
  return String(text || EMPTY)
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.replace(/\s+$/, EMPTY);
      if (!trimmed.trim()) return [];
      const cells = trimmed.includes('\t')
        ? trimmed.split('\t')
        : splitOnSpaces
          ? trimmed.split(/\s{2,}/)
          : [trimmed];
      return cells.map((c) => c.trim()).filter((c, i, arr) => c !== EMPTY || i < arr.length - 1);
    })
    .filter((cells) => cells.length > 0);
}

function dedupeItems(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = [
      String(item.name || EMPTY).toUpperCase(),
      String(item.batch || EMPTY).toUpperCase(),
      item.expiry || EMPTY,
      item.stock_qty,
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Per-row warnings so the preview can tell a human exactly what to eyeball,
 * instead of silently importing a bad guess.
 */
function annotateConfidence(items, strategy) {
  const guessedColumns = String(strategy || EMPTY).includes('loose');
  return items.map((item) => {
    const warnings = [];
    if (guessedColumns) warnings.push('No column headings found - MRP and cost were guessed, please verify');
    if (!item.batch) warnings.push('No batch found');
    if (!item.expiry) warnings.push('No expiry found');
    if (!item.mrp) warnings.push('No MRP found');
    if (!item.purchase_rate) warnings.push('No cost found');
    if (item.mrp && item.purchase_rate && item.purchase_rate > item.mrp) {
      warnings.push('Cost is higher than MRP - check columns');
    }
    if (item.stock_qty > 5000) warnings.push('Unusually large quantity');
    if (item.name && item.name.length < 4) warnings.push('Very short product name');

    const critical = warnings.some(
      (w) => w.startsWith('Cost is higher') || w === 'Unusually large quantity',
    );
    const confidence =
      critical || warnings.length >= 3 ? 'low' : warnings.length >= 1 ? 'medium' : 'high';
    // A positional read is never "high" - nothing declared what the columns meant.
    const finalConfidence = guessedColumns && confidence === 'high' ? 'medium' : confidence;

    return {
      ...item,
      warnings,
      confidence: finalConfidence,
      needs_review: finalConfidence !== 'high',
      source_strategy: strategy,
    };
  });
}

const VALID_EXPIRY = /^(0[1-9]|1[0-2])\/\d{2}$/;

function looksLikeBatch(value) {
  const text = String(value || EMPTY).trim();
  if (!text) return false;
  if (VALID_EXPIRY.test(text) || EXPIRY_TOKEN.test(text)) return false;
  if (/^\d{1,3}$/.test(text)) return false; // a bare small number is a count, not a batch
  return /^[A-Za-z0-9\-\/]{3,18}$/.test(text);
}

/**
 * Judge a reading by whether its values are *plausible*, not merely present:
 * a column shift fills every field with something, so counting non-empty cells
 * would rank shifted rubbish above a correct read with genuine blanks.
 */
function scoreStrategy(items, strategy = EMPTY) {
  if (!items.length) return 0;
  let score = items.length * 10;
  for (const item of items) {
    if (VALID_EXPIRY.test(item.expiry)) score += 4;
    else if (item.expiry) score -= 2;

    if (looksLikeBatch(item.batch)) score += 3;
    else if (item.batch) score -= 2;

    if (item.mrp > 0) score += 2;
    if (item.purchase_rate > 0) score += 2;
    if (item.mrp > 0 && item.purchase_rate > 0 && item.purchase_rate <= item.mrp) score += 1;
    if (item.stock_qty > 0 && item.stock_qty <= 5000) score += 1;
    if (item.pack) score += 1;
  }
  // Declared column headings beat guessing from position, and an x-anchored
  // read keeps blank cells in their own column instead of shifting the row.
  // Note: a cost above MRP is never a reason to prefer a reading that reshuffles
  // columns until the oddity disappears - that hides real invoice errors from
  // the person checking the preview.
  if (strategy.includes('+headers')) score += 25;
  if (strategy.includes('header-anchored')) score += 10;
  return score;
}

function detectSupplierFromPdfText(text) {
  const lines = String(text || EMPTY)
    .split(/\n/)
    .map((line) => line.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 40);

  for (const line of lines) {
    if (/page\s*no|cust\s*code|bill\s*to|ship\s*to|buyer|customer|dharvi|first\s*care|invoice\s*no|gstin|drug\s*lic/i.test(line)) {
      continue;
    }
    if (/pharma|distribut|agency|agencies|wholesaler|enterprise|medisolution|medical|traders|surgical/i.test(line)) {
      const cleaned = cleanProductName(
        line
          .replace(/office\s*copy|tax\s*invoice|invoice|original|duplicate/gi, EMPTY)
          .replace(/\s+/g, ' ')
          .trim(),
      );
      if (cleaned.length >= 4) return cleaned;
    }
  }

  const labeled = String(text || EMPTY).match(
    /(?:sold\s*by|supplier|from|distributor)\s*[:\-]?\s*([A-Z][A-Za-z0-9&.,\-\/\s]{3,80})/i,
  );
  if (labeled?.[1]) return cleanProductName(labeled[1]);
  return EMPTY;
}

/**
 * pdfjs gives every text fragment an x/y position. Column structure is
 * recovered from those coordinates, which works regardless of how a
 * particular supplier lays out its invoice - unlike matching a fixed
 * column order or relying on the extracted text keeping its whitespace.
 */
async function importPdfjs() {
  const roots = [
    process.env.SUPPLIER_IMPORT_NODE_MODULES,
    path.join(process.cwd(), 'node_modules'),
  ].filter(Boolean);

  const relatives = [
    path.join('pdfjs-dist', 'legacy', 'build', 'pdf.mjs'),
    path.join('pdfjs-dist', 'build', 'pdf.mjs'),
    path.join('pdf-parse', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs'),
  ];

  for (const root of roots) {
    for (const relative of relatives) {
      const candidate = path.join(root, relative);
      if (!fsSync.existsSync(candidate)) continue;
      const mod = await import(pathToFileURL(candidate).href);
      const pdfjs = mod.getDocument ? mod : mod.default || mod;
      const fontDir = path.join(path.dirname(path.dirname(path.dirname(candidate))), 'standard_fonts');
      return {
        pdfjs,
        standardFontDataUrl: fsSync.existsSync(fontDir) ? `${pathToFileURL(fontDir).href}/` : undefined,
      };
    }
  }
  throw new Error('pdfjs-dist not found for geometric PDF extraction');
}

async function extractPdfItems(buffer) {
  const { pdfjs, standardFontDataUrl } = await importPdfjs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    standardFontDataUrl,
  }).promise;

  const pages = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = (content.items || [])
      .filter((item) => String(item?.str || EMPTY).trim())
      .map((item) => ({
        text: String(item.str).trim(),
        x: Number(item.transform?.[4] ?? 0),
        y: Number(item.transform?.[5] ?? 0),
        w: Number(item.width || 0),
        h: Number(item.height || Math.abs(item.transform?.[3] || 0) || 8),
      }));
    if (items.length) pages.push(items);
  }
  return pages;
}

/** Group fragments sharing a baseline into one visual line. */
function itemsToLines(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const item of sorted) {
    const tolerance = Math.max(2, item.h * 0.6);
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
    if (line) {
      line.items.push(item);
      line.y = (line.y * (line.items.length - 1) + item.y) / line.items.length;
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }
  for (const line of lines) line.items.sort((a, b) => a.x - b.x);
  return lines;
}

/** Split one line into cells wherever the horizontal gap exceeds `gap`. */
function cellsFromLine(line, gap) {
  const cells = [];
  let current = EMPTY;
  let cursorEnd = null;
  for (const item of line.items) {
    if (cursorEnd != null && item.x - cursorEnd > gap) {
      cells.push(current.trim());
      current = item.text;
    } else {
      current = current ? `${current} ${item.text}` : item.text;
    }
    cursorEnd = item.x + item.w;
  }
  if (current.trim()) cells.push(current.trim());
  return cells;
}

/**
 * Strongest strategy when a header row exists: take the header's own x spans as
 * column boundaries, then drop every later fragment into the column it sits
 * under. Tolerates ragged spacing and right-aligned numeric columns.
 */
function headerAnchoredRows(pages) {
  for (const items of pages) {
    const lines = itemsToLines(items);
    for (let index = 0; index < Math.min(lines.length, 30); index += 1) {
      const headerCells = cellsFromLine(lines[index], 6);
      const mapping = mapHeaders(headerCells);
      if (mapping.name == null || mapping.qty == null) continue;

      // Rebuild header column centres from the fragments themselves.
      const groups = [];
      let current = null;
      let cursorEnd = null;
      for (const item of lines[index].items) {
        if (cursorEnd != null && item.x - cursorEnd > 6) current = null;
        if (!current) {
          current = { start: item.x, end: item.x + item.w, text: item.text };
          groups.push(current);
        } else {
          current.end = item.x + item.w;
          current.text += ` ${item.text}`;
        }
        cursorEnd = item.x + item.w;
      }
      if (groups.length < 3) continue;

      const bounds = groups.map((group, i) => {
        const prev = groups[i - 1];
        const next = groups[i + 1];
        return {
          left: prev ? (prev.end + group.start) / 2 : group.start - 20,
          right: next ? (group.end + next.start) / 2 : group.end + 60,
        };
      });

      const rows = [groups.map((g) => g.text.trim())];
      for (const line of lines.slice(index + 1)) {
        const cells = new Array(groups.length).fill(EMPTY);
        for (const item of line.items) {
          const mid = item.x + item.w / 2;
          let target = bounds.findIndex((b) => mid >= b.left && mid < b.right);
          if (target < 0) target = mid < bounds[0].left ? 0 : bounds.length - 1;
          cells[target] = cells[target] ? `${cells[target]} ${item.text}` : item.text;
        }
        if (cells.some((cell) => cell.trim())) rows.push(cells.map((cell) => cell.trim()));
      }
      if (rows.length > 1) return rows;
    }
  }
  return [];
}

function pagesToPlainText(pages) {
  const out = [];
  for (const items of pages) {
    for (const line of itemsToLines(items)) {
      out.push(line.items.map((item) => item.text).join(' '));
    }
  }
  return out.join('\n');
}

async function parseExcel(filePath, meta) {
  const XLSX = await importDependency('xlsx');
  const buffer = await fs.readFile(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const results = [];
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: EMPTY,
      raw: false,
    });
    const mapped = parseTabularContent(rows, meta);
    if (mapped.length) results.push({ items: mapped, strategy: `excel:${sheetName}` });
    const loose = parseLooseRows(rows, meta);
    if (loose.length) results.push({ items: loose, strategy: `excel-loose:${sheetName}` });
  }
  return { attempts: results, diagnostics: { pages: workbook.SheetNames.length, has_text_layer: true } };
}

/**
 * Format-agnostic PDF extraction. Rather than matching one supplier's column
 * order, try every general-purpose reading of the page and keep whichever
 * produces the most complete rows:
 *   1. ruled tables via path geometry (getTable)
 *   2. column splitting by horizontal gaps, at several gap widths
 *   3. header-free token classification
 */
async function parsePdf(filePath, meta) {
  ensurePdfDomPolyfills();

  try {
    const canvas = await importDependency('@napi-rs/canvas');
    if (canvas.DOMMatrix) globalThis.DOMMatrix = canvas.DOMMatrix;
    if (canvas.ImageData) globalThis.ImageData = canvas.ImageData;
    if (canvas.Path2D) globalThis.Path2D = canvas.Path2D;
  } catch {
    ensurePdfDomPolyfills();
  }

  const mod = await importDependency('pdf-parse');
  const PDFParse = mod.PDFParse || mod.default?.PDFParse || mod.default;
  if (!PDFParse) {
    throw new Error('pdf-parse package is missing or invalid (PDFParse export not found)');
  }
  const buffer = await fs.readFile(filePath);

  const candidates = [];
  let plainText = EMPTY;
  const diagnostics = { pages: 0, text_length: 0, has_text_layer: false };

  // Pass 0: geometry. Read the page as positioned fragments and rebuild the
  // columns, at several gap widths plus a header-anchored pass.
  try {
    const pages = await extractPdfItems(buffer);
    plainText = pagesToPlainText(pages);
    diagnostics.pages = pages.length;
    diagnostics.text_length = plainText.replace(/\s/g, EMPTY).length;
    diagnostics.has_text_layer = diagnostics.text_length > 20;

    const anchored = headerAnchoredRows(pages);
    if (anchored.length) candidates.push({ rows: anchored, strategy: 'geom:header-anchored' });

    for (const gap of [3, 6, 10, 18]) {
      const rows = [];
      for (const items of pages) {
        for (const line of itemsToLines(items)) rows.push(cellsFromLine(line, gap));
      }
      if (rows.length) candidates.push({ rows, strategy: `geom:gap${gap}` });
    }
  } catch {
    /* fall back to text-based passes below */
  }

  // Pass 1: cell thresholds, widest to narrowest. Different invoices space
  // their columns differently, so no single threshold suits every supplier.
  for (const cellThreshold of [10, 7, 4, 2]) {
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText({ cellSeparator: '\t', cellThreshold });
      const text = result?.text || EMPTY;
      if (!plainText) plainText = text;
      if (!diagnostics.has_text_layer) {
        diagnostics.text_length = Math.max(diagnostics.text_length, text.replace(/\s/g, EMPTY).length);
        diagnostics.has_text_layer = diagnostics.text_length > 20;
      }
      const rows = splitTextToRows(text);
      candidates.push({ rows, strategy: `text:gap${cellThreshold}` });
    } catch {
      /* try the next threshold */
    }
  }

  // Pass 2: ruled tables, when the PDF draws real grid lines.
  try {
    const parser = new PDFParse({ data: buffer });
    const tables = await parser.getTable();
    const all = [
      ...(tables?.mergedTables || []),
      ...(tables?.pages || []).flatMap((page) => page?.tables || []),
    ];
    all.forEach((table, index) => {
      const rows = (table || []).map((row) => (row || []).map((cell) => String(cell ?? EMPTY).trim()));
      if (rows.length) candidates.push({ rows, strategy: `table${index + 1}` });
    });
  } catch {
    /* tables are a bonus, not a requirement */
  }

  const supplierName = detectSupplierFromPdfText(plainText) || meta.supplier_name || EMPTY;
  const rowMeta = { ...meta, supplier_name: supplierName };

  const attempts = [];
  for (const candidate of candidates) {
    const mapped = parseTabularContent(candidate.rows, rowMeta);
    if (mapped.length) attempts.push({ items: mapped, strategy: `${candidate.strategy}+headers` });
    const loose = parseLooseRows(candidate.rows, rowMeta);
    if (loose.length) attempts.push({ items: loose, strategy: `${candidate.strategy}+loose` });
  }

  // Last resort: split on runs of spaces, for text with no gap metadata at all.
  if (!attempts.length && plainText) {
    const spaced = splitTextToRows(plainText, { splitOnSpaces: true });
    const mapped = parseTabularContent(spaced, rowMeta);
    if (mapped.length) attempts.push({ items: mapped, strategy: 'spaces+headers' });
    const loose = parseLooseRows(spaced, rowMeta);
    if (loose.length) attempts.push({ items: loose, strategy: 'spaces+loose' });
  }

  return { attempts, diagnostics };
}

function pickBestAttempt(attempts) {
  let best = { items: [], strategy: 'none', score: 0 };
  for (const attempt of attempts) {
    const items = dedupeItems(attempt.items);
    const score = scoreStrategy(items, attempt.strategy || EMPTY);
    if (score > best.score) best = { items, strategy: attempt.strategy, score };
  }
  return best;
}

const filePath = process.argv[2];
const ext = String(process.argv[3] || path.extname(filePath || EMPTY)).toLowerCase();

(async () => {
  try {
    if (!filePath) throw new Error('Missing file path');
    const meta = { supplier_name: EMPTY };
    let parsed = { attempts: [], diagnostics: {} };
    if (ext === '.xlsx' || ext === '.xls') parsed = await parseExcel(filePath, meta);
    else if (ext === '.pdf') parsed = await parsePdf(filePath, meta);
    else throw new Error('Worker only handles PDF/Excel');

    const best = pickBestAttempt(parsed.attempts);
    const items = annotateConfidence(best.items, best.strategy);
    process.send?.({
      ok: true,
      items,
      strategy: best.strategy,
      attempts: parsed.attempts.length,
      diagnostics: parsed.diagnostics,
    });
    process.exit(0);
  } catch (error) {
    process.send?.({ ok: false, error: error?.message || String(error) });
    process.exit(1);
  }
})();
