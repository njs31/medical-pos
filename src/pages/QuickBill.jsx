import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { calculateBillTotals } from '@/utils/calculations';
import { formatCurrency, todayIso } from '@/utils/formatters';
import { numberToIndianWords } from '@/utils/numberToWords';

export default function QuickBill({ toast, shopSettings }) {
  const [bill, setBill] = useState({
    patient_name: '',
    patient_phone: '',
    doctor_name: shopSettings?.default_doctor || '',
    date: todayIso(),
    discount_percent: shopSettings?.default_discount || 0,
    items: [],
  });

  const totals = useMemo(
    () => calculateBillTotals(bill.items, bill.discount_percent),
    [bill.discount_percent, bill.items],
  );

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
        },
      ],
    }));
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

  async function saveQuickBill(status, shouldPrint = false) {
    if (!bill.items.length) {
      toast('Add at least one item', 'error');
      return;
    }
    const payload = {
      ...bill,
      invoice_no: 'QK-' + Date.now().toString().slice(-6),
      status: `quick-${status}`,
      items: totals.items,
      subtotal: totals.subtotal,
      discount_percent: Number(bill.discount_percent || 0),
      discount_amount: totals.discountAmount,
      grand_total: totals.grandTotal,
    };

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
    if (!window.confirm('Clear the current quick bill?')) return;
    setBill({
      patient_name: '',
      patient_phone: '',
      doctor_name: shopSettings?.default_doctor || '',
      date: todayIso(),
      discount_percent: shopSettings?.default_discount || 0,
      items: [],
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-190px)] flex-col gap-5 pb-2">
      <section className="rounded-[28px] bg-white p-6 shadow-card">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.32em] text-slate-400">Direct Billing</div>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900 text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500">Quick Invoice</h2>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4 items-end">
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
              + Add Item
            </Button>
          </div>
        </div>
      </section>

      <section className="flex min-h-[320px] flex-1 flex-col rounded-[28px] bg-white p-6 shadow-card">
        <div className="mb-4">
          <div className="text-xs font-bold uppercase tracking-[0.32em] text-slate-400">Bill Items</div>
          <h2 className="mt-1 text-xl font-extrabold text-slate-900">Manual Entry Table</h2>
        </div>

        <div className="min-h-[260px] flex-1 overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-100/80 backdrop-blur-md text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {['#', 'Product Name', 'Batch', 'Exp', 'Qty', 'Amount', 'Disc%', ''].map((heading) => (
                  <th key={heading} className="px-4 py-4">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bill.items.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="px-4 py-4">{index + 1}</td>
                  <td className="px-4 py-4">
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-blue-500 outline-none transition"
                      value={item.product_name}
                      onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                      placeholder="Item Name"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500 transition"
                      value={item.batch}
                      onChange={(e) => updateItem(index, 'batch', e.target.value)}
                      placeholder="Batch"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500 transition"
                      value={item.expiry}
                      onChange={(e) => updateItem(index, 'expiry', e.target.value)}
                      placeholder="Exp"
                    />
                  </td>
                  <td className="px-4 py-4">
                      <input
                        className="w-20 rounded-xl border border-slate-200 px-3 py-2 font-bold outline-none focus:border-blue-500 transition"
                        type="number"
                        min="1"
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
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-bold">₹</span>
                      <input
                        className="w-24 rounded-xl border border-slate-200 px-3 py-2 font-bold text-blue-600 outline-none focus:border-blue-500 transition"
                        type="number"
                        value={item.mrp}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          let v = e.target.value;
                          if (/^0\d/.test(v)) {
                            v = v.replace(/^0+(?=\d)/, '');
                            e.target.value = v;
                          }
                          const val = Number(v);
                          updateItem(index, 'mrp', val);
                          updateItem(index, 'rate', val);
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <input
                        className="w-16 rounded-xl border border-slate-200 px-2 py-2 font-bold text-slate-700 transition focus:border-blue-500 outline-none"
                        type="number"
                        min="0"
                        max="100"
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
                      <span className="text-[10px] font-bold text-slate-400">%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      className="rounded-full bg-red-50 p-2 text-red-500 hover:bg-red-100 transition"
                      onClick={() => removeItem(index)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
              {!bill.items.length && (
                <tr>
                  <td colSpan="7" className="px-4 py-20 text-center">
                    <div className="mx-auto max-w-xs rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8">
                       <div className="text-slate-400 mb-2 font-medium">No items added</div>
                       <Button onClick={addQuickItem} className="w-full bg-slate-200 text-slate-800 font-bold py-2 rounded-xl border border-slate-300">
                         Start Adding Items
                       </Button>
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
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Summary</div>
                <div className="mt-4 flex flex-col gap-2">
                   <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 font-medium">Subtotal</span>
                      <span className="text-slate-900 font-bold">{formatCurrency(totals.subtotal)}</span>
                   </div>
                   <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 font-medium">Discount (%)</span>
                      <input 
                        type="number"
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right font-bold"
                        value={bill.discount_percent}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          let v = e.target.value;
                          if (/^0\d/.test(v)) {
                            v = v.replace(/^0+(?=\d)/, '');
                            e.target.value = v;
                          }
                          setBill(p => ({ ...p, discount_percent: v === '' ? 0 : Number(v) }));
                        }}
                      />
                   </div>
                   <div className="mt-2 border-t border-slate-200 pt-2 flex items-center justify-between">
                      <span className="text-slate-900 font-black">Grand Total</span>
                      <span className="text-xl text-blue-600 font-black">{formatCurrency(totals.grandTotal)}</span>
                   </div>
                   <div className="mt-1 text-[10px] text-slate-400 italic text-right">
                      {numberToIndianWords(totals.grandTotal)}
                   </div>
                </div>
              </div>
           </div>

           <div className="flex flex-col justify-end gap-3">
              <button
                onClick={() => saveQuickBill('saved', true)}
                className="w-full rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-xl font-black text-white shadow-xl shadow-blue-200 transition active:scale-95 hover:shadow-2xl hover:-translate-y-0.5"
              >
                ⚡ SAVE & PRINT
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => saveQuickBill('saved', false)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95"
                >
                  Save
                </button>
                <button
                  onClick={clearBill}
                  className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600 transition hover:bg-red-100 active:scale-95"
                >
                  Clear All
                </button>
              </div>
           </div>
        </div>
      </section>
    </div>
  );
}
