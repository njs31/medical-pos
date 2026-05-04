import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { calculateBillTotals } from '@/utils/calculations';
import { formatCurrency, formatInventoryQty, isExpiringWithin, todayIso } from '@/utils/formatters';
import { numberToIndianWords } from '@/utils/numberToWords';

function getCategoryBadge(category) {
  if (category === 'Medicine') return <span className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold bg-yellow-100 text-yellow-700 mr-1" title="Medicine">M</span>;
  if (category === 'General') return <span className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold bg-blue-100 text-blue-700 mr-1" title="General">G</span>;
  if (category === 'Surgical') return <span className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold bg-green-100 text-green-700 mr-1" title="Surgical">S</span>;
  return null;
}

function getProductTypeShortLabel(type) {
  return String(type || '').toLowerCase() === 'ethical' ? 'E' : 'G';
}

function SheetTabletInput({ qty, tabletsPerSheet, error, onChange }) {
  const tps = Number(tabletsPerSheet) || 1;
  const totalQty = Number(qty) || 0;
  const sheets = Math.floor(totalQty / tps);
  const tablets = totalQty % tps;

  const sRef = useRef(null);
  const tRef = useRef(null);

  function handleSheetChange(e) {
    let v = e.target.value;
    if (/^0\d/.test(v)) v = v.replace(/^0+(?=\d)/, '');
    const s = Number(v) || 0;
    onChange(s * tps + tablets);
  }

  function handleTabletChange(e) {
    let v = e.target.value;
    if (/^0\d/.test(v)) v = v.replace(/^0+(?=\d)/, '');
    const t = Number(v) || 0;
    onChange(sheets * tps + t);
  }

  function handleSheetKeyDown(e) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      tRef.current?.focus();
      tRef.current?.select();
    }
  }

  const borderClass = error ? 'border-red-500 bg-red-50 text-red-700 shake-animation' : 'border-slate-300';

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        <input
          ref={sRef}
          className={`w-12 rounded-lg border px-2 py-2 text-center font-bold transition-all outline-none focus:border-blue-500 ${borderClass}`}
          type="number"
          min="0"
          step="1"
          value={sheets}
          onFocus={(e) => e.target.select()}
          onChange={handleSheetChange}
          onKeyDown={handleSheetKeyDown}
        />
        <span className="ml-0.5 text-[10px] font-bold text-slate-400">S</span>
      </div>
      <div className="flex items-center">
        <input
          ref={tRef}
          className={`w-12 rounded-lg border px-2 py-2 text-center font-bold transition-all outline-none focus:border-blue-500 ${borderClass}`}
          type="number"
          min="0"
          max={tps - 1}
          step="1"
          value={tablets}
          onFocus={(e) => e.target.select()}
          onChange={handleTabletChange}
        />
        <span className="ml-0.5 text-[10px] font-bold text-slate-400">T</span>
      </div>
    </div>
  );
}

function createEmptyBill(settings) {
  return {
    patient_name: '',
    patient_phone: '',
    doctor_name: settings?.default_doctor || '',
    invoice_no: '',
    date: todayIso(),
    discount_percent: settings?.default_discount || '',
    items: [],
  };
}

function MetricTile({ label, value, accent = 'slate' }) {
  const accents = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${accents[accent]}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-bold">{value}</div>
    </div>
  );
}

