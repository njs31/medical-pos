import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../database/db.js";
import { runWithStockCheckpoint } from "../database/stockTimeline.js";
import { parseBinarySupplierFile } from "./supplierFileBridge.js";

const EMPTY = String();
const QUOTE = String.fromCharCode(39);
const SQL_EMPTY = QUOTE + QUOTE;
const DQUOTE = String.fromCharCode(34);
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

const FIELD_SYNONYMS = {
  name: ["item_name", "product_name", "product", "medicine_name", "medicine", "item", "particulars", "description", "drug_name", "name"],
  pack: ["pack", "pack_size", "packing", "pkg"],
  batch: ["batch", "batch_no", "batch_number", "batchno", "bno", "lot", "lot_no"],
  expiry: ["expiry", "exp", "exp_date", "expiry_date", "expdt", "expire"],
  qty: ["qty", "quantity", "stock", "stock_qty", "qnty", "bill_qty", "inv_qty", "nos"],
  free_qty: ["f_qty", "free", "free_qty", "fqty", "sch"],
  mrp: ["mrp", "m_r_p", "maximum_retail_price", "retail_price"],
  rate: ["rate", "srate", "ftrate", "ptr", "pts", "purchase_rate", "buying_rate", "cost", "unit_rate", "net_rate"],
  amount: ["amount", "amt", "value", "taxable", "net_amount", "line_amount"],
  hsn_code: ["hsn", "hsn_code", "hsncode", "sac"],
  rack_number: ["rack", "rack_no", "rack_number", "location"],
  supplier_name: ["supplier_name", "party_name", "distributor", "sold_by"],
};

function normalizeHeader(header) {
  return String(header || EMPTY)
    .replace(/^\uFEFF/, EMPTY)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, EMPTY);
}

