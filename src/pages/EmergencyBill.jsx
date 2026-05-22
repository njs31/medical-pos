import { useEffect, useMemo, useState } from 'react';
import { Plus, Printer, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import EmergencyBillTemplate from '@/print/EmergencyBillTemplate';
import { todayIso } from '@/utils/formatters';

function formatRegDateInput(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = String(isoDate).split('-');
  if (!y || !m || !d) return isoDate;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}

function formatRegTimeNow() {
  const now = new Date();
  let h = now.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s} ${ampm}`;
}

function emptyService() {
  return { service_name: '', rate: '', discount: '0', paid_amount: '' };
}

function computeTotals(items) {
  const linePaid = items.reduce((sum, item) => sum + (Number(item.paid_amount) || 0), 0);
  const lineDiscount = items.reduce((sum, item) => sum + (Number(item.discount) || 0), 0);
  const lineRate = items.reduce((sum, item) => sum + (Number(item.rate) || 0), 0);
  return { linePaid, lineDiscount, lineRate };
}

export default function EmergencyBill({ toast, editBillId = null, onNavigate, shopSettings = null }) {
  const isEditing = Boolean(editBillId);
  const [localSettings, setLocalSettings] = useState(shopSettings);
  const [bill, setBill] = useState({
    bill_no: '',
    doctor_name: '',
    patient_name: '',
    father_guardian_name: '',
    reg_no: '',
    reg_date: todayIso(),
    reg_time: formatRegTimeNow(),
    sex: 'Male',
    age_years: '',
    age_months: '',
    age_days: '',
    due_amount: '0',
    items: [emptyService()],
  });

  useEffect(() => {
    if (!shopSettings) {
      window.api.settings.get().then(setLocalSettings);
    } else {
      setLocalSettings(shopSettings);
    }
  }, [shopSettings]);

  useEffect(() => {
    window.api.emergencyBills.previewNextNumbers().then(({ billNo, regNo }) => {
      setBill((prev) => ({
        ...prev,
        bill_no: prev.bill_no || billNo,
        reg_no: prev.reg_no || regNo,
      }));
    });
  }, []);

  useEffect(() => {
    if (!editBillId) return;
    window.api.emergencyBills.getById(editBillId).then((data) => {
      if (!data) return;
      setBill({
        ...data,
        reg_date: data.reg_date?.includes('/') ? data.reg_date : data.reg_date,
        items: data.items?.length ? data.items : [emptyService()],
        due_amount: String(data.due_amount ?? 0),
      });
    });
  }, [editBillId]);

  const totals = useMemo(() => computeTotals(bill.items), [bill.items]);

  const summary = useMemo(() => {
    const paidAmount = totals.linePaid;
    const discountAmount = totals.lineDiscount;
    const dueAmount = Number(bill.due_amount) || 0;
    return { paidAmount, discountAmount, dueAmount };
  }, [bill.due_amount, totals]);

  function updateField(field, value) {
    setBill((prev) => ({ ...prev, [field]: value }));
  }

  function updateItem(index, patch) {
    setBill((prev) => ({
      ...prev,
      items: prev.items.map((item, idx) => {
        if (idx !== index) return item;
        const next = { ...item, ...patch };
        const rate = Number(next.rate) || 0;
        const discount = Number(next.discount) || 0;
        if ('rate' in patch || 'discount' in patch) {
          next.paid_amount = String(Math.max(rate - discount, 0));
        }
        return next;
      }),
    }));
  }

  function addService() {
    setBill((prev) => ({ ...prev, items: [...prev.items, emptyService()] }));
  }

  function removeService(index) {
    setBill((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((_, idx) => idx !== index) : [emptyService()],
    }));
  }

  function buildPayload(regTime) {
    return {
      bill_no: bill.bill_no,
      doctor_name: bill.doctor_name,
      patient_name: bill.patient_name,
      father_guardian_name: bill.father_guardian_name,
      reg_no: bill.reg_no,
      reg_date: bill.reg_date,
      reg_time: regTime,
      sex: bill.sex,
      age_years: Number(bill.age_years) || 0,
      age_months: Number(bill.age_months) || 0,
      age_days: Number(bill.age_days) || 0,
      paid_amount: summary.paidAmount,
      due_amount: summary.dueAmount,
      discount_amount: summary.discountAmount,
      items: bill.items.map((item) => ({
        service_name: item.service_name,
        rate: Number(item.rate) || 0,
        discount: Number(item.discount) || 0,
        paid_amount: Number(item.paid_amount) || 0,
      })),
    };
  }

  function validate() {
    if (!bill.patient_name.trim()) {
      toast('Patient name is required', 'error');
      return false;
    }
    if (!bill.items.some((item) => item.service_name.trim())) {
      toast('Add at least one service', 'error');
      return false;
    }
    return true;
  }

  async function saveBill(shouldPrint = false) {
    if (!validate()) return;
    const regTime = bill.reg_time || formatRegTimeNow();
    const payload = buildPayload(regTime);

    let saved;
    if (isEditing) {
      saved = await window.api.emergencyBills.update(editBillId, payload);
      toast(`Emergency bill ${saved.bill_no} updated`);
    } else {
      saved = await window.api.emergencyBills.create(payload);
      toast('Emergency bill saved');
    }

    if (shouldPrint) {
      await printBill(saved);
    }

    if (isEditing) {
      onNavigate?.('emergency-history');
      return;
    }

    const { billNo, regNo } = await window.api.emergencyBills.previewNextNumbers();
    setBill({
      bill_no: billNo,
      doctor_name: bill.doctor_name,
      patient_name: '',
      father_guardian_name: '',
      reg_no: regNo,
      reg_date: todayIso(),
      reg_time: formatRegTimeNow(),
      sex: 'Male',
      age_years: '',
      age_months: '',
      age_days: '',
      due_amount: '0',
      items: [emptyService()],
    });
  }

  async function printBill(record) {
    const data =
      record?.bill_type === 'emergency' || record?.items
        ? { ...record, bill_type: 'emergency' }
        : await window.api.emergencyBills.getById(record.id);
    if (!data) {
      toast('Bill not found', 'error');
      return;
    }
    try {
      const result = await window.api.emergencyBills.printRaw({ ...data, bill_type: 'emergency' });
      if (result?.mode === 'print-error') {
        toast(`Print failed: ${result.message || 'Unknown error'}`, 'error');
      } else {
        toast('Emergency bill sent to printer');
      }
    } catch (error) {
      toast(error?.message || 'Unable to print', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.32em] text-slate-400">
              {isEditing ? 'Edit Emergency Bill' : 'Procedures Registration'}
            </div>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900">Emergency Bill</h2>
            <p className="mt-1 text-sm text-slate-500">Dharvi Sree Polyclinic procedures registration receipt</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => saveBill(false)}>
              Save
            </Button>
            <Button onClick={() => saveBill(true)}>
              <Printer size={16} />
              Save &amp; Print
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Input label="Bill No." value={bill.bill_no} onChange={(e) => updateField('bill_no', e.target.value)} />
          <Input label="Reg. No." value={bill.reg_no} onChange={(e) => updateField('reg_no', e.target.value)} />
          <Input
            label="Reg. Date"
            type="date"
            value={bill.reg_date?.includes('/') ? '' : bill.reg_date}
            onChange={(e) => updateField('reg_date', e.target.value)}
          />
          <Input label="Doctor Name" value={bill.doctor_name} onChange={(e) => updateField('doctor_name', e.target.value)} />
          <Input
            label="Patient Name"
            value={bill.patient_name}
            onChange={(e) => updateField('patient_name', e.target.value)}
            placeholder="e.g. Mr. N PRATHIK"
          />
          <Input
            label="F/G/H Name"
            value={bill.father_guardian_name}
            onChange={(e) => updateField('father_guardian_name', e.target.value)}
          />
          <Input label="Reg. Time" value={bill.reg_time} onChange={(e) => updateField('reg_time', e.target.value)} />
          <Input label="Sex" value={bill.sex} onChange={(e) => updateField('sex', e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <Input
              label="Age (Years)"
              type="number"
              min="0"
              value={bill.age_years}
              onChange={(e) => updateField('age_years', e.target.value)}
            />
            <Input
              label="Months"
              type="number"
              min="0"
              value={bill.age_months}
              onChange={(e) => updateField('age_months', e.target.value)}
            />
            <Input
              label="Days"
              type="number"
              min="0"
              value={bill.age_days}
              onChange={(e) => updateField('age_days', e.target.value)}
            />
          </div>
          <Input
            label="Due Amount"
            type="number"
            min="0"
            value={bill.due_amount}
            onChange={(e) => updateField('due_amount', e.target.value)}
          />
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Services</h3>
          <Button variant="secondary" onClick={addService}>
            <Plus size={16} />
            Add Service
          </Button>
        </div>

        <div className="space-y-3">
          {bill.items.map((item, index) => (
            <div key={index} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 md:grid-cols-12">
              <div className="md:col-span-5">
                <Input
                  label="Service Name"
                  value={item.service_name}
                  onChange={(e) => updateItem(index, { service_name: e.target.value })}
                  placeholder="PHYSIOTHERAPY CHARGES"
                />
              </div>
              <div className="md:col-span-2">
                <Input
                  label="Rate"
                  type="number"
                  min="0"
                  value={item.rate}
                  onChange={(e) => updateItem(index, { rate: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Input
                  label="Discount"
                  type="number"
                  min="0"
                  value={item.discount}
                  onChange={(e) => updateItem(index, { discount: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Input label="Paid Amount" type="number" min="0" value={item.paid_amount} readOnly />
              </div>
              <div className="flex items-end md:col-span-1">
                <button
                  type="button"
                  onClick={() => removeService(index)}
                  className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-white hover:text-red-600"
                  aria-label="Remove service"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-6 text-sm font-semibold text-slate-700">
          <span>Paid: {summary.paidAmount}</span>
          <span>Due: {summary.dueAmount}</span>
          <span>Discount: {summary.discountAmount}</span>
        </div>
      </section>

      <section className="rounded-[28px] border border-dashed border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">Print Preview</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-100 bg-slate-50 p-4">
          <EmergencyBillTemplate
            bill={{
              ...bill,
              settings: localSettings || undefined,
              reg_date: bill.reg_date?.includes('/') ? bill.reg_date : formatRegDateInput(bill.reg_date),
              paid_amount: summary.paidAmount,
              discount_amount: summary.discountAmount,
              due_amount: summary.dueAmount,
            }}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => printBill(buildPayload(bill.reg_time || formatRegTimeNow()))}>
            <Printer size={16} />
            Print Preview
          </Button>
        </div>
      </section>
    </div>
  );
}
