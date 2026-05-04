import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { calculateBillTotals } from '@/utils/calculations';
import { formatCurrency, formatInventoryQty, todayIso } from '@/utils/formatters';
import { numberToIndianWords } from '@/utils/numberToWords';

function parseManualQty(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return 0;

  const sheetMatch = raw.match(/(\d+)\s*S/);
  const tabletMatch = raw.match(/(\d+)\s*T/);

  if (sheetMatch || tabletMatch) {
    const sheets = Number(sheetMatch?.[1] || 0);
    const tablets = Number(tabletMatch?.[1] || 0);
    return sheets + tablets;
  }

  const numberMatch = raw.match(/\d+(?:\.\d+)?/);
  return Number(numberMatch?.[0] || 0);
}

function ManualQuantityInput({ item, onChange }) {
  return (
    <input
      className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 font-black text-slate-900 outline-none focus:border-blue-500 transition-all shadow-sm placeholder:text-slate-300"
      type="text"
      value={item.qty_input ?? String(item.qty ?? '')}
      placeholder="e.g. 10 or 10 pcs"
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const qtyInput = e.target.value;
        onChange({
          qty_input: qtyInput,
          qty: parseManualQty(qtyInput),
        });
      }}
    />
  );
}

function DualQuantityInput({ item, onChange }) {
  const tps = Number(item.tablets_per_sheet) || 0;
  const mode = item.input_mode || 'sheet'; // default to sheet
  const supportsSheetInput = tps > 0 && item.item_category === 'Medicine';
  
  const sheets = supportsSheetInput ? Math.floor(item.qty / tps) : 0;
  const tablets = supportsSheetInput ? item.qty % tps : 0;

  const sRef = useRef(null);
  const tRef = useRef(null);
  const uRef = useRef(null);

  function handleSheetChange(val) {
    const s = Number(val) || 0;
    onChange({ qty: s * tps + tablets, input_mode: 'sheet' });
  }

  function handleTabletChange(val) {
    const t = Number(val) || 0;
    onChange({ qty: sheets * tps + t, input_mode: 'sheet' });
  }

  function handleUnitChange(val) {
    const q = Number(val) || 0;
    onChange({ qty: q, input_mode: 'unit' });
  }

  const isSheetMode = supportsSheetInput && mode === 'sheet';
  const isUnitMode = !supportsSheetInput || mode === 'unit';

  if (!supportsSheetInput) {
    return (
      <div className="flex items-center">
        <input
          ref={uRef}
          className="w-20 h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-2 font-black text-slate-900 outline-none focus:border-blue-500 transition-all shadow-sm"
          type="number"
          min="0"
          value={item.qty}
          onFocus={(e) => e.target.select()}
          onChange={(e) => handleUnitChange(e.target.value)}
        />
        <span className="ml-1 text-[11px] font-black text-slate-400">QTY</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {/* S/T Inputs */}
      <div className={`flex items-center gap-1 transition-opacity ${isUnitMode ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
        <div className="flex items-center">
          <input
            ref={sRef}
            className="w-12 h-[38px] rounded-xl border border-slate-200 bg-white px-2 py-2 text-center font-black text-slate-900 outline-none focus:border-blue-500 transition-all shadow-sm"
            type="number"
            min="0"
            value={sheets}
            onFocus={(e) => { e.target.select(); onChange({ input_mode: 'sheet' }); }}
            onChange={(e) => handleSheetChange(e.target.value)}
          />
          <span className="ml-1 text-[11px] font-black text-slate-400">S</span>
        </div>
        <div className="flex items-center">
          <input
            ref={tRef}
            className="w-12 h-[38px] rounded-xl border border-slate-200 bg-white px-2 py-2 text-center font-black text-slate-900 outline-none focus:border-blue-500 transition-all shadow-sm"
            type="number"
            min="0"
            max={tps - 1}
            value={tablets}
            onFocus={(e) => { e.target.select(); onChange({ input_mode: 'sheet' }); }}
            onChange={(e) => handleTabletChange(e.target.value)}
          />
          <span className="ml-1 text-[11px] font-black text-slate-400">T</span>
        </div>
      </div>

      {/* Mode Switcher / Divider */}
      <div className="h-6 w-[2px] bg-slate-100 hidden sm:block"></div>

      {/* Units Input */}
      <div className={`flex items-center transition-opacity ${isSheetMode ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
        <div className="relative">
          <input
            ref={uRef}
            className="w-20 h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-2 font-black text-slate-900 outline-none focus:border-blue-500 transition-all shadow-sm"
            type="number"
            min="0"
            value={item.qty}
            onFocus={(e) => { e.target.select(); onChange({ input_mode: 'unit' }); }}
            onChange={(e) => handleUnitChange(e.target.value)}
          />
          <div className="absolute right-2 top-0 bottom-0 flex flex-col justify-center gap-0.5 opacity-20 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
        <span className="ml-1 text-[11px] font-black text-slate-400">QTY</span>
      </div>
      
      {/* Reset/Toggle Button */}
      <button 
        onClick={() => onChange({ input_mode: isSheetMode ? 'unit' : 'sheet' })}
        className="text-[10px] font-black text-blue-500 hover:text-blue-700 uppercase tracking-tighter ml-[-5px]"
      >
        Switch
      </button>
    </div>
  );
}

export default function QuickBill({ toast, shopSettings, editBillId, onNavigate }) {
  const isEditing = Boolean(editBillId);
  const [bill, setBill] = useState({
    patient_name: '',
    patient_phone: '',
    doctor_name: shopSettings?.default_doctor || '',
    date: todayIso(),
    items: [],
  });

  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (search.trim().length > 1) {
      window.api.medicines.search(search).then(setResults);
    } else {
      setResults([]);
    }
  }, [search]);

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      const existing = await window.api.bills.getForEdit(editBillId);
      if (!existing) {
        toast('Quick bill not found', 'error');
        onNavigate?.('quick-history');
        return;
      }
      setBill({
        patient_name: existing.patient_name || '',
        patient_phone: existing.patient_phone || '',
        doctor_name: existing.doctor_name || '',
        date: existing.date || todayIso(),
        invoice_no: existing.invoice_no || '',
        status: existing.status || 'quick-saved',
        items: (existing.items || []).map((item, idx) => ({
          id: item.medicine_id ? `inv-${item.id}-${idx}` : `quick-${item.id}-${idx}`,
          medicine_id: null, // QuickBill never reduces inventory
          product_name: item.product_name || '',
          pack: item.pack || '',
          hsn_code: item.hsn_code || '',
          batch: item.batch || '-',
          expiry: item.expiry || '-',
          qty: Number(item.qty) || 0,
          mrp: Number(item.mrp) || 0,
          rate: Number(item.rate) || 0,
          purchase_rate: Number(item.purchase_rate) || 0,
          amount: Number(item.amount) || 0,
          stock_qty: 99999,
          item_category: item.item_category || 'General',
          discount: Number(item.discount) || 0,
          tablets_per_sheet: Number(item.tablets_per_sheet) || 0,
          input_mode: Number(item.tablets_per_sheet) > 0 ? 'sheet' : 'unit',
          qty_input: String(item.qty || ''),
        })),
      });
    })();
  }, [editBillId, isEditing]);

  const totals = useMemo(
    () => calculateBillTotals(bill.items, 0),
    [bill.items],
  );

  const lossErrors = useMemo(() => {
    const errs = {};
    bill.items.forEach((item, index) => {
      const purchaseRate = Number(item.purchase_rate) || 0;
      const sellRate = Number(item.rate) || 0;
      if (purchaseRate > 0 && sellRate < purchaseRate) {
        const tps = Number(item.tablets_per_sheet) || 0;
        const isPerSheet = item.item_category === 'Medicine' && tps > 0;
        const purchaseDisplay = isPerSheet ? purchaseRate * tps : purchaseRate;
        const sellDisplay = isPerSheet ? sellRate * tps : sellRate;
        const unitLabel = isPerSheet ? 'sheet' : 'unit';
        errs[index] = `Selling below purchase cost. Purchase ${formatCurrency(purchaseDisplay)}/${unitLabel} > selling ${formatCurrency(sellDisplay)}/${unitLabel}.`;
      }
    });
    return errs;
  }, [bill.items]);

  function handlePhoneChange(val) {
    const numeric = val.replace(/\D/g, '');
    setBill((prev) => ({ ...prev, patient_phone: numeric }));
  }

  function addQuickItem() {
    setBill((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `quick-${Date.now()}-${Math.random()}`,
          medicine_id: null,
          product_name: 'New Item',
          pack: '',
          hsn_code: '',
          batch: '-',
          expiry: '-',
          qty: 1,
          mrp: 0,
          rate: 0,
          amount: 0,
          stock_qty: 99999,
          item_category: 'General',
          discount: 0,
          tablets_per_sheet: 0,
          input_mode: 'unit',
          qty_input: '1',
        },
      ],
    }));
  }

  function addItemFromInventory(medicine) {
    setBill((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `inv-${Date.now()}-${Math.random()}`,
          // Set medicine_id to null so it doesn't affect inventory stock reduction
          medicine_id: null, 
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
          input_mode: Number(medicine.tablets_per_sheet) > 0 ? 'sheet' : 'unit',
        },
      ],
    }));
    setSearch('');
    setResults([]);
  }

  function updateItem(index, update) {
    setBill((prev) => ({
      ...prev,
      items: prev.items.map((item, idx) => (idx === index ? { ...item, ...update } : item)),
    }));
  }

  function removeItem(index) {
    setBill((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  }

  async function saveQuickBill(status, shouldPrint = false) {
    if (!bill.items.length) {
      toast('Add at least one item', 'error');
      return;
    }
    const firstLoss = Object.values(lossErrors)[0];
    if (firstLoss) {
      toast(`Cannot bill: ${firstLoss}`, 'error');
      return;
    }
    const payload = {
      ...bill,
      invoice_no: isEditing ? bill.invoice_no : 'QK-' + Date.now().toString().slice(-6),
      status: isEditing ? (bill.status || `quick-${status}`) : `quick-${status}`,
      items: totals.items,
      subtotal: totals.subtotal,
      discount_percent: Number(bill.discount_percent || 0),
      discount_amount: totals.discountAmount,
      grand_total: totals.grandTotal,
    };

    if (isEditing) {
      const saved = await window.api.bills.update(editBillId, payload);
      toast(`Quick Bill ${saved.invoice_no} updated`);
      if (shouldPrint) await window.api.bills.print(saved.id);
      onNavigate?.('quick-history');
      return;
    }

    const saved = await window.api.bills.create(payload);
    toast(`Quick Bill ${status === 'draft' ? 'drafted' : 'saved'} successfully`);

    if (shouldPrint) {
      await window.api.bills.print(saved.id);
    }

    setBill({
      patient_name: '',
      patient_phone: '',
      doctor_name: shopSettings?.default_doctor || '',
      date: todayIso(),
      discount_percent: shopSettings?.default_discount || 0,
      items: [],
    });
  }

  function clearBill() {
    if (isEditing) {
      if (!window.confirm('Discard your changes and return to history?')) return;
      onNavigate?.('quick-history');
      return;
    }
    if (!window.confirm('Clear the current quick bill?')) return;
    setBill({
      patient_name: '',
      patient_phone: '',
      doctor_name: shopSettings?.default_doctor || '',
      date: todayIso(),
      items: [],
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-190px)] flex-col gap-5 pb-2">
      <section className="rounded-[28px] bg-white p-6 shadow-card">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-shrink-0">
            <div className="text-xs font-bold uppercase tracking-[0.32em] text-slate-400">
              {isEditing ? 'Editing Quick Bill' : 'Direct Billing'}
            </div>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900">
              {isEditing ? `Edit ${bill.invoice_no || 'Quick Bill'}` : 'Quick Invoice'}
            </h2>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-5 lg:grid-cols-5 items-end">
            <Input
              label="Patient Phone"
              value={bill.patient_phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="e.g. 9876543210"
              maxLength={10}
            />
            <Input
              label="Patient Name"
              value={bill.patient_name}
              onChange={(e) => setBill(p => ({ ...p, patient_name: e.target.value }))}
              placeholder="Patient's Full Name"
            />
            <Input
              label="Doctor Name"
              value={bill.doctor_name}
              onChange={(e) => setBill(p => ({ ...p, doctor_name: e.target.value }))}
              placeholder="Prescribing Physician"
            />
            <Input
              label="Date"
              type="date"
              value={bill.date}
              onChange={(e) => setBill(p => ({ ...p, date: e.target.value }))}
            />
            <Button onClick={addQuickItem} className="h-[48px] bg-slate-900 text-white font-bold rounded-2xl">
              + Manual Item
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-6 shadow-card">
        <div className="relative">
          <div className="mb-4">
            <div className="text-xs font-bold uppercase tracking-[0.32em] text-slate-400">Inventory Search & Items</div>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900 italic">🔍 Search product by name, batch, or HSN...</h2>
          </div>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-lg font-semibold tracking-tight shadow-sm transition focus:border-blue-500 focus:bg-white outline-none"
            placeholder="Type at least 2 characters to search..."
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {results.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-auto rounded-3xl border border-slate-100 bg-white/95 p-2 shadow-2xl backdrop-blur-xl">
              {results.map((medicine) => (
                <div
                  key={medicine.id}
                  className="group flex cursor-pointer items-center justify-between rounded-2xl p-4 transition-all hover:bg-blue-600 hover:shadow-lg active:scale-[0.99]"
                  onClick={() => addItemFromInventory(medicine)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 group-hover:bg-blue-500/20">
                      <span className="text-lg font-black text-blue-600 group-hover:text-white">
                        {medicine.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center">
                        <span className="font-bold text-slate-900 group-hover:text-white">{medicine.name}</span>
                        <span className="ml-2 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">
                          {medicine.pack}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-400 group-hover:text-blue-100">
                        Batch: {medicine.batch} • Exp: {medicine.expiry}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-blue-600 group-hover:text-white">
                      {formatCurrency(medicine.mrp)}
                    </div>
                    <div className={`text-[10px] font-black uppercase tracking-wider ${medicine.stock_qty < 10 ? 'text-red-500 group-hover:text-red-200' : 'text-slate-400 group-hover:text-blue-100'}`}>
                      Stock: {formatInventoryQty(medicine.stock_qty, medicine.tablets_per_sheet, medicine.item_category)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 min-h-[300px] overflow-auto rounded-3xl border border-slate-100">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50/50 text-left text-base font-black uppercase tracking-widest text-slate-600 backdrop-blur-md">
              <tr>
                <th className="px-4 py-4">#</th>
                <th className="px-4 py-4">Product</th>
                <th className="px-4 py-4">Batch</th>
                <th className="px-4 py-4">Exp</th>
                <th className="px-4 py-4">Qty</th>
                <th className="px-4 py-4">MRP</th>
                <th className="px-4 py-4">Disc%</th>
                <th className="px-4 py-4">Amount</th>
                <th className="px-4 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((item, index) => (
                <tr key={item.id} className="group border-b border-slate-50 transition hover:bg-slate-50/50">
                  <td className="px-4 py-4 text-slate-400 font-bold">{index + 1}</td>
                  <td className="px-4 py-4 text-slate-900 font-bold">
                    <input
                      className="bg-transparent font-bold outline-none border-b border-transparent focus:border-blue-300 transition"
                      value={item.product_name}
                      onChange={(e) => updateItem(index, { product_name: e.target.value })}
                      placeholder="Product Name"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      className="w-20 bg-transparent text-xs text-slate-500 outline-none border-b border-transparent focus:border-blue-300 transition"
                      value={item.batch}
                      onChange={(e) => updateItem(index, { batch: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      className="w-16 bg-transparent text-xs text-slate-500 outline-none border-b border-transparent focus:border-blue-300 transition"
                      value={item.expiry}
                      onChange={(e) => updateItem(index, { expiry: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      {String(item.id).startsWith('quick-') ? (
                        <ManualQuantityInput
                          item={item}
                          onChange={(update) => updateItem(index, update)}
                        />
                      ) : (
                        <DualQuantityInput 
                          item={item} 
                          onChange={(update) => updateItem(index, update)} 
                        />
                      )}
                      {item.stock_qty < 99999 && (
                        <div className="mt-1 text-[11px] font-medium text-slate-400">
                          Stock: {formatInventoryQty(item.stock_qty, item.tablets_per_sheet, item.item_category)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="relative group">
                      <div className={`flex items-center font-bold ${lossErrors[index] ? 'text-red-700' : 'text-slate-900'}`}>
                        <span>₹</span>
                        <input
                          className="w-20 bg-transparent outline-none ml-1"
                          type="number"
                          value={item.mrp}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const tps = Number(item.tablets_per_sheet) || 0;
                            const hasSheetPricing = item.item_category === 'Medicine' && tps > 0;
                            const perTabletRate = hasSheetPricing ? val / tps : val;
                            updateItem(index, {
                              mrp: val,
                              rate: perTabletRate,
                            });
                          }}
                        />
                      </div>
                      {lossErrors[index] && (
                        <>
                          <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-red-600">
                            ⚠ Loss
                          </div>
                          <div className="absolute left-0 top-full z-10 mt-1 w-[260px] rounded-lg bg-red-600 p-2 text-[11px] font-bold text-white shadow-xl">
                            {lossErrors[index]}
                            <div className="absolute -top-1 left-4 h-2 w-2 rotate-45 bg-red-600" />
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center">
                      <input
                        className="w-20 rounded-xl border border-slate-300 px-2 py-2 text-center font-bold outline-none focus:border-blue-500 transition-all"
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateItem(index, { discount: Number(e.target.value) })}
                      />
                      <span className="ml-1 text-[10px] font-bold text-slate-400">%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-900 font-bold">
                    {formatCurrency(totals.items[index]?.amount || 0)}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      className="rounded-full bg-red-50 p-2 text-red-500 opacity-0 transition group-hover:opacity-100 hover:bg-red-100"
                      onClick={() => removeItem(index)}
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
              {!bill.items.length && (
                <tr>
                  <td colSpan="9" className="py-20 text-center">
                    <div className="mx-auto max-w-sm rounded-3xl border-2 border-dashed border-slate-100 p-12">
                      <div className="text-4xl mb-4 opacity-20">🛒</div>
                      <div className="text-sm font-bold text-slate-400">Search above or add a manual item to start billing</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-6 shadow-card border border-slate-100">
        <div className="grid gap-6 lg:grid-cols-2">
           <div className="flex flex-col gap-4">
              <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-6">
                <div className="flex flex-col gap-3">
                   <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Subtotal</span>
                      <span className="text-lg font-bold text-slate-900">{formatCurrency(totals.subtotal)}</span>
                   </div>
                   <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Discount</span>
                      <span className="text-lg font-bold text-slate-900">- {formatCurrency(totals.discountAmount)}</span>
                   </div>
                   <div className="mt-4 flex items-center justify-between border-t-2 border-slate-200 pt-5">
                      <span className="text-xl font-black text-slate-900">GRAND TOTAL</span>
                      <div className="text-right">
                        <span className="text-3xl font-black text-blue-600 block">{formatCurrency(totals.grandTotal)}</span>
                        <div className="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          {numberToIndianWords(totals.grandTotal)}
                        </div>
                      </div>
                   </div>
                </div>
              </div>
           </div>

           <div className="flex flex-col justify-end gap-3">
              <button
                onClick={() => saveQuickBill('saved', true)}
                className="w-full rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-xl font-black text-white shadow-xl shadow-blue-200 transition active:scale-[0.98] hover:shadow-2xl hover:-translate-y-0.5"
              >
                {isEditing ? '⚡ UPDATE & PRINT' : '⚡ SAVE & PRINT'}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => saveQuickBill('saved', false)}
                  className="rounded-2xl border-2 border-slate-100 bg-white p-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95"
                >
                  {isEditing ? 'Update (No Print)' : 'Save (No Print)'}
                </button>
                <button
                  onClick={clearBill}
                  className="rounded-2xl border-2 border-red-50 bg-red-50 p-4 text-sm font-bold text-red-600 transition hover:bg-red-100 active:scale-95"
                >
                  {isEditing ? 'Cancel' : 'Clear All'}
                </button>
              </div>
           </div>
        </div>
      </section>
    </div>
  );
}
