import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { calculateBillTotals } from '@/utils/calculations';
import { formatCurrency, isExpiringWithin, todayIso } from '@/utils/formatters';
import { numberToIndianWords } from '@/utils/numberToWords';

function createEmptyBill(settings) {
  return {
    patient_name: '',
    patient_phone: '',
    doctor_name: settings?.default_doctor || '',
    invoice_no: '',
    date: todayIso(),
    discount_percent: settings?.default_discount || 0,
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

export default function NewBill({ toast, onBillSaved, persistentBill, setPersistentBill, shopSettings }) {
  const [settings, setSettings] = useState(shopSettings);
  const [bill, setBill] = useState(persistentBill || createEmptyBill(shopSettings));
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

  useEffect(() => {
    if (!persistentBill) {
      loadInitial();
    }
  }, [persistentBill]);

  // Sync back to persistence on every change
  useEffect(() => {
    setPersistentBill(bill);
  }, [bill, setPersistentBill]);

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
          qty: 1,
          mrp: medicine.mrp,
          rate: medicine.rate,
          sgst_percent: medicine.sgst_percent,
          cgst_percent: medicine.cgst_percent,
          amount: medicine.rate,
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
    if (!bill.items.length) {
      toast('Add at least one medicine to the bill', 'error');
      return;
    }

    const payload = {
      ...bill,
      status,
      items: totals.items,
      subtotal: totals.subtotal,
      discount_percent: Number(bill.discount_percent || 0),
      discount_amount: totals.discountAmount,
      sgst_total: totals.sgstTotal,
      cgst_total: totals.cgstTotal,
      grand_total: totals.grandTotal,
    };

    const saved = await window.api.bills.create(payload);
    toast(`Bill ${saved.invoice_no} saved successfully`);
    if (shouldPrint) await window.api.bills.print(saved.id);
    onBillSaved?.();
    setPersistentBill(null); // Explicitly clear persistence
    loadInitial();
  }

  function handlePhoneChange(val) {
    const numeric = val.replace(/\D/g, '').slice(0, 10);
    setBill((prev) => ({ ...prev, patient_phone: numeric }));
  }

  function handleNameChange(key, val) {
    const textOnly = val.replace(/[0-9]/g, '');
    setBill((prev) => ({ ...prev, [key]: textOnly }));
  }

  function clearBill() {
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
            <div className="text-xs font-bold uppercase tracking-[0.32em] text-slate-400">Patient Desk</div>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900">Patient & Invoice</h2>
          </div>
          
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 items-end">
            <Input
              label="Patient Phone"
              value={bill.patient_phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
            />
            <Input
              label="Patient Name"
              value={bill.patient_name}
              onChange={(e) => handleNameChange('patient_name', e.target.value)}
            />
            <Input
              label="Doctor Name"
              value={bill.doctor_name}
              onChange={(e) => handleNameChange('doctor_name', e.target.value)}
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
              placeholder="🔍 Search medicine by name, batch, or HSN..."
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
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">Batch: {item.batch}</div>
                    </div>
                    <div className="text-slate-600">Exp: {item.expiry}</div>
                    <div className="text-slate-600">Qty: {item.stock_qty}</div>
                    <div className="font-bold text-blue-600 text-right">{formatCurrency(item.mrp)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="min-h-[260px] flex-1 overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {['#', 'Medicine', 'Pack', 'HSN', 'Batch', 'Exp', 'Qty', 'MRP', 'Rate', 'Amount', ''].map((heading) => (
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
                  <td className="px-4 py-4 font-semibold text-slate-900">{item.product_name}</td>
                  <td className="px-4 py-4">{item.pack}</td>
                  <td className="px-4 py-4">{item.hsn_code}</td>
                  <td className="px-4 py-4">{item.batch}</td>
                  <td className={`px-4 py-4 ${isExpiringWithin(item.expiry, 60) ? 'font-semibold text-warning' : ''}`}>
                    {item.expiry}
                  </td>
                  <td className="px-4 py-4">
                    <input
                      className="w-20 rounded-xl border border-slate-300 px-3 py-2 font-semibold"
                      type="number"
                      min="0"
                      step="1"
                      value={item.qty}
                      onChange={(e) => updateItem(index, 'qty', Number(e.target.value))}
                    />
                  </td>
                  <td className="px-4 py-4">{formatCurrency(item.mrp)}</td>
                  <td className="px-4 py-4">
                    <input
                      className="w-24 rounded-xl border border-slate-300 px-3 py-2 font-semibold"
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) => updateItem(index, 'rate', Number(e.target.value))}
                    />
                  </td>
                  <td className="px-4 py-4 font-semibold">{formatCurrency(item.amount)}</td>
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
                      <div className="text-lg font-bold text-slate-800">No medicines added yet</div>
                      <div className="mt-2 text-sm text-slate-500">
                        Use the medicine search panel above to add items to the bill.
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
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Discount %</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={bill.discount_percent}
                  onChange={(e) => setBill((prev) => ({ ...prev, discount_percent: Number(e.target.value) }))}
                  className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-bold text-slate-700 outline-none focus:border-blue-500 transition"
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500">Discount Amount</span>
                <span className="font-bold text-slate-700">{formatCurrency(totals.discountAmount)}</span>
              </div>
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
                  className="w-full rounded-xl bg-blue-600 px-6 py-4 font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 active:scale-95"
                >
                  Save & Print
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => saveBill('draft', false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95"
                  >
                    Draft
                  </button>
                  <button
                    onClick={clearBill}
                    className="rounded-xl border border-red-100 bg-red-50/50 px-4 py-2.5 text-xs font-bold text-red-500 transition hover:bg-red-50 active:scale-95"
                  >
                    Clear Bill
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
