import { useEffect, useState } from 'react';
import { Eye, Pencil, Printer, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import EmergencyBillTemplate from '@/print/EmergencyBillTemplate';
import { todayIso } from '@/utils/formatters';

export default function EmergencyBillHistory({ toast, onNavigate }) {
  const [bills, setBills] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    from: todayIso().slice(0, 8) + '01',
    to: todayIso(),
  });
  const [selectedBill, setSelectedBill] = useState(null);

  async function load() {
    setBills(await window.api.emergencyBills.getAll(filters));
  }

  useEffect(() => {
    load();
  }, []);

  async function applyFilters() {
    setBills(await window.api.emergencyBills.getAll(filters));
  }

  async function openBill(id) {
    setSelectedBill(await window.api.emergencyBills.getById(id));
  }

  async function remove(id) {
    if (!window.confirm('Delete this emergency bill?')) return;
    await window.api.emergencyBills.delete(id);
    toast('Emergency bill deleted');
    load();
  }

  async function handlePrint(id) {
    try {
      const bill = await window.api.emergencyBills.getById(id);
      const result = await window.api.emergencyBills.printRaw({ ...bill, bill_type: 'emergency' });
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
        <div className="flex flex-wrap items-end gap-4">
          <Input
            label="Search"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="Patient, bill no, reg no..."
          />
          <Input
            label="From"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
          />
          <Input
            label="To"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
          />
          <Button onClick={applyFilters}>Apply</Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Bill No.</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Reg. No.</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold">{bill.bill_no}</td>
                <td className="px-4 py-3">{bill.patient_name}</td>
                <td className="px-4 py-3">{bill.reg_no}</td>
                <td className="px-4 py-3">{bill.reg_date}</td>
                <td className="px-4 py-3">{bill.paid_amount}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openBill(bill.id)}
                      className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate?.('emergency-bill', { editBillId: bill.id })}
                      className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrint(bill.id)}
                      className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                    >
                      <Printer size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(bill.id)}
                      className="rounded-lg border border-slate-200 p-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!bills.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No emergency bills found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <Modal open={Boolean(selectedBill)} onClose={() => setSelectedBill(null)} title="Emergency Bill Preview">
        {selectedBill ? <EmergencyBillTemplate bill={selectedBill} /> : null}
      </Modal>
    </div>
  );
}
