import { useEffect, useMemo, useState } from 'react';
import { Eye, Printer, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import BillTemplate from '@/print/BillTemplate';
import { formatCurrency, formatDate, todayIso } from '@/utils/formatters';

export default function BillHistory({ toast }) {
  const [bills, setBills] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    from: todayIso().slice(0, 8) + '01',
    to: todayIso(),
  });
  const [selectedBill, setSelectedBill] = useState(null);

  async function load() {
    setBills(await window.api.bills.getAll(filters));
  }

  useEffect(() => {
    load();
  }, []);

  async function applyFilters() {
    setBills(await window.api.bills.getAll(filters));
  }

  async function openBill(id) {
    setSelectedBill(await window.api.bills.getById(id));
  }

  async function remove(id) {
    if (!window.confirm('Delete this bill and restore stock?')) return;
    await window.api.bills.delete(id);
    toast('Bill deleted and stock restored');
    load();
  }

  async function handlePrint(id) {
    try {
      const result = await window.api.bills.print(id);
      if (result?.mode === 'saved-only-no-printer') {
        toast('No printer found. Bill saved but not printed.', 'error');
      } else if (result?.mode === 'print-error') {
        toast(`Print failed: ${result.message || 'Unknown error'}`, 'error');
      } else if (result?.mode === 'print') {
        toast('Bill sent to printer successfully');
      } else {
        toast('Print completed');
      }
    } catch (error) {
      toast(error?.message || 'Unable to print bill', 'error');
      console.error('Bill print failed:', error);
    }
  }

  const rows = useMemo(() => bills, [bills]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="grid gap-4 md:grid-cols-4">
          <Input label="Search" value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} placeholder="Patient or invoice no" />
          <Input label="From" type="date" value={filters.from} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} />
          <Input label="To" type="date" value={filters.to} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} />
          <div className="flex items-end">
            <Button className="w-full" onClick={applyFilters}>
              Apply Filters
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {['Invoice No', 'Patient Name', 'Doctor', 'Date', 'Items', 'Grand Total', 'Actions'].map((head) => (
                  <th key={head} className="px-4 py-3">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((bill, index) => (
                <tr
                  key={bill.id}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} cursor-pointer`}
                  onClick={() => openBill(bill.id)}
                >
                  <td className="px-4 py-3 font-semibold text-slate-900">{bill.invoice_no}</td>
                  <td className="px-4 py-3">{bill.patient_name || 'Walk-in'}</td>
                  <td className="px-4 py-3">{bill.doctor_name || '-'}</td>
                  <td className="px-4 py-3">{formatDate(bill.date)}</td>
                  <td className="px-4 py-3">{bill.total_items}</td>
                  <td className="px-4 py-3">{formatCurrency(bill.grand_total)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="secondary" className="px-3 py-2" onClick={(e) => {
                        e.stopPropagation();
                        openBill(bill.id);
                      }}>
                        <Eye size={14} />
                      </Button>
                      <Button variant="secondary" className="px-3 py-2" onClick={(e) => {
                        e.stopPropagation();
                        handlePrint(bill.id);
                      }}>
                        <Printer size={14} />
                      </Button>
                      <Button variant="danger" className="px-3 py-2" onClick={(e) => {
                        e.stopPropagation();
                        remove(bill.id);
                      }}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-slate-500">
                    No bills found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(selectedBill)}
        title={selectedBill ? `Bill Preview - ${selectedBill.invoice_no}` : 'Bill Preview'}
        onClose={() => setSelectedBill(null)}
        size="max-w-5xl"
      >
        {selectedBill && <BillTemplate bill={selectedBill} />}
      </Modal>
    </div>
  );
}