function parseNumber(value, fallback = 0) {
  const normalized = String(value ?? EMPTY)
    .replace(/[\u20B9,\s]/g, EMPTY)
    .replace(/[^\d.-]/g, EMPTY)
    .trim();
  if (!normalized || normalized === "-" || normalized === ".") return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getLowStockThreshold(stockQty) {
  const qty = parseNumber(stockQty, 0);
  if (qty <= 0) return 0;
  return Math.max(1, Math.ceil(qty * 0.2));
}

export function normalizeExpiry(expiry) {
  const raw = String(expiry || EMPTY).trim().replace(/\s+/g, EMPTY);
  if (!raw || raw === "-" || raw === "--") return EMPTY;

  let match = raw.match(/^(\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (match) {
    const month = String(parseInt(match[1], 10)).padStart(2, "0");
    const year = match[2].length === 4 ? match[2].slice(-2) : match[2].padStart(2, "0");
    return month + "/" + year;
  }

  match = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (match) {
    const month = String(parseInt(match[2], 10)).padStart(2, "0");
    const year = match[3].length === 4 ? match[3].slice(-2) : match[3].padStart(2, "0");
    return month + "/" + year;
  }

  return raw;
}

function cleanProductName(name) {
  return String(name || EMPTY)
    .replace(/\(\d+(?:\.\d+)?\)\s*$/g, EMPTY)
    .replace(/\s+/g, " ")
    .trim();
}

function scoreHeader(header, synonyms, { exactOnly = false } = {}) {
  const h = normalizeHeader(header);
  if (!h) return 0;
  if (synonyms.includes(h)) return 100;
  if (exactOnly) return 0;
  for (const syn of synonyms) {
    if (h === syn) return 100;
    // Prefer whole-token matches only (avoid SUPPLIER matching supplier_name via includes).
    const hParts = h.split('_');
    const sParts = syn.split('_');
    if (hParts.some((part) => sParts.includes(part) && part.length > 2)) return 60;
  }
  return 0;
}

function mapHeaders(headers) {
  const mapping = {};
  const used = new Set();
  const exactFields = new Set(['name', 'batch', 'expiry', 'qty', 'mrp', 'hsn_code']);

  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    let best = { index: -1, score: 0 };
    headers.forEach((header, index) => {
      if (used.has(index)) return;
      const score = scoreHeader(header, synonyms, { exactOnly: exactFields.has(field) });
      if (score > best.score) best = { index, score };
    });
    const threshold = exactFields.has(field) ? 100 : 70;
    if (best.score >= threshold) {
      mapping[field] = best.index;
      used.add(best.index);
    }
  }

  // Explicit Sai Pharma / common pharma CSV aliases
  headers.forEach((header, index) => {
    if (used.has(index)) return;
    const h = normalizeHeader(header);
    if (!mapping.name && (h === 'item_name' || h === 'product_name' || h === 'medicine_name')) {
      mapping.name = index;
      used.add(index);
    }
    if (!mapping.rate && (h === 'ftrate' || h === 'ptr' || h === 'purchase_rate')) {
      mapping.rate = index;
      used.add(index);
    }
    if (!mapping.free_qty && (h === 'f_qty' || h === 'free_qty' || h === 'free')) {
      mapping.free_qty = index;
      used.add(index);
    }
  });

  return mapping;
}

function looksLikeDateName(name) {
  const value = String(name || EMPTY).trim();
  if (!value) return true;
  if (/^\d{1,2}[\/\-.]\d{1,2}([\/\-.]\d{2,4})?$/.test(value)) return true;
  if (/^\d{1,2}[\/\-.]\d{2,4}$/.test(value)) return true;
  if (/^\d{1,2}[- ]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[- ]?\d{2,4}$/i.test(value)) return true;
  return false;
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
  if (!name || looksLikeDateName(name) || stockQty <= 0) return null;

  // Build expiry from EXPIRY, or EXPDAY+EXPMONTH+EXPYEAR style columns if present in values via mapping only
  let expiry = normalizeExpiry(get('expiry'));
  if (!expiry && mapping.expday != null) {
    const day = get('expday');
    const month = get('expmonth');
    const year = get('expyear');
    if (month && year) expiry = normalizeExpiry(`${month}/${year}`);
    else if (day && month && year) expiry = normalizeExpiry(`${day}-${month}-${year}`);
  }

  const mrp = parseNumber(get('mrp'));
  const rate = parseNumber(get('rate'));
  const amount = parseNumber(get('amount'));
  const purchaseRate = rate > 0 ? rate : amount > 0 && stockQty > 0 ? amount / stockQty : 0;

  return {
    name,
    pack: get('pack'),
    hsn_code: get('hsn_code'),
    batch: get('batch'),
    expiry,
    mrp,
    rate: purchaseRate,
    purchase_rate: purchaseRate,
    amount,
    sgst_percent: 0,
    cgst_percent: 0,
    stock_qty: stockQty,
    reorder_level: getLowStockThreshold(stockQty),
    tablets_per_sheet: 0,
    supplier_name: meta.supplier_name || EMPTY,
    item_category: 'Medicine',
    rack_number: get('rack_number'),
    product_type: 'Generic',
    combination: EMPTY,
    source_hint: meta.source_hint || EMPTY,
  };
}

function parseCsvRows(content) {
  const rows = [];
  let row = [];
  let cell = EMPTY;
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === DQUOTE) {
      if (inQuotes && next === DQUOTE) {
        cell += DQUOTE;
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = EMPTY;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim() !== EMPTY)) rows.push(row);
      row = [];
      cell = EMPTY;
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => String(value).trim() !== EMPTY)) rows.push(row);
  return rows;
}

