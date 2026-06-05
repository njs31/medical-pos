import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Download, Layers, Lock, LogOut, Pencil, Plus, ShieldCheck, Trash2, Upload } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoginModal from '@/components/ui/LoginModal';
import Modal from '@/components/ui/Modal';
import {
  formatCurrency,
  formatDate,
  formatInventoryQty,
  getQuantityBreakdown,
  isExpired,
  isExpiringWithin,
  normalizeExpiry,
  parseExpiry,
} from '@/utils/formatters';

const initialForm = {
  name: '',
  pack: '',
  hsn_code: '',
  batch: '',
  expiry: '',
  mrp: '',
  purchase_cost_input: '',
  stock_qty: '',
  tablets_per_sheet: 0,
  supplier_name: '',
  item_category: 'Medicine',
  rack_number: '',
  product_type: 'Generic',
  combination: '',
};

const initialBulkRow = {
  name: '',
  rack_number: '',
  batch: '',
  expiry: '',
  mrp: '',
  purchase_cost_input: '',
  stock_qty: '',
  tablets_per_sheet: '',
  product_type: 'Generic',
  combination: '',
};

function createBulkRows(count = 5) {
  return Array.from({ length: count }, () => ({ ...initialBulkRow }));
}

function parseCombinations(value) {
  return String(value || '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
}

function getCategoryBadge(category) {
  if (category === 'Medicine') return <span className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold bg-yellow-100 text-yellow-700 mr-2" title="Medicine">M</span>;
  if (category === 'General') return <span className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold bg-blue-100 text-blue-700 mr-2" title="General">G</span>;
  if (category === 'Surgical') return <span className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold bg-green-100 text-green-700 mr-2" title="Surgical">S</span>;
  return null;
}

function getProductTypeShortLabel(type) {
  return String(type || '').toLowerCase() === 'ethical' ? 'E' : 'G';
}

function getLowStockThreshold(stockQty) {
  const qty = Number(stockQty) || 0;
  if (qty <= 0) return 0;
  return Math.max(1, Math.ceil(qty * 0.2));
}

function getPurchaseCostInputValue(item) {
  const basePurchaseRate = Number(item.purchase_rate) || 0;
  const tabletsPerSheet = Number(item.tablets_per_sheet) || 0;
  const isMedicineWithSheets = item.item_category === 'Medicine' && tabletsPerSheet > 0;

  if (isMedicineWithSheets) {
    return String(Number((basePurchaseRate * tabletsPerSheet).toFixed(2)));
  }

  return basePurchaseRate > 0 ? String(basePurchaseRate) : '';
}

function getStoredPurchaseRate(form, itemCategory) {
  const purchaseCostInput = Number(form.purchase_cost_input || 0);
  const tabletsPerSheet = Number(form.tablets_per_sheet || 0);

  if (itemCategory === 'Medicine' && tabletsPerSheet > 0) {
    return Number((purchaseCostInput / tabletsPerSheet).toFixed(4));
  }

  return purchaseCostInput;
}

function buildMedicinePayload(form, itemCategory) {
  return {
    name: String(form.name || '').trim().toUpperCase(),
    pack: String(form.pack || '').trim(),
    hsn_code: '', // kept for db constraint
    batch: String(form.batch || '').trim(),
    expiry: normalizeExpiry(form.expiry),
    mrp: Number(form.mrp || 0),
    rate: Number(form.mrp || 0), // Default rate to MRP since Rate is removed from UI
    purchase_rate: getStoredPurchaseRate(form, itemCategory),
    stock_qty: Number(form.stock_qty || 0),
    reorder_level: getLowStockThreshold(form.stock_qty),
    sgst_percent: 0,
    cgst_percent: 0,
    tablets_per_sheet: itemCategory === 'Medicine' ? Number(form.tablets_per_sheet || 0) : 0,
    supplier_name: form.supplier_name || '',
    item_category: itemCategory,
    rack_number: String(form.rack_number || '').trim(),
    product_type: itemCategory === 'Medicine'
      ? String(form.product_type || 'Generic').trim() || 'Generic'
      : '',
    combination: parseCombinations(form.combination).join(', '),
  };
}

function getPurchaseCostLines(item) {
  const unitCost = Number(item.purchase_rate) || 0;
  const tabletsPerSheet = Number(item.tablets_per_sheet) || 0;
  const isMedicine = item.item_category === 'Medicine';
  const isMedicineWithSheets = isMedicine && tabletsPerSheet > 0;

  if (isMedicineWithSheets) {
    return [
      `Per medicine: ${formatCurrency(unitCost)}`,
      `Per sheet: ${formatCurrency(unitCost * tabletsPerSheet)}`,
    ];
  }

  if (isMedicine) {
    return [`Per medicine: ${formatCurrency(unitCost)}`];
  }

  return [`Per quantity: ${formatCurrency(unitCost)}`];
}

const BULK_CELL = 'px-1.5 py-1';
const BULK_INPUT =
  'w-full rounded border border-slate-300 px-1.5 py-1 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20';

function BulkProductNameInput({
  value,
  rowIndex,
  activeRowIndex,
  onFocusRow,
  onChange,
  onSelectProduct,
}) {
  const inputRef = useRef(null);
  const [results, setResults] = useState([]);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const isActive = activeRowIndex === rowIndex;

  useEffect(() => {
    if (!isActive || !String(value || '').trim()) {
      setResults([]);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const rows = await window.api.medicines.search(value);
      if (!cancelled) setResults(rows);
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, isActive]);

  useEffect(() => {
    if (!isActive || !results.length || !inputRef.current) {
      setDropdownStyle(null);
      return undefined;
    }

    function updatePosition() {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 320),
        zIndex: 9999,
      });
    }

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isActive, results]);

  function handleSelect(item) {
    onSelectProduct(item);
    setResults([]);
    onFocusRow(null);
  }

  return (
    <>
      <input
        ref={inputRef}
        className={BULK_INPUT}
        value={value}
        placeholder="Product name..."
        onFocus={() => onFocusRow(rowIndex)}
        onChange={(e) => {
          onFocusRow(rowIndex);
          onChange(e.target.value);
        }}
        onBlur={() => {
          setTimeout(() => onFocusRow(null), 180);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onFocusRow(null);
        }}
      />
      {isActive && dropdownStyle && results.length > 0 && createPortal(
        <div
          style={dropdownStyle}
          className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl"
          onMouseDown={(e) => e.preventDefault()}
        >
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-start gap-2 border-b border-slate-50 px-2 py-1.5 text-left text-xs transition hover:bg-blue-50 last:border-b-0"
              onClick={() => handleSelect(item)}
            >
              <span className="mt-0.5">{getCategoryBadge(item.item_category || 'Medicine')}</span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-slate-900">{item.name}</span>
                {item.rack_number ? (
                  <span className="ml-2 text-xs text-slate-500">Rack {item.rack_number}</span>
                ) : null}
                {String(item.combination || '').trim() ? (
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{item.combination}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs font-semibold text-blue-600">{formatCurrency(item.mrp)}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

export default function Inventory({ toast, initialFilter = 'all' }) {
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState(initialFilter);
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [bulkRows, setBulkRows] = useState(() => createBulkRows());
  const [bulkSupplierName, setBulkSupplierName] = useState('');
  const [bulkItemCategory, setBulkItemCategory] = useState('Medicine');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkActiveProductRow, setBulkActiveProductRow] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [itemCategory, setItemCategory] = useState('Medicine');
  const [suppliers, setSuppliers] = useState([]);
  const fileRef = useRef(null);
  const formRef = useRef(null);

  // --- Authentication state ---
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('inventory_auth') === 'true';
  });
  const [loginOpen, setLoginOpen] = useState(false);
  const pendingAction = useRef(null);

  /** Wraps an action so it only runs after login */
  const requireAuth = useCallback(
    (action) => {
      if (isAuthenticated) {
        action();
      } else {
        pendingAction.current = action;
        setLoginOpen(true);
      }
    },
    [isAuthenticated],
  );

  function handleAuthenticated() {
    setIsAuthenticated(true);
    sessionStorage.setItem('inventory_auth', 'true');
    setLoginOpen(false);
    // Run the action that was blocked
    if (pendingAction.current) {
      pendingAction.current();
      pendingAction.current = null;
    }
  }

  function handleLogout() {
    setIsAuthenticated(false);
    sessionStorage.removeItem('inventory_auth');
    toast?.('Logged out successfully', 'success');
  }

  async function load() {
    setMedicines(await window.api.medicines.getAll());
    setSuppliers(await window.api.suppliers.getAll());
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 120);
    return () => clearTimeout(timer);
  }, [search]);

  const batchCountByName = useMemo(() => {
    const counts = new Map();
    medicines.forEach((item) => {
      const key = String(item.name || '').trim().toUpperCase();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [medicines]);

  const searchTokens = useMemo(
    () => debouncedSearch.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [debouncedSearch],
  );

  const filtered = useMemo(() => {
    const result = medicines.filter((item) => {
      if (searchTokens.length > 0) {
        const name = String(item.name || '').toLowerCase();
        const haystack = [
          name,
          String(item.hsn_code || '').toLowerCase(),
          String(item.batch || '').toLowerCase(),
          String(item.supplier_name || '').toLowerCase(),
          String(item.combination || '').toLowerCase(),
        ].join(' || ');
        const allMatch = searchTokens.every((token) => haystack.includes(token));
        if (!allMatch) return false;
      }
      if (filter === 'low-stock') return Number(item.stock_qty) <= Number(item.reorder_level);
      if (filter === 'expiring-soon') return isExpiringWithin(item.expiry, 90);
      if (filter === 'expired') return isExpired(item.expiry);
      return true;
    });

    result.sort((a, b) => {
      if (sortKey === 'expiry') {
        const timeA = parseExpiry(a.expiry)?.getTime() || 0;
        const timeB = parseExpiry(b.expiry)?.getTime() || 0;
        if (timeA !== timeB) return sortDir === 'asc' ? timeA - timeB : timeB - timeA;
        return String(a.name || '').localeCompare(String(b.name || ''));
      }
      if (sortKey === 'created_at') {
        const timeA = Date.parse(String(a.created_at || '').replace(' ', 'T') + 'Z') || 0;
        const timeB = Date.parse(String(b.created_at || '').replace(' ', 'T') + 'Z') || 0;
        if (timeA !== timeB) return sortDir === 'asc' ? timeA - timeB : timeB - timeA;
        return String(a.name || '').localeCompare(String(b.name || ''));
      }
      const first = a[sortKey] ?? '';
      const second = b[sortKey] ?? '';
      const comparison =
        typeof first === 'number' || typeof second === 'number'
          ? Number(first) - Number(second)
          : String(first).localeCompare(String(second));
      if (comparison !== 0) return sortDir === 'asc' ? comparison : -comparison;
      // Stable secondary sort: same-name rows grouped, then by expiry (soonest first)
      const nameCmp = String(a.name || '').localeCompare(String(b.name || ''));
      if (nameCmp !== 0) return nameCmp;
      const expA = parseExpiry(a.expiry)?.getTime() || 0;
      const expB = parseExpiry(b.expiry)?.getTime() || 0;
      return expA - expB;
    });
    return result;
  }, [filter, medicines, searchTokens, sortDir, sortKey]);

  function matchedViaCombinationOnly(item) {
    if (searchTokens.length === 0) return false;
    const name = String(item.name || '').toLowerCase();
    const combination = String(item.combination || '').toLowerCase();
    return searchTokens.some((token) => combination.includes(token) && !name.includes(token));
  }

  function openAddModal() {
    requireAuth(() => {
      setEditingId(null);
      setForm(initialForm);
      setItemCategory('Medicine');
      setModalOpen(true);
    });
  }

  function openBulkModal() {
    requireAuth(() => {
      setBulkRows(createBulkRows());
      setBulkSupplierName('');
      setBulkItemCategory('Medicine');
      setBulkActiveProductRow(null);
      setBulkModalOpen(true);
    });
  }

  function openEditModal(item) {
    requireAuth(() => {
      setEditingId(item.id);
      setForm({
        ...item,
        pack: item.pack || '',
        purchase_cost_input: getPurchaseCostInputValue(item),
      });
      setItemCategory(item.item_category || 'Medicine');
      setModalOpen(true);
    });
  }

  function updateBulkRow(index, changes) {
    setBulkRows((rows) => rows.map((row, rowIndex) => (
      rowIndex === index ? { ...row, ...changes } : row
    )));
  }

  function applyBulkProductSuggestion(index, item) {
    updateBulkRow(index, {
      name: item.name || '',
      rack_number: item.rack_number || '',
      tablets_per_sheet: item.tablets_per_sheet ? String(item.tablets_per_sheet) : '',
      combination: item.combination || '',
      product_type: item.product_type || 'Generic',
    });
  }

  function removeBulkRow(index) {
    setBulkRows((rows) => rows.length === 1 ? createBulkRows(1) : rows.filter((_, rowIndex) => rowIndex !== index));
  }

  function addBulkRows(count = 1) {
    setBulkRows((rows) => [...rows, ...createBulkRows(count)]);
  }

  function getFilledBulkRows() {
    return bulkRows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => Object.values(row).some((value) => String(value ?? '').trim() !== ''));
  }

  async function submitBulk() {
    const filledRows = getFilledBulkRows();

    if (!filledRows.length) {
      toast('Add at least one product row', 'error');
      return;
    }

    const invalidRow = filledRows.find(({ row }) => (
      !String(row.name || '').trim()
      || Number(row.mrp || 0) <= 0
      || Number(row.purchase_cost_input || 0) <= 0
      || Number(row.stock_qty || 0) <= 0
    ));

    if (invalidRow) {
      toast(`Row ${invalidRow.index + 1}: product name, MRP, purchase cost, and stock quantity are required`, 'error');
      return;
    }

    setBulkSaving(true);
    try {
      const payloads = filledRows.map(({ row }) => buildMedicinePayload(
        {
          ...initialForm,
          ...row,
          supplier_name: bulkSupplierName,
          item_category: bulkItemCategory,
          tablets_per_sheet: bulkItemCategory === 'Medicine' ? row.tablets_per_sheet : 0,
        },
        bulkItemCategory,
      ));

      await window.api.medicines.addMany(payloads);
      toast(`${payloads.length} products added successfully`);
      setBulkModalOpen(false);
      setBulkRows(createBulkRows());
      setBulkSupplierName('');
      setBulkItemCategory('Medicine');
      await load();
    } catch (error) {
      toast(error?.message || 'Unable to save bulk stock', 'error');
      console.error('Bulk stock save failed:', error);
    } finally {
      setBulkSaving(false);
    }
  }

  function openAddBatchModal(item) {
    requireAuth(() => {
      setEditingId(null);
      setForm({
        ...initialForm,
        name: item.name || '',
        pack: item.pack || '',
        mrp: item.mrp ?? '',
        tablets_per_sheet: Number(item.tablets_per_sheet) || 0,
        supplier_name: item.supplier_name || '',
        item_category: item.item_category || 'Medicine',
        rack_number: item.rack_number || '',
        product_type: item.product_type || 'Generic',
        combination: item.combination || '',
        batch: '',
        expiry: '',
        stock_qty: '',
        purchase_cost_input: '',
      });
      setItemCategory(item.item_category || 'Medicine');
      setModalOpen(true);
    });
  }

  async function submit(event) {
    event?.preventDefault?.();

    if (formRef.current && !formRef.current.reportValidity()) {
      return;
    }

    try {
      const payload = buildMedicinePayload(form, itemCategory);

      const itemType = itemCategory;

      if (editingId) {
        await window.api.medicines.update(editingId, payload);
        toast(`${itemType} updated successfully`);
      } else {
        await window.api.medicines.add(payload);
        toast(`${itemType} added successfully`);
      }

      setModalOpen(false);
      setForm(initialForm);
      setItemCategory('Medicine');
      await load();
    } catch (error) {
      toast(error?.message || 'Unable to save', 'error');
      console.error('Medicine save failed:', error);
    }
  }

  function remove(id) {
    requireAuth(async () => {
      if (!window.confirm('Delete this medicine?')) return;
      await window.api.medicines.delete(id);
      toast('Medicine deleted');
      load();
    });
  }

  async function importDatabase() {
    requireAuth(async () => {
      if (!window.confirm('WARNING: This will replace your ENTIRE database (medicines, bills, settings) with the backup file. The app will restart automatically. Continue?')) return;
      
      const result = await window.api.medicines.importDatabase();
      if (result.success) {
        toast('Database restored successfully. Application is restarting...');
      } else if (result.error) {
        toast(`Restore failed: ${result.error}`, 'error');
      }
    });
  }

  function handleExportDatabase() {
    requireAuth(async () => {
      const result = await window.api.medicines.exportDatabase();
      if (result.success) {
        toast('Database backup exported successfully');
      } else if (result.error) {
        toast(`Export failed: ${result.error}`, 'error');
      }
    });
  }

  function changeSort(key) {
    if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-2xl bg-white p-5 shadow-card">
        <div className="min-w-[260px] flex-1">
          <Input label="Search Products" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, batch, supplier, or combination" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Filter</label>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="low-stock">Low Stock</option>
            <option value="expiring-soon">Expiring Soon</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* Auth status indicator */}
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100"
              title="Click to logout"
            >
              <ShieldCheck size={14} />
              Logout
              <LogOut size={12} className="ml-0.5 opacity-60" />
            </button>
          ) : (
            <button
              onClick={() => requireAuth(() => {})}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
              title="Click to login"
            >
              <Lock size={14} />
              Login
            </button>
          )}

          <Button variant="secondary" onClick={importDatabase}>
            <Upload size={16} className="mr-2" /> Restore Backup
          </Button>
          <Button variant="secondary" onClick={handleExportDatabase}>
            <Download size={16} className="mr-2" /> Export Backup
          </Button>
          <Button onClick={openAddModal}>
            <Plus size={16} className="mr-2" /> Add Stock
          </Button>
          <Button variant="success" onClick={openBulkModal}>
            <Layers size={16} className="mr-2" /> Bulk Add Stock
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="max-h-[68vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-30 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {[
                  ['name', 'Product Name'],
                  ['product_type', 'Type'],
                  ['rack_number', 'Rack #'],
                  ['batch', 'Batch'],
                  ['expiry', 'Expiry'],
                  ['mrp', 'MRP'],
                  ['stock_qty', 'Stock Qty'],
                  ['supplier_name', 'Supplier'],
                  ['created_at', 'Entry Date'],
                ].map(([key, label]) => (
                  <th key={key} className="cursor-pointer px-4 py-3" onClick={() => changeSort(key)}>
                    {label}
                  </th>
                ))}
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, index) => {
                const stock = getQuantityBreakdown(item.stock_qty, item.tablets_per_sheet, item.item_category);
                const nameKey = String(item.name || '').trim().toUpperCase();
                const batchCount = batchCountByName.get(nameKey) || 1;
                const combinationTokens = parseCombinations(item.combination);
                const viaCombination = matchedViaCombinationOnly(item);
                return (
                <tr
                  key={item.id}
                  className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '64px' }}
                >
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    <div className="flex flex-wrap items-center gap-2">
                      {getCategoryBadge(item.item_category || 'Medicine')}
                      <span>{item.name?.toUpperCase()}</span>
                      {batchCount > 1 && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700"
                          title={`${batchCount} batches of this product`}
                        >
                          <Layers size={11} /> {batchCount} batches
                        </span>
                      )}
                      {viaCombination && (
                        <span
                          className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800"
                          title="This medicine matched your search via its combination/salt"
                        >
                          via combination
                        </span>
                      )}
                    </div>
                    {combinationTokens.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {combinationTokens.map((token, tokenIdx) => (
                          <button
                            key={`${item.id}-cmb-${tokenIdx}`}
                            type="button"
                            className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition"
                            title={`Show all medicines with ${token}`}
                            onClick={() => setSearch(token)}
                          >
                            {token}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.item_category === 'Medicine' && item.product_type ? (
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700"
                        title={item.product_type}
                      >
                        {getProductTypeShortLabel(item.product_type)}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{item.rack_number}</td>
                  <td className="px-4 py-3">{item.batch}</td>
                  <td className={`px-4 py-3 ${isExpired(item.expiry) ? 'text-danger' : isExpiringWithin(item.expiry) ? 'text-warning' : ''}`}>
                    {item.expiry}
                  </td>
                  <td className="px-4 py-3">{formatCurrency(item.mrp)}</td>
                  <td className="px-4 py-3 font-semibold">
                    {stock.usesSheets ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-900">{stock.compact}</span>
                        <span className="text-xs font-medium text-indigo-600">
                          {stock.quantity} total tablets
                        </span>
                      </div>
                    ) : (
                      formatInventoryQty(item.stock_qty, item.tablets_per_sheet, item.item_category)
                    )}
                  </td>

                  <td className="px-4 py-3 truncate max-w-[150px]" title={item.supplier_name}>
                    {item.supplier_name?.[0] ? item.supplier_name : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600" title={item.created_at || ''}>
                    {item.created_at ? formatDate(item.created_at) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="group relative">
                        <Button
                          variant="secondary"
                          className="px-3 py-2"
                          onClick={() => openEditModal(item)}
                        >
                          <Pencil size={14} />
                        </Button>
                        <div className="pointer-events-none absolute right-0 top-full z-20 mt-1 hidden min-w-[190px] rounded-xl border border-slate-200 bg-slate-950 px-3 py-2 text-left text-xs font-semibold text-white shadow-2xl group-hover:block">
                          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
                            Purchase Cost
                          </div>
                          {getPurchaseCostLines(item).map((line) => (
                            <div key={line} className="leading-5 text-slate-100">
                              {line}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="group relative">
                        <Button
                          variant="secondary"
                          className="px-3 py-2"
                          onClick={() => openAddBatchModal(item)}
                          title="Add another batch for this product"
                        >
                          <Copy size={14} />
                        </Button>
                        <div className="pointer-events-none absolute right-0 top-full z-20 mt-1 hidden min-w-[180px] rounded-xl border border-slate-200 bg-slate-950 px-3 py-2 text-left text-xs font-semibold text-white shadow-2xl group-hover:block">
                          Add another batch (same product, new batch/expiry/stock)
                        </div>
                      </div>
                      <Button variant="danger" className="px-3 py-2" onClick={() => remove(item.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan="10" className="px-4 py-12 text-center text-slate-500">
                    {searchTokens.length > 0 ? (
                      <>
                        <div className="font-semibold text-slate-700">
                          No products match "{debouncedSearch}".
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Tip: Searching by combination only works if each medicine's
                          <span className="font-semibold"> Combination(s) </span>
                          field is filled in. Edit a medicine to add its salt(s),
                          e.g. "Paracetamol 500, Caffeine 30".
                        </div>
                      </>
                    ) : (
                      'No products found for the current filters.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={editingId ? `Edit ${itemCategory}` : `Add ${itemCategory}`}
        onClose={() => { setModalOpen(false); }}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); }}>
              Cancel
            </Button>
            <Button type="button" onClick={submit}>
              {editingId ? `Update ${itemCategory}` : `Add ${itemCategory}`}
            </Button>
          </div>
        }
      >
        <form ref={formRef} id="medicine-form" className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <div className="col-span-2 flex gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
            {['Medicine', 'General', 'Surgical'].map((cat) => (
              <label key={cat} className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer text-base">
                <input
                  type="radio"
                  name="itemCategory"
                  value={cat}
                  checked={itemCategory === cat}
                  onChange={(e) => setItemCategory(e.target.value)}
                  className="accent-primary w-4 h-4"
                />
                {cat}
              </label>
            ))}
          </div>



          {[
            ['name', 'Product Name *'],
            ['rack_number', 'Rack Number'],
            ['batch', 'Batch No'],
            ['expiry', 'Expiry Date *'],
            ['mrp', 'MRP (₹) *'],
            [
              'purchase_cost_input',
              itemCategory === 'Medicine'
                ? Number(form.tablets_per_sheet || 0) > 0
                  ? 'Purchase Cost Per Sheet (₹) *'
                  : 'Purchase Cost Per Tablet (₹) *'
                : 'Purchase Cost Per Quantity (₹) *',
            ],
            ['stock_qty', itemCategory === 'Medicine' ? 'Stock Quantity (Total Tablets) *' : 'Stock Quantity *'],
          ].map(([key, label]) => (
            <Input
              key={key}
              label={label}
              type={['mrp', 'purchase_cost_input', 'stock_qty'].includes(key) ? 'number' : 'text'}
              value={form[key]}
              required={['name', 'mrp', 'purchase_cost_input', 'stock_qty'].includes(key)}
              min={['mrp', 'purchase_cost_input', 'stock_qty'].includes(key) ? 0 : undefined}
              step={['mrp', 'purchase_cost_input'].includes(key) ? '0.01' : ['stock_qty'].includes(key) ? '1' : undefined}
              onFocus={key === 'mrp' ? (e) => e.target.select() : undefined}
              onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
            />
          ))}

          {itemCategory === 'Medicine' && (
            <Input
              label="Tablets per Sheet (0 = N/A)"
              type="number"
              value={form.tablets_per_sheet || ''}
              min={0}
              step={1}
              onChange={(e) => setForm((prev) => ({ ...prev, tablets_per_sheet: e.target.value }))}
            />
          )}

          {itemCategory === 'Medicine' && (
            <Input
              as="select"
              label="Product Type"
              value={form.product_type || 'Generic'}
              onChange={(e) => setForm((prev) => ({ ...prev, product_type: e.target.value }))}
            >
              <option value="Generic">Generic</option>
              <option value="Ethical">Ethical</option>
            </Input>
          )}

          <Input
            as="select"
            label="Supplier"
            value={form.supplier_name || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, supplier_name: e.target.value }))}
          >
            <option value="">Select Supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </Input>

          <div className="md:col-span-2">
            <Input
              label="Combination(s) — separate with commas"
              value={form.combination || ''}
              placeholder="e.g. Paracetamol 500, Caffeine 30"
              onChange={(e) => setForm((prev) => ({ ...prev, combination: e.target.value }))}
            />
            {parseCombinations(form.combination).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {parseCombinations(form.combination).map((token, idx) => (
                  <span
                    key={`combo-preview-${idx}`}
                    className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700"
                  >
                    {token}
                  </span>
                ))}
                <span className="text-xs text-slate-400">
                  Search by any of these to find alternative medicines.
                </span>
              </div>
            )}
          </div>

          {itemCategory === 'Medicine' && Number(form.tablets_per_sheet) > 0 && Number(form.stock_qty) > 0 && (
            <div className="md:col-span-2 rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm text-indigo-800">
              <span className="font-semibold">Stock preview: </span>
              {formatInventoryQty(form.stock_qty, form.tablets_per_sheet, itemCategory)}
              <span className="text-indigo-500 ml-1">total tablets</span>
            </div>
          )}

          {itemCategory === 'Medicine' && Number(form.tablets_per_sheet) > 0 && form.purchase_cost_input !== '' && (
            <div className="md:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <span className="font-semibold">Purchase cost preview: </span>
              {formatCurrency(form.purchase_cost_input)} per sheet
              <span className="mx-2 text-emerald-400">•</span>
              {formatCurrency(getStoredPurchaseRate(form, itemCategory))} per tablet
            </div>
          )}
        </form>

      </Modal>

      <Modal
        open={bulkModalOpen}
        title="Bulk Add Stock"
        viewportInset={5}
        onClose={() => { if (!bulkSaving) { setBulkActiveProductRow(null); setBulkModalOpen(false); } }}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-500">
              {getFilledBulkRows().length} product rows ready
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" disabled={bulkSaving} onClick={() => setBulkModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={bulkSaving} onClick={submitBulk}>
                {bulkSaving ? 'Saving...' : 'Add All Products'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-4">
          <div className="grid shrink-0 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
            <Input
              as="select"
              label="Supplier"
              value={bulkSupplierName}
              onChange={(e) => setBulkSupplierName(e.target.value)}
            >
              <option value="">Select Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </Input>
            <Input
              as="select"
              label="Category"
              value={bulkItemCategory}
              onChange={(e) => setBulkItemCategory(e.target.value)}
            >
              <option value="Medicine">Medicine</option>
              <option value="General">General</option>
              <option value="Surgical">Surgical</option>
            </Input>
            <div className="flex items-end gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => addBulkRows(1)}>
                <Plus size={16} className="mr-2" /> Add Row
              </Button>
              <Button type="button" variant="secondary" className="flex-1" onClick={() => addBulkRows(5)}>
                <Plus size={16} className="mr-2" /> Add 5 Rows
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200">
            <table className="w-full table-fixed text-xs">
              <thead className="bg-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className={`${BULK_CELL} w-[3%]`}>#</th>
                  <th className={`${BULK_CELL} w-[15%]`}>Product *</th>
                  <th className={`${BULK_CELL} w-[5%]`}>Rack</th>
                  <th className={`${BULK_CELL} w-[7%]`}>Batch</th>
                  <th className={`${BULK_CELL} w-[6%]`}>Expiry</th>
                  <th className={`${BULK_CELL} w-[6%]`}>MRP *</th>
                  <th className={`${BULK_CELL} w-[7%]`}>Cost *</th>
                  <th className={`${BULK_CELL} w-[5%]`}>Stock *</th>
                  {bulkItemCategory === 'Medicine' && (
                    <>
                      <th className={`${BULK_CELL} w-[6%]`}>Tabs</th>
                      <th className={`${BULK_CELL} w-[6%]`}>Type</th>
                    </>
                  )}
                  <th className={BULK_CELL}>Combo</th>
                  <th className={`${BULK_CELL} w-[4%]`}></th>
                </tr>
              </thead>
              <tbody>
                {bulkRows.map((row, index) => (
                  <tr key={`bulk-row-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className={`${BULK_CELL} font-semibold text-slate-500`}>{index + 1}</td>
                    <td className={BULK_CELL}>
                      <BulkProductNameInput
                        value={row.name}
                        rowIndex={index}
                        activeRowIndex={bulkActiveProductRow}
                        onFocusRow={setBulkActiveProductRow}
                        onChange={(name) => updateBulkRow(index, { name })}
                        onSelectProduct={(item) => applyBulkProductSuggestion(index, item)}
                      />
                    </td>
                    <td className={BULK_CELL}>
                      <input
                        className={BULK_INPUT}
                        value={row.rack_number}
                        onChange={(e) => updateBulkRow(index, { rack_number: e.target.value })}
                      />
                    </td>
                    <td className={BULK_CELL}>
                      <input
                        className={BULK_INPUT}
                        value={row.batch}
                        onChange={(e) => updateBulkRow(index, { batch: e.target.value })}
                      />
                    </td>
                    <td className={BULK_CELL}>
                      <input
                        className={BULK_INPUT}
                        placeholder="MM/YY"
                        value={row.expiry}
                        onChange={(e) => updateBulkRow(index, { expiry: e.target.value })}
                      />
                    </td>
                    <td className={BULK_CELL}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={BULK_INPUT}
                        value={row.mrp}
                        onChange={(e) => updateBulkRow(index, { mrp: e.target.value })}
                      />
                    </td>
                    <td className={BULK_CELL}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={BULK_INPUT}
                        value={row.purchase_cost_input}
                        onChange={(e) => updateBulkRow(index, { purchase_cost_input: e.target.value })}
                      />
                    </td>
                    <td className={BULK_CELL}>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className={BULK_INPUT}
                        value={row.stock_qty}
                        onChange={(e) => updateBulkRow(index, { stock_qty: e.target.value })}
                      />
                    </td>
                    {bulkItemCategory === 'Medicine' && (
                      <>
                        <td className={BULK_CELL}>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            className={BULK_INPUT}
                            value={row.tablets_per_sheet}
                            onChange={(e) => updateBulkRow(index, { tablets_per_sheet: e.target.value })}
                          />
                        </td>
                        <td className={BULK_CELL}>
                          <select
                            className={BULK_INPUT}
                            value={row.product_type || 'Generic'}
                            onChange={(e) => updateBulkRow(index, { product_type: e.target.value })}
                          >
                            <option value="Generic">Generic</option>
                            <option value="Ethical">Ethical</option>
                          </select>
                        </td>
                      </>
                    )}
                    <td className={BULK_CELL}>
                      <input
                        className={BULK_INPUT}
                        placeholder="Salt names"
                        value={row.combination}
                        onChange={(e) => updateBulkRow(index, { combination: e.target.value })}
                      />
                    </td>
                    <td className={`${BULK_CELL} text-right`}>
                      <Button
                        type="button"
                        variant="danger"
                        className="px-2 py-1"
                        onClick={() => removeBulkRow(index)}
                        title="Remove row"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Login Modal */}
      <LoginModal
        open={loginOpen}
        onClose={() => {
          setLoginOpen(false);
          pendingAction.current = null;
        }}
        onAuthenticated={handleAuthenticated}
        toast={toast}
      />
    </div>
  );
}
