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

export default function NewBill({ toast, onBillSaved }) {
  const [settings, setSettings] = useState(null);
  const [bill, setBill] = useState(createEmptyBill(null));
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);

  async function loadInitial() {
    const [nextInvoice, loadedSettings] = await Promise.all([
      window.api.bills.getNextInvoiceNo(),
      window.api.settings.get(),
    ]);
    setSettings(loadedSettings);
    setBill({
      ...createEmptyBill(loadedSettings),
      invoice_no: nextInvoice,
    });
  }

  useEffect(() => {
    loadInitial();
  }, []);

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
    loadInitial();
  }

  function clearBill() {
    if (!window.confirm('Clear the current bill?')) return;
    loadInitial();
  }

  return (
    <div className="flex min-h-[calc(100vh-190px)] flex-col gap-5 pb-2">
      <section className="grid gap-5 xl:grid-cols-[1.12fr_1.48fr]">
        <div className="rounded-[28px] bg-white p-6 shadow-card">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.32em] text-slate-400">Patient Desk</div>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Patient & Invoice Details</h2>
            </div>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
              {bill.invoice_no || 'Draft'}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Patient Phone Number"
              value={bill.patient_phone}
              onChange={(e) => setBill((prev) => ({ ...prev, patient_phone: e.target.value }))}
            />
            <Input
              label="Patient Name"
              value={bill.patient_name}
              onChange={(e) => setBill((prev) => ({ ...prev, patient_name: e.target.value }))}
            />
            <Input
              label="Doctor Name"
              value={bill.doctor_name}
              onChange={(e) => setBill((prev) => ({ ...prev, doctor_name: e.target.value }))}
            />
            <Input label="Invoice No" value={bill.invoice_no} readOnly />
            <Input
              label="Date"
              type="date"
              value={bill.date}
              onChange={(e) => setBill((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <MetricTile label="Items Added" value={bill.items.length} accent="slate" />
            <MetricTile label="Bill Date" value={bill.date || todayIso()} accent="blue" />
            <MetricTile label="Doctor" value={bill.doctor_name || settings?.default_doctor || 'Not set'} accent="emerald" />
          </div>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-card">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.32em] text-slate-400">Medicine Desk</div>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Search & Add Medicines</h2>
            </div>
            <div className="hidden rounded-3xl bg-blue-600 px-5 py-4 text-right text-white lg:block">
              <div className="text-xs uppercase tracking-[0.2em] text-blue-100">Running Total</div>
              <div className="mt-2 text-2xl font-extrabold">{formatCurrency(totals.grandTotal)}</div>
            </div>
          </div>

          <div className="relative">
            <Input
              label="Medicine Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type medicine name, batch, or HSN code..."
            />
            {results.length > 0 && (
              <div className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
                {results.map((item) => (
                  <button
                    key={item.id}
                    className="grid w-full grid-cols-[2.1fr_repeat(4,1fr)] gap-3 border-b border-slate-100 px-4 py-4 text-left text-sm transition hover:bg-blue-50"
                    onClick={() => addItem(item)}
                  >
                    <span className="font-semibold text-slate-900">{item.name}</span>
                    <span>{item.batch}</span>
                    <span>{item.expiry}</span>
                    <span>Stock: {item.stock_qty}</span>
                    <span>{formatCurrency(item.mrp)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <MetricTile label="Subtotal" value={formatCurrency(totals.subtotal)} accent="slate" />
            <MetricTile label="Grand Total" value={formatCurrency(totals.grandTotal)} accent="blue" />
          </div>
        </div>
      </section>

      <section className="flex min-h-[320px] flex-1 flex-col rounded-[28px] bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.32em] text-slate-400">Bill Items</div>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Current Bill Line Items</h2>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
            {bill.items.length} medicine{bill.items.length === 1 ? '' : 's'}
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

      <section className="rounded-[28px] bg-slate-900 p-6 text-white shadow-card">
        <div className="grid gap-6 2xl:grid-cols-[1.18fr_1.5fr] 2xl:items-end">
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <span className="text-slate-300">Subtotal</span>
              <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <Input
                label="Discount %"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={bill.discount_percent}
                onChange={(e) => setBill((prev) => ({ ...prev, discount_percent: Number(e.target.value) }))}
                className="border-white/20 bg-slate-950/30 text-white focus:border-blue-400"
              />
              <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/30 px-3 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Discount Amount</div>
                <div className="mt-1 font-semibold text-white">{formatCurrency(totals.discountAmount)}</div>
              </div>
            </div>

          </div>

          <div className="grid gap-4 xl:grid-cols-1 2xl:grid-cols-[1.15fr_auto] 2xl:items-end">
            <div className="space-y-3">
              <div className="rounded-3xl bg-blue-600 px-5 py-5">
                <div className="text-xs uppercase tracking-[0.24em] text-blue-100">Grand Total</div>
                <div className="mt-2 text-4xl font-extrabold">{formatCurrency(totals.grandTotal)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm italic text-slate-200">
                {numberToIndianWords(totals.grandTotal)}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-3 2xl:min-w-[220px] 2xl:grid-cols-1">
              <Button className="py-3 text-base" onClick={() => saveBill('saved', true)}>
                Save & Print
              </Button>
              <Button className="py-3 text-base" variant="secondary" onClick={() => saveBill('draft', false)}>
                Save Draft
              </Button>
              <Button className="py-3 text-base" variant="danger" onClick={clearBill}>
                Clear Bill
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