function detectSupplierFromFileName(fileName = EMPTY) {
  const base = String(fileName || EMPTY).replace(/\.[^.]+$/, EMPTY);
  const parts = base.split(/[_\-]+/).map((part) => part.trim()).filter(Boolean);
  const hit = parts.find(
    (part) => /pharma|distribut|agency|agencies|enterprise/i.test(part) && !/dharvi|polyclinic/i.test(part),
  );
  return hit ? cleanProductName(hit) : EMPTY;
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

function parseCsvBuffer(buffer, meta = {}) {
  return parseTabularContent(parseCsvRows(buffer.toString("utf8")), {
    ...meta,
    source_hint: meta.source_hint || "csv",
  });
}

function matchAction(existingMedicines, item) {
  const nameKey = String(item.name || EMPTY).trim().toUpperCase();
  const batchKey = String(item.batch || EMPTY).trim().toUpperCase();
  const exact = existingMedicines.find(
    (row) =>
      String(row.name || EMPTY).trim().toUpperCase() === nameKey &&
      String(row.batch || EMPTY).trim().toUpperCase() === batchKey,
  );
  if (exact) {
    return {
      action: "update",
      match_id: exact.id,
      match_label: `Add +${item.stock_qty} to existing batch (current ${exact.stock_qty})`,
    };
  }

  const nameOnly = existingMedicines.find(
    (row) => String(row.name || EMPTY).trim().toUpperCase() === nameKey,
  );
  if (nameOnly) {
    return { action: "add_batch", match_id: null, match_label: "New batch for existing product" };
  }

  return { action: "add", match_id: null, match_label: "New product" };
}

function resolveWorkerPath() {
  const candidates = [
    path.join(MODULE_DIR, "supplierFileWorker.mjs"),
    path.join(process.resourcesPath || EMPTY, "supplierFileWorker.mjs"),
    path.join(process.cwd(), "electron/services/supplierFileWorker.mjs"),
    path.join(process.cwd(), "out/main/supplierFileWorker.mjs"),
  ];
  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

export async function parseSupplierFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  const baseMeta = {
    file_name: fileName,
    supplier_name: detectSupplierFromFileName(fileName),
  };

  let items = [];
  let format = "unknown";

  if (ext === ".csv" || ext === ".txt") {
    format = "csv";
    const buffer = await fs.readFile(filePath);
    items = parseCsvBuffer(buffer, baseMeta);
  } else if (ext === ".xlsx" || ext === ".xls" || ext === ".pdf") {
    format = ext === ".pdf" ? "pdf" : "excel";
    items = await parseBinarySupplierFile(filePath, ext, resolveWorkerPath());
    items = items.map((item) => ({
      ...item,
      supplier_name: item.supplier_name || baseMeta.supplier_name,
    }));
    items = items.map((item) => ({
      ...item,
      supplier_name: item.supplier_name || baseMeta.supplier_name,
    }));
  } else {
    throw new Error("Unsupported file type. Use PDF, CSV, XLS, or XLSX.");
  }

  if (!items.length) {
    throw new Error("Could not detect medicine rows in this file. Check the format and try again.");
  }

  const existing = getDb().prepare("SELECT id, name, batch, stock_qty FROM medicines").all();
  const supplier_name =
    baseMeta.supplier_name ||
    items.find((row) => row.supplier_name)?.supplier_name ||
    EMPTY;

  const preview = items.map((item, index) => {
    const match = matchAction(existing, item);
    return {
      ...item,
      row_id: index + 1,
      selected: true,
      supplier_name: supplier_name || item.supplier_name || EMPTY,
      ...match,
    };
  });

  return {
    success: true,
    format,
    file_name: fileName,
    supplier_name,
    item_count: preview.length,
    items: preview,
  };
}

export function applySupplierImport(rows = [], options = {}) {
  const selected = (rows || []).filter((row) => row && row.selected !== false && String(row.name || EMPTY).trim());
  if (!selected.length) {
    throw new Error("No medicines selected for intake");
  }

  const supplierFallback = String(options.supplier_name || EMPTY).trim();
  const database = getDb();
  const label = [
    "Supplier stock intake - ",
    String(selected.length),
    " item",
    selected.length === 1 ? EMPTY : "s",
  ].join(EMPTY);

  return runWithStockCheckpoint(label, "supplier_import", () => {
    const findExact = database.prepare(
      "SELECT * FROM medicines WHERE UPPER(TRIM(name)) = UPPER(TRIM(?)) AND UPPER(TRIM(COALESCE(batch, " +
        SQL_EMPTY +
        "))) = UPPER(TRIM(?)) LIMIT 1",
    );
    const insert = database.prepare("\n      INSERT INTO medicines (\n        name, pack, hsn_code, batch, expiry, mrp, rate, purchase_rate,\n        sgst_percent, cgst_percent, stock_qty, reorder_level, tablets_per_sheet,\n        supplier_name, item_category, rack_number, product_type, combination\n      ) VALUES (\n        @name, @pack, @hsn_code, @batch, @expiry, @mrp, @rate, @purchase_rate,\n        0, 0, @stock_qty, @reorder_level, @tablets_per_sheet,\n        @supplier_name, @item_category, @rack_number, @product_type, @combination\n      )\n    ");
    const update = database.prepare(
      "UPDATE medicines SET " +
        "stock_qty = stock_qty + @add_qty, " +
        "mrp = CASE WHEN @mrp > 0 THEN @mrp ELSE mrp END, " +
        "rate = CASE WHEN @rate > 0 THEN @rate ELSE rate END, " +
        "purchase_rate = CASE WHEN @purchase_rate > 0 THEN @purchase_rate ELSE purchase_rate END, " +
        "expiry = CASE WHEN @expiry != " + SQL_EMPTY + " THEN @expiry ELSE expiry END, " +
        "pack = CASE WHEN @pack != " + SQL_EMPTY + " THEN @pack ELSE pack END, " +
        "hsn_code = CASE WHEN @hsn_code != " + SQL_EMPTY + " THEN @hsn_code ELSE hsn_code END, " +
        "rack_number = CASE WHEN @rack_number != " + SQL_EMPTY + " THEN @rack_number ELSE rack_number END, " +
        "supplier_name = CASE WHEN @supplier_name != " + SQL_EMPTY + " THEN @supplier_name ELSE supplier_name END, " +
        "item_category = CASE WHEN @item_category != " + SQL_EMPTY + " THEN @item_category ELSE item_category END, " +
        "product_type = CASE WHEN @product_type != " + SQL_EMPTY + " THEN @product_type ELSE product_type END, " +
        "combination = CASE WHEN @combination != " + SQL_EMPTY + " THEN @combination ELSE combination END, " +
        "tablets_per_sheet = CASE WHEN @tablets_per_sheet > 0 THEN @tablets_per_sheet ELSE tablets_per_sheet END, " +
        "reorder_level = CASE WHEN @reorder_level >= 0 THEN @reorder_level ELSE reorder_level END " +
        "WHERE id = @id",
    );

    let added = 0;
    let updated = 0;

    const tx = database.transaction((items) => {
      for (const row of items) {
        const stockQty = Math.round(parseNumber(row.stock_qty));
        const hasCustomReorder =
          row.reorder_level !== undefined &&
          row.reorder_level !== null &&
          String(row.reorder_level).trim() !== EMPTY;
        const payload = {
          name: String(row.name || EMPTY).trim(),
          pack: String(row.pack || EMPTY).trim(),
          hsn_code: String(row.hsn_code || EMPTY).trim(),
          batch: String(row.batch || EMPTY).trim(),
          expiry: normalizeExpiry(row.expiry),
          mrp: parseNumber(row.mrp),
          rate: parseNumber(row.rate || row.purchase_rate),
          purchase_rate: parseNumber(row.purchase_rate || row.rate),
          stock_qty: stockQty,
          reorder_level: hasCustomReorder
            ? Math.max(0, Math.round(parseNumber(row.reorder_level)))
            : getLowStockThreshold(stockQty),
          tablets_per_sheet: parseNumber(row.tablets_per_sheet, 0),
          supplier_name: String(row.supplier_name || supplierFallback || EMPTY).trim(),
          item_category: row.item_category || "Medicine",
          rack_number: String(row.rack_number || EMPTY).trim(),
          product_type: row.product_type || "Generic",
          combination: String(row.combination || EMPTY).trim(),
        };

        if (!payload.name || payload.stock_qty <= 0) continue;

        const existing = findExact.get(payload.name, payload.batch);
        if (existing) {
          update.run({
            id: existing.id,
            add_qty: payload.stock_qty,
            mrp: payload.mrp,
            rate: payload.rate,
            purchase_rate: payload.purchase_rate,
            expiry: payload.expiry,
            pack: payload.pack,
            hsn_code: payload.hsn_code,
            rack_number: payload.rack_number,
            supplier_name: payload.supplier_name,
            item_category: payload.item_category,
            product_type: payload.product_type,
            combination: payload.combination,
            tablets_per_sheet: payload.tablets_per_sheet,
            reorder_level: payload.reorder_level,
          });
          updated += 1;
        } else {
          insert.run(payload);
          added += 1;
        }
      }
    });

    tx(selected);
    return { success: true, added, updated, total: added + updated };
  });
}
