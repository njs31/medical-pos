import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Lock, LogOut, Pencil, Plus, ShieldCheck, Trash2, Upload } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoginModal from '@/components/ui/LoginModal';
import Modal from '@/components/ui/Modal';
import { formatCurrency, isExpired, isExpiringWithin } from '@/utils/formatters';

const initialForm = {
  name: '',
  pack: '',
  hsn_code: '',
  batch: '',
  expiry: '',
  mrp: '',
  rate: '',
  purchase_rate: '',
  sgst_percent: 6,
  cgst_percent: 6,
  stock_qty: '',
  tablets_per_sheet: 0,
  is_general: false,
  supplier_name: '',
};

const initialGeneralForm = {
  name: '',
  pack: '',
  hsn_code: '',
  expiry: '',
  mrp: '',
  rate: '',
  purchase_rate: '',
  sgst_percent: 0,
  cgst_percent: 0,
  stock_qty: '',
  is_general: true,
  supplier_name: '',
};

/** Format stock_qty into sheets + loose display */
function formatStock(totalQty, tabletsPerSheet) {
  const qty = Number(totalQty) || 0;
  const perSheet = Number(tabletsPerSheet) || 0;
  if (perSheet <= 0) return { display: String(qty), sheets: 0, loose: qty, hasSheets: false };
  const sheets = Math.floor(qty / perSheet);
  const loose = qty % perSheet;
  const parts = [];
  if (sheets > 0) parts.push(`${sheets} sheet${sheets !== 1 ? 's' : ''}`);
  if (loose > 0 || sheets === 0) parts.push(`${loose} loose`);
  return { display: parts.join(' + '), sheets, loose, hasSheets: true };
}

