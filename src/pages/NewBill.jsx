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
    <div className="flex h-[calc(100vh-170px)] min-h-[640px] flex-col gap-5">
      <section className="grid gap-5 xl:grid-cols-[1.1fr_1.4fr]">
        <div className="rounded-2xl bg-white p-5 shadow-card">
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
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="relative">
            <Input
              label="Medicine Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Start typing medicine name..."
            />
            {results.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                {results.map((item) => (
                  <button
                    key={item.id}
                    className="grid w-full grid-cols-[2fr_repeat(4,1fr)] gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-slate-50"
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
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white p-5 shadow-card">
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {['#', 'Medicine', 'Pack', 'HSN', 'Batch', 'Exp', 'Qty', 'MRP', 'Rate', 'SGST%', 'CGST%', 'Amount', ''].map((heading) => (
                  <th key={heading} className="px-3 py-3">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {totals.items.map((item, index) => (
                <tr key={`${item.medicine_id}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-3 py-3">{index + 1}</td>
                  <td className="px-3 py-3 font-semibold text-slate-900">{item.product_name}</td>
                  <td className="px-3 py-3">{item.pack}</td>
                  <td className="px-3 py-3">{item.hsn_code}</td>
                  <td className="px-3 py-3">{item.batch}</td>
                  <td className={`px-3 py-3 ${isExpiringWithin(item.expiry, 60) ? 'font-semibold text-warning' : ''}`}>{item.expiry}</td>
                  <td className="px-3 py-3">
                    <input
                      className="w-20 rounded border border-slate-300 px-2 py-1"
                      type="number"
                      min="0"
                      step="1"
                      value={item.qty}
                      onChange={(e) => updateItem(index, 'qty', Number(e.target.value))}
                    />
                  </td>
                  <td className="px-3 py-3">{formatCurrency(item.mrp)}</td>
                  <td className="px-3 py-3">
                    <input
                      className="w-24 rounded border border-slate-300 px-2 py-1"
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) => updateItem(index, 'rate', Number(e.target.value))}
                    />
                  </td>
                  <td className="px-3 py-3">{item.sgst_percent}</td>
                  <td className="px-3 py-3">{item.cgst_percent}</td>
                  <td className="px-3 py-3 font-semibold">{formatCurrency(item.amount)}</td>
                  <td className="px-3 py-3">
                    <button className="text-lg text-danger" onClick={() => removeItem(index)}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              {!bill.items.length && (
                <tr>
                  <td colSpan="13" className="px-3 py-12 text-center text-slate-500">
                    Search and add medicines to begin billing.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-card">
        <div className="grid gap-5 xl:grid-cols-[1.1fr_1.4fr] xl:items-end">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Input
                label="Discount %"
                type="number"
                min="0"
                step="0.01"
                value={bill.discount_percent}
                onChange={(e) => setBill((prev) => ({ ...prev, discount_percent: Number(e.target.value) }))}
              />
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-xs text-slate-500">Discount Amount</div>
                  <div className="font-semibold">{formatCurrency(totals.discountAmount)}</div>
                </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-slate-500">SGST Total</span>
              <span className="font-semibold">{formatCurrency(totals.sgstTotal)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-slate-500">CGST Total</span>
              <span className="font-semibold">{formatCurrency(totals.cgstTotal)}</span>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_auto] xl:items-end">
            <div className="space-y-3">
              <div className="rounded-xl bg-blue-50 px-4 py-4">
              <div className="text-xs uppercase tracking-wide text-blue-700">Grand Total</div>
              <div className="mt-1 text-3xl font-extrabold text-blue-700">{formatCurrency(totals.grandTotal)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs italic text-slate-600">
                {numberToIndianWords(totals.grandTotal)}
              </div>
            </div>
            <div className="grid gap-3 xl:min-w-[200px]">
              <Button onClick={() => saveBill('saved', true)}>Save & Print</Button>
              <Button variant="secondary" onClick={() => saveBill('draft', false)}>
                Save Draft
              </Button>
              <Button variant="danger" onClick={clearBill}>
                Clear Bill
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