export default function NewBill({ toast, onBillSaved, persistentBill, setPersistentBill, shopSettings, editBillId, onNavigate }) {
  const isEditing = Boolean(editBillId);
  const [settings, setSettings] = useState(shopSettings);
  const [bill, setBill] = useState(isEditing ? createEmptyBill(shopSettings) : (persistentBill || createEmptyBill(shopSettings)));
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);

  async function loadInitial() {
    const nextInvoice = await window.api.bills.getNextInvoiceNo();
    const loadedSettings = shopSettings || (await window.api.settings.get());
    setSettings(loadedSettings);

    // Only clear everything if we don't have a persistent bill with items
    if (!persistentBill || !persistentBill.items.length) {
      const newBill = {
        ...createEmptyBill(loadedSettings),
        invoice_no: nextInvoice,
      };
      setBill(newBill);
      setPersistentBill(newBill);
    } else {
      // Force update invoice no just in case
      const updated = { ...persistentBill, invoice_no: nextInvoice };
      setBill(updated);
      setPersistentBill(updated);
    }
  }

  async function loadForEdit(id) {
    const loadedSettings = shopSettings || (await window.api.settings.get());
    setSettings(loadedSettings);
    const existing = await window.api.bills.getForEdit(id);
    if (!existing) {
      toast('Bill not found', 'error');
      onNavigate?.('bill-history');
      return;
    }
    setBill({
      patient_name: existing.patient_name || '',
      patient_phone: existing.patient_phone || '',
      doctor_name: existing.doctor_name || '',
      invoice_no: existing.invoice_no || '',
      date: existing.date || todayIso(),
      discount_percent: existing.discount_percent || '',
      status: existing.status || 'saved',
      items: (existing.items || []).map((item) => ({
        medicine_id: item.medicine_id,
        product_name: item.product_name,
        pack: item.pack,
        hsn_code: item.hsn_code,
        batch: item.batch,
        expiry: item.expiry,
        qty: Number(item.qty) || 0,
        mrp: Number(item.mrp) || 0,
        rate: Number(item.rate) || 0,
        purchase_rate: Number(item.purchase_rate) || 0,
        amount: Number(item.amount) || 0,
        stock_qty: Number(item.stock_qty) || 0,
        item_category: item.item_category || 'Medicine',
        discount: Number(item.discount) || 0,
        tablets_per_sheet: Number(item.tablets_per_sheet) || 0,
      })),
    });
  }

  useEffect(() => {
    if (isEditing) {
      loadForEdit(editBillId);
    } else if (!persistentBill) {
      loadInitial();
    }
  }, [editBillId, isEditing, persistentBill]);

  // Sync back to persistence on every change (only when not editing)
  useEffect(() => {
    if (!isEditing) setPersistentBill(bill);
  }, [bill, isEditing, setPersistentBill]);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setResults(await window.api.medicines.search(search));
    }, 150);
    return () => clearTimeout(timer);
  }, [search]);

  const totals = useMemo(
    () => calculateBillTotals(bill.items, bill.discount_percent),
    [bill.discount_percent, bill.items],
  );

  function addItem(medicine) {
    setBill((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          medicine_id: medicine.id,
          product_name: medicine.name,
          pack: medicine.pack,
          hsn_code: medicine.hsn_code,
          batch: medicine.batch,
          expiry: medicine.expiry,
          qty: Number(medicine.tablets_per_sheet) > 0 ? Number(medicine.tablets_per_sheet) : 1,
          mrp: medicine.mrp,
          rate: Number(medicine.tablets_per_sheet) > 0
            ? Number(medicine.mrp) / Number(medicine.tablets_per_sheet)
            : Number(medicine.mrp),
          purchase_rate: Number(medicine.purchase_rate) || 0,
          amount: medicine.rate,
          stock_qty: medicine.stock_qty,
          item_category: medicine.item_category || 'Medicine',
          discount: 0,
          tablets_per_sheet: medicine.tablets_per_sheet || 0,
        },
      ],
    }));
    setSearch('');
    setResults([]);
  }

  function updateItem(index, key, value) {
    setBill((prev) => ({
      ...prev,
      items: prev.items.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)),
    }));
  }

  function removeItem(index) {
    setBill((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  }

  async function saveBill(status, shouldPrint = false) {
    if (Object.keys(errors).length > 0) {
      const lossError = Object.entries(errors).find(([key]) => key.endsWith('_loss'));
      if (lossError) {
        toast(`Cannot bill: ${lossError[1]}`, 'error');
      } else {
        toast('Please fix the errors before saving', 'error');
      }
      return;
    }
    if (!bill.items.length) {
      toast('Add at least one product to the bill', 'error');
      return;
    }

    const payload = {
      ...bill,
      status: isEditing ? (bill.status || status) : status,
      items: totals.items,
      subtotal: totals.subtotal,
      discount_percent: Number(bill.discount_percent || 0),
      discount_amount: totals.discountAmount,
      grand_total: totals.grandTotal,
    };

    if (isEditing) {
      const saved = await window.api.bills.update(editBillId, payload);
      toast(`Bill ${saved.invoice_no} updated successfully`);
      if (shouldPrint) await window.api.bills.print(saved.id);
      onBillSaved?.();
      onNavigate?.('bill-history');
      return;
    }

    const saved = await window.api.bills.create(payload);
    toast(`Bill ${saved.invoice_no} saved successfully`);
    if (shouldPrint) await window.api.bills.print(saved.id);
    onBillSaved?.();
    setPersistentBill(null); // Explicitly clear persistence
    loadInitial();
  }

  function handlePhoneChange(val) {
    const numeric = val.replace(/\D/g, '');
    setBill((prev) => ({ ...prev, patient_phone: numeric }));
  }

  function handleNameChange(key, val) {
    setBill((prev) => ({ ...prev, [key]: val }));
  }

  const errors = useMemo(() => {
    const errs = {};
    if (bill.patient_phone && bill.patient_phone.length !== 10) {
      errs.patient_phone = 'Please enter exactly 10 digits';
    }
    if (/[0-9]/.test(bill.patient_name)) {
      errs.patient_name = 'Numbers are not allowed in name';
    }
    if (/[0-9]/.test(bill.doctor_name)) {
      errs.doctor_name = 'Numbers are not allowed in doctor name';
    }

    const globalDiscPct = Math.max(0, Math.min(100, Number(bill.discount_percent || 0)));
    const globalFactor = 1 - globalDiscPct / 100;

    // Stock validation
    bill.items.forEach((item, index) => {
      if (item.qty > item.stock_qty) {
        errs[`item_${index}_qty`] = `You cannot bill more than what is in your current inventory. Your inventory: ${formatInventoryQty(item.stock_qty, item.tablets_per_sheet, item.item_category)}`;
      }

      const purchaseRate = Number(item.purchase_rate) || 0;
      const sellRate = Number(item.rate) || 0;
      const lineDiscPct = Math.max(0, Math.min(100, Number(item.discount || 0)));
      const effectiveRate = sellRate * (1 - lineDiscPct / 100) * globalFactor;
      if (purchaseRate > 0 && effectiveRate < purchaseRate) {
        const tps = Number(item.tablets_per_sheet) || 0;
        const isPerSheet = item.item_category === 'Medicine' && tps > 0;
        const purchaseDisplay = isPerSheet ? purchaseRate * tps : purchaseRate;
        const sellDisplay = isPerSheet ? effectiveRate * tps : effectiveRate;
        const unitLabel = isPerSheet ? 'sheet' : 'unit';
        errs[`item_${index}_loss`] = `Selling below purchase cost after discount. Purchase ${formatCurrency(purchaseDisplay)}/${unitLabel} > selling ${formatCurrency(sellDisplay)}/${unitLabel}.`;
      }
    });

    return errs;
  }, [bill.patient_phone, bill.patient_name, bill.doctor_name, bill.items, bill.discount_percent]);

  const hasLossError = useMemo(
    () => Object.keys(errors).some((k) => k.endsWith('_loss')),
    [errors],
  );

  const [lossBannerVisible, setLossBannerVisible] = useState(false);
  const prevHadLoss = useRef(false);
  useEffect(() => {
    if (hasLossError && !prevHadLoss.current) {
      setLossBannerVisible(true);
      const t = setTimeout(() => setLossBannerVisible(false), 2000);
      prevHadLoss.current = true;
      return () => clearTimeout(t);
    }
    if (!hasLossError) prevHadLoss.current = false;
  }, [hasLossError]);

  function clearBill() {
    if (isEditing) {
      if (!window.confirm('Discard your changes and return to bill history?')) return;
      onNavigate?.('bill-history');
      return;
    }
    if (!window.confirm('Clear the current bill?')) return;
    setSearch('');
    setResults([]);
    setPersistentBill(null); // Explicitly clear
    loadInitial();
  }

  return (
    <div className="flex min-h-[calc(100vh-190px)] flex-col gap-5 pb-2">
      <section className="rounded-[28px] bg-white p-6 shadow-card">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-shrink-0">
            <div className="text-xs font-bold uppercase tracking-[0.32em] text-slate-400">
              {isEditing ? 'Editing Bill' : 'Patient Desk'}
            </div>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900">
              {isEditing ? `Edit ${bill.invoice_no || 'Bill'}` : 'Patient & Invoice'}
            </h2>
          </div>
          
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 items-end">
            <Input
              label="Patient Phone"
              value={bill.patient_phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              error={errors.patient_phone}
              placeholder="e.g. 9876543210"
              maxLength={10}
            />
            <Input
              label="Patient Name"
              value={bill.patient_name}
              onChange={(e) => handleNameChange('patient_name', e.target.value)}
              error={errors.patient_name}
              placeholder="Patient's Full Name"
            />
            <Input
              label="Doctor Name"
              value={bill.doctor_name}
              onChange={(e) => handleNameChange('doctor_name', e.target.value)}
              error={errors.doctor_name}
              placeholder="Prescribing Physician"
            />
            <Input
              label="Date"
              type="date"
              value={bill.date}
              onChange={(e) => setBill((prev) => ({ ...prev, date: e.target.value }))}
            />
            <Input label="Invoice No" value={bill.invoice_no} readOnly />
          </div>
        </div>
      </section>

      <section className="flex min-h-[320px] flex-1 flex-col rounded-[28px] bg-white p-6 shadow-card">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.32em] text-slate-400">Bill Items</div>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900">Inventory Search & Items</h2>
          </div>
          
          <div className="relative flex-1 max-w-xl">
            <input
              type="text"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition"
              placeholder="🔍 Search product by name, batch, or HSN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {results.length > 0 && (
              <div className="absolute z-20 mt-2 max-h-[400px] w-full overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl scale-in-center">
                {results.map((item) => (
                  <button
                    key={item.id}
                    className="grid w-full grid-cols-[2fr_1fr_1fr_1fr] gap-4 border-b border-slate-50 px-5 py-4 text-left text-sm transition hover:bg-blue-50"
                    onClick={() => addItem(item)}
                  >
                    <div>
                      <div className="flex items-center gap-2 font-bold text-slate-900">
                        <span>{getCategoryBadge(item.item_category || 'Medicine')}{item.name}</span>
                        <span
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-black text-slate-600"
                          title={item.product_type || 'Generic'}
                        >
                          {getProductTypeShortLabel(item.product_type)}
                        </span>
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">Batch: {item.batch}</div>
                    </div>
                    <div className="text-slate-600">Exp: {item.expiry}</div>
                    <div className="text-slate-600">
                      Qty: {formatInventoryQty(item.stock_qty, item.tablets_per_sheet, item.item_category)}
                    </div>
                    <div className="font-bold text-blue-600 text-right">{formatCurrency(item.mrp)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="min-h-[260px] flex-1 overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-100 text-left text-base font-black uppercase tracking-wide text-slate-700">
              <tr>
                {['#', 'Product', 'Batch', 'Exp', 'Qty', 'MRP', 'Disc%', 'Amount', ''].map((heading) => (
                  <th key={heading} className="px-4 py-4">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {totals.items.map((item, index) => (
                <tr key={`${item.medicine_id}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-4 py-4">{index + 1}</td>
                  <td className="px-4 py-4 font-semibold text-slate-900">{getCategoryBadge(item.item_category || 'Medicine')}{item.product_name}</td>
                  <td className="px-4 py-4">{item.batch}</td>
                  <td className={`px-4 py-4 ${isExpiringWithin(item.expiry, 90) ? 'font-semibold text-warning' : ''}`}>
                    {item.expiry}
                  </td>
                  <td className="px-4 py-4">
                    <div className="relative group">
                      {Number(item.tablets_per_sheet) > 0 ? (
                        <SheetTabletInput
                          qty={item.qty}
                          tabletsPerSheet={item.tablets_per_sheet}
                          error={errors[`item_${index}_qty`]}
                          onChange={(totalQty) => updateItem(index, 'qty', totalQty)}
                        />
                      ) : (
                        <input
                          className={`w-20 rounded-xl border px-3 py-2 font-semibold transition-all ${
                            errors[`item_${index}_qty`] ? 'border-red-500 bg-red-50 text-red-700 shake-animation' : 'border-slate-300'
                          }`}
                          type="number"
                          min="0"
                          step="1"
                          value={item.qty}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            let v = e.target.value;
                            if (/^0\d/.test(v)) {
                              v = v.replace(/^0+(?=\d)/, '');
                              e.target.value = v;
                            }
                            updateItem(index, 'qty', Number(v));
                          }}
                        />
                      )}
                      <div className="mt-1 text-[11px] font-medium text-slate-400">
                        Stock: {formatInventoryQty(item.stock_qty, item.tablets_per_sheet, item.item_category)}
                      </div>
                      {errors[`item_${index}_qty`] && (
                        <div className="absolute left-0 top-full z-10 mt-1 w-[240px] rounded-lg bg-red-600 p-2 text-[11px] font-bold text-white shadow-xl">
                          {errors[`item_${index}_qty`]}
                          <div className="absolute -top-1 left-4 h-2 w-2 rotate-45 bg-red-600" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-700">
                    <div className="relative group">
                      <div className={errors[`item_${index}_loss`] ? 'text-red-700 font-bold' : ''}>
                        {formatCurrency(item.mrp)}
                      </div>
                      {errors[`item_${index}_loss`] && (
                        <>
                          <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-red-600">
                            ⚠ Loss
                          </div>
                          <div className="absolute left-0 top-full z-10 mt-1 w-[260px] rounded-lg bg-red-600 p-2 text-[11px] font-bold text-white shadow-xl">
                            {errors[`item_${index}_loss`]}
                            <div className="absolute -top-1 left-4 h-2 w-2 rotate-45 bg-red-600" />
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center">
                      <input
                        className="w-16 rounded-xl border border-slate-300 px-2 py-2 font-bold text-slate-700 transition focus:border-blue-500 outline-none"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={item.discount ?? 0}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          let v = e.target.value;
                          if (/^0\d/.test(v)) {
                            v = v.replace(/^0+(?=\d)/, '');
                            e.target.value = v;
                          }
                          updateItem(index, 'discount', v === '' ? 0 : Number(v));
                        }}
                      />
                      <span className="ml-1 text-xs font-bold text-slate-400">%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-bold text-slate-900">{formatCurrency(item.amount)}</td>
                  <td className="px-4 py-4">
                    <button
                      className="rounded-full bg-red-50 px-3 py-1 text-lg text-danger transition hover:bg-red-100"
                      onClick={() => removeItem(index)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              {!bill.items.length && (
                <tr>
                  <td colSpan="13" className="px-4 py-16 text-center">
                    <div className="mx-auto max-w-md rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10">
                      <div className="text-lg font-bold text-slate-800">No products added yet</div>
                      <div className="mt-2 text-sm text-slate-500">
                        Use the product search panel above to add items to the bill.
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-6 shadow-card border border-slate-100 mt-2">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Subtotal</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-900">{formatCurrency(totals.subtotal)}</div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Discount</div>
              <div className="mt-1 text-2xl font-extrabold text-red-600">- {formatCurrency(totals.discountAmount)}</div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 rounded-2xl border border-blue-100 bg-blue-50/50 p-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-blue-500">Grand Total Payable</div>
                <div className="mt-1 text-4xl font-black text-slate-900 tracking-tight">{formatCurrency(totals.grandTotal)}</div>
                <div className="mt-2 text-sm italic font-medium text-slate-500">
                  {numberToIndianWords(totals.grandTotal)}
                </div>
              </div>

              <div className="grid w-full sm:w-auto gap-3 min-w-[200px]">
                <button
                  onClick={() => saveBill('saved', true)}
                  disabled={hasLossError}
                  className="w-full rounded-xl bg-blue-600 px-6 py-4 font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:hover:bg-slate-300 disabled:active:scale-100"
                >
                  {isEditing ? 'Update & Print' : 'Save & Print'}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => saveBill('saved', false)}
                    disabled={hasLossError}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:bg-slate-100 disabled:active:scale-100"
                  >
                    {isEditing ? 'Update' : 'Save'}
                  </button>
                  <button
                    onClick={clearBill}
                    className="rounded-xl border border-red-100 bg-red-50/50 px-4 py-2.5 text-xs font-bold text-red-500 transition hover:bg-red-50 active:scale-95"
                  >
                    {isEditing ? 'Cancel' : 'Clear Bill'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {lossBannerVisible && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-2xl scale-in-center">
          Selling price is below purchase cost. Save disabled.
        </div>
      )}
    </div>
  );
}
