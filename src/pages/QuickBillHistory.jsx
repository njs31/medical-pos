import { useEffect, useMemo, useState } from 'react';
import { Eye, Printer, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import BillTemplate from '@/print/BillTemplate';
import { formatCurrency, formatDate, todayIso } from '@/utils/formatters';

export default function QuickBillHistory({ toast }) {
  const [bills, setBills] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    from: todayIso().slice(0, 8) + '01',
    to: todayIso(),
  });
  const [selectedBill, setSelectedBill] = useState(null);

  async function load() {
    const all = await window.api.bills.getAll(filters);
    setBills(all.filter(b => b.status && b.status.startsWith('quick-')));
  }

  useEffect(() => {
    load();
  }, []);

  async function applyFilters() {
    load();
  }

  async function openBill(id) {
    setSelectedBill(await window.api.bills.getById(id));
  }

  async function remove(id) {
    if (!window.confirm('Delete this quick bill?')) return;
    await window.api.bills.delete(id);
    toast('Quick Bill deleted');
    load();
  }

  async function handlePrint(id) {
    try {
      await window.api.bills.print(id);
      toast(`Print dialog opened for Quick Bill #${id}`);
    } catch (error) {
      toast(error?.message || 'Unable to print', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] bg-white p-6 shadow-card border border-slate-100">
        <div className="grid gap-4 md:grid-cols-4">
          <Input label="Search" value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} placeholder="Patient or QK-no" />
          <Input label="From" type="date" value={filters.from} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} />
          <Input label="To" type="date" value={filters.to} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} />
          <div className="flex items-end">
            <Button className="w-full bg-slate-900 text-white rounded-xl h-[48px] font-bold" onClick={applyFilters}>
              Search History
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] bg-white shadow-card border border-slate-100">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-100/80 backdrop-blur-md text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {['Invoice No', 'Patient Name', 'Date', 'Amount', 'Status', 'Actions'].map((head) => (
                  <th key={head} className="px-6 py-4">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bills.map((bill, index) => (
                <tr
                  key={bill.id}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-blue-50/50 cursor-pointer transition`}
                  onClick={() => openBill(bill.id)}
                >
                  <td className="px-6 py-4 font-bold text-slate-900">{bill.invoice_no}</td>
                  <td className="px-6 py-4 font-medium">{bill.patient_name || 'Generic'}</td>
                  <td className="px-6 py-4 text-slate-500">{formatDate(bill.date)}</td>
                  <td className="px-6 py-4 font-black text-slate-900">{formatCurrency(bill.grand_total)}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                      bill.status === 'quick-draft' 
                        ? 'bg-amber-100 text-amber-700' 
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {bill.status.split('-')[1]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                       <button className="p-2 text-slate-400 hover:text-blue-600 transition" onClick={(e) => { e.stopPropagation(); openBill(bill.id); }}>
                        <Eye size={18} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-indigo-600 transition" onClick={(e) => { e.stopPropagation(); handlePrint(bill.id); }}>
                        <Printer size={18} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-red-500 transition" onClick={(e) => { e.stopPropagation(); remove(bill.id); }}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!bills.length && (
                <tr>
                  <td colSpan="6" className="px-4 py-24 text-center">
                    <div className="text-slate-400 font-medium italic">No quick bill history found.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(selectedBill)}
        title={selectedBill ? `Quick Bill Preview - ${selectedBill.invoice_no}` : 'Quick Bill Preview'}
        onClose={() => setSelectedBill(null)}
        size="max-w-5xl"
      >
        {selectedBill && <BillTemplate bill={selectedBill} />}
      </Modal>
    </div>
  );
}