export default function Inventory({ toast, initialFilter = 'all' }) {
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(initialFilter);
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [isGeneralItem, setIsGeneralItem] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const fileRef = useRef(null);
  const formRef = useRef(null);

  // --- Authentication state ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
    setLoginOpen(false);
    // Run the action that was blocked
    if (pendingAction.current) {
      pendingAction.current();
      pendingAction.current = null;
    }
  }

  function handleLogout() {
    setIsAuthenticated(false);
    toast?.('Inventory editing locked', 'success');
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

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    const result = medicines.filter((item) => {
      const match =
        item.name.toLowerCase().includes(term) ||
        String(item.hsn_code || '').toLowerCase().includes(term) ||
        String(item.batch || '').toLowerCase().includes(term);
      if (!match) return false;
      if (filter === 'low-stock') return Number(item.stock_qty) <= Number(item.reorder_level);
      if (filter === 'expiring-soon') return isExpiringWithin(item.expiry, 60);
      if (filter === 'expired') return isExpired(item.expiry);
      return true;
    });

    result.sort((a, b) => {
      const first = a[sortKey] ?? '';
      const second = b[sortKey] ?? '';
      const comparison =
        typeof first === 'number' || typeof second === 'number'
          ? Number(first) - Number(second)
          : String(first).localeCompare(String(second));
      return sortDir === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [filter, medicines, search, sortDir, sortKey]);

  function openAddModal() {
    requireAuth(() => {
      setEditingId(null);
      setForm(initialForm);
      setIsGeneralItem(false);
      setModalOpen(true);
    });
  }

  function openAddGeneralModal() {
    requireAuth(() => {
      setEditingId(null);
      setForm(initialGeneralForm);
      setIsGeneralItem(true);
      setModalOpen(true);
    });
  }

  function openEditModal(item) {
    requireAuth(() => {
      setEditingId(item.id);
      setForm({ ...item });
      setIsGeneralItem(!!item.is_general);
      setModalOpen(true);
    });
  }

  async function submit(event) {
    event?.preventDefault?.();

    if (formRef.current && !formRef.current.reportValidity()) {
      return;
    }

    try {
      const basePayload = {
        name: String(form.name || '').trim(),
        pack: String(form.pack || '').trim(),
        hsn_code: String(form.hsn_code || '').trim(),
        expiry: String(form.expiry || '').trim(),
        mrp: Number(form.mrp || 0),
        rate: Number(form.mrp || 0), // Default rate to MRP since Rate is removed from UI
        purchase_rate: Number(form.purchase_rate || 0),
        stock_qty: Number(form.stock_qty || 0),
        reorder_level: 0,
        is_general: isGeneralItem,
        supplier_name: form.supplier_name || '',
      };

      const payload = isGeneralItem
        ? basePayload
        : {
            ...basePayload,
            batch: String(form.batch || '').trim(),
            expiry: String(form.expiry || '').trim(),
            sgst_percent: Number(form.sgst_percent || 0),
            cgst_percent: Number(form.cgst_percent || 0),
            tablets_per_sheet: Number(form.tablets_per_sheet || 0),
          };

      const itemType = isGeneralItem ? 'General item' : 'Medicine';

      if (editingId) {
        await window.api.medicines.update(editingId, payload);
        toast(`${itemType} updated successfully`);
      } else {
        await window.api.medicines.add(payload);
        toast(`${itemType} added successfully`);
      }

      setModalOpen(false);
      setForm(initialForm);
      setIsGeneralItem(false);
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

  function adjustStock(item, qty) {
    requireAuth(async () => {
      await window.api.medicines.adjustStock(item.id, qty);
      toast(`Stock ${qty > 0 ? 'increased' : 'reduced'} for ${item.name}`);
      load();
    });
  }

  function importCsv(file) {
    requireAuth(async () => {
      const content = await file.text();
      await window.api.medicines.importCsv(content);
      toast('Inventory imported successfully');
      load();
    });
  }

  function exportCsv() {
    requireAuth(async () => {
      await window.api.medicines.exportCsv();
      toast('Inventory export generated');
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
          <Input label="Search Medicines" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, HSN, batch" />
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
              title="Click to lock editing"
            >
              <ShieldCheck size={14} />
              Unlocked
              <LogOut size={12} className="ml-0.5 opacity-60" />
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700">
              <Lock size={14} />
              Locked
            </span>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={16} className="mr-2" /> Bulk Import
          </Button>
          <Button variant="secondary" onClick={exportCsv}>
            <Download size={16} className="mr-2" /> Export
          </Button>
          <Button onClick={openAddModal}>
            <Plus size={16} className="mr-2" /> Add Stock
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="max-h-[68vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {[
                  ['name', 'Product Name'],
                  ['pack', 'Pack'],
                  ['hsn_code', 'HSN'],
                  ['batch', 'Batch'],
                  ['expiry', 'Expiry'],
                  ['mrp', 'MRP'],
                  ['stock_qty', 'Stock Qty'],
                  ['tablets_per_sheet', 'Tab/Sheet'],
                  ['supplier_name', 'Supplier'],
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
                const stock = formatStock(item.stock_qty, item.tablets_per_sheet);
                return (
                <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                  <td className="px-4 py-3">{item.pack}</td>
                  <td className="px-4 py-3">{item.hsn_code}</td>
                  <td className="px-4 py-3">{item.batch}</td>
                  <td className={`px-4 py-3 ${isExpired(item.expiry) ? 'text-danger' : isExpiringWithin(item.expiry) ? 'text-warning' : ''}`}>
                    {item.expiry}
                  </td>
                  <td className="px-4 py-3">{formatCurrency(item.mrp)}</td>
                  <td className="px-4 py-3 font-semibold">
                    {stock.hasSheets ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-900">{item.stock_qty} total</span>
                        <span className="text-xs font-medium text-indigo-600">
                          {stock.display}
                        </span>
                      </div>
                    ) : (
                      item.stock_qty
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {Number(item.tablets_per_sheet) > 0 ? item.tablets_per_sheet : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 truncate max-w-[150px]" title={item.supplier_name}>
                    {item.supplier_name?.[0] ? item.supplier_name : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" className="px-3 py-2" onClick={() => adjustStock(item, 1)}>
                        +1
                      </Button>
                      <Button variant="secondary" className="px-3 py-2" onClick={() => adjustStock(item, -1)}>
                        -1
                      </Button>
                      <Button variant="secondary" className="px-3 py-2" onClick={() => openEditModal(item)}>
                        <Pencil size={14} />
                      </Button>
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
                  <td colSpan="12" className="px-4 py-12 text-center text-slate-500">
                    No medicines found for the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={editingId ? (isGeneralItem ? 'Edit General Item' : 'Edit Medicine') : (isGeneralItem ? 'Add General Item' : 'Add Medicine')}
        onClose={() => { setModalOpen(false); setIsGeneralItem(false); }}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); setIsGeneralItem(false); }}>
              Cancel
            </Button>
            <Button type="button" onClick={submit}>
              {editingId ? (isGeneralItem ? 'Update General Item' : 'Update Medicine') : (isGeneralItem ? 'Add General Item' : 'Add Medicine')}
            </Button>
          </div>
        }
      >
        <form ref={formRef} id="medicine-form" className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          {isGeneralItem ? (
            <>
              {[
                ['name', 'Product Name *'],
                ['mrp', 'MRP (₹) *'],
                ['expiry', 'Expiry Date *'],
                ['stock_qty', 'Stock Quantity *'],
              ].map(([key, label]) => (
                <Input
                  key={key}
                  label={label}
                  type={['mrp', 'stock_qty'].includes(key) ? 'number' : 'text'}
                  value={form[key]}
                  required={['name', 'mrp', 'stock_qty'].includes(key)}
                  min={['mrp', 'stock_qty'].includes(key) ? 0 : undefined}
                  step={['mrp'].includes(key) ? '0.01' : ['stock_qty'].includes(key) ? '1' : undefined}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              ))}
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
            </>
          ) : (
            <>
              {[
                ['name', 'Product Name *'],
                ['expiry', 'Expiry (MM/YY) *'],
                ['mrp', 'MRP (₹) *'],
                ['tablets_per_sheet', 'Tablets per Sheet (0 = N/A)'],
                ['stock_qty', 'Current Stock Quantity (total tablets) *'],
              ].map(([key, label]) => (
                <Input
                  key={key}
                  label={label}
                  type={['mrp', 'stock_qty', 'tablets_per_sheet'].includes(key) ? 'number' : 'text'}
                  value={form[key]}
                  required={['name', 'expiry', 'mrp', 'stock_qty'].includes(key)}
                  min={['mrp', 'stock_qty', 'tablets_per_sheet'].includes(key) ? 0 : undefined}
                  step={['mrp'].includes(key) ? '0.01' : ['stock_qty', 'tablets_per_sheet'].includes(key) ? '1' : undefined}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              ))}
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
              {Number(form.tablets_per_sheet) > 0 && Number(form.stock_qty) > 0 && (
                <div className="md:col-span-2 rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm text-indigo-800">
                  <span className="font-semibold">Stock preview: </span>
                  {formatStock(form.stock_qty, form.tablets_per_sheet).display}
                  <span className="text-indigo-500 ml-1">({form.stock_qty} total tablets)</span>
                </div>
              )}
            </>
          )}
        </form>
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
