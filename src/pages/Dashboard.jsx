import { useState } from 'react';
import { Eye } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import BillTemplate from '@/print/BillTemplate';
import { formatCurrency, formatDate } from '@/utils/formatters';

function StatCard({ label, value, subvalue, tone = 'blue', onClick }) {
  const tones = {
    blue: 'from-blue-600 to-blue-500',
    green: 'from-green-600 to-green-500',
    amber: 'from-amber-500 to-orange-500',
    red: 'from-red-600 to-red-500',
  };
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl bg-gradient-to-br ${tones[tone]} p-5 text-left text-white shadow-card`}
    >
      <div className="text-sm opacity-80">{label}</div>
      <div className="mt-3 text-3xl font-extrabold">{value}</div>
      {subvalue && <div className="mt-2 text-sm opacity-90">{subvalue}</div>}
    </button>
  );
}

export default function Dashboard({ summary, onNavigate, onReprint }) {
  const [selectedBill, setSelectedBill] = useState(null);

  async function viewBill(id) {
    const bill = await window.api.bills.getById(id);
    setSelectedBill(bill);
  }

  return (
    <div className="space-y-6">
      {summary.expiredItems > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Expired medicines detected. Review inventory immediately.
        </div>
      )}
      {summary.lowStockItems > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Some medicines are below reorder level. Click the low stock card to inspect them.
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's Sales" value={formatCurrency(summary.todaysSales)} tone="blue" />
        <StatCard label="Bills Generated Today" value={summary.billsGeneratedToday} tone="green" />
        <StatCard
          label="Low Stock Items"
          value={summary.lowStockItems}
          subvalue="Click to filter inventory"
          tone="amber"
          onClick={() => onNavigate('inventory', { filter: 'low-stock' })}
        />
        <StatCard
          label="Expiring Soon Items"
          value={summary.expiringSoonItems}
          subvalue="Click to filter inventory"
          tone="red"
          onClick={() => onNavigate('inventory', { filter: 'expiring-soon' })}
        />
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Recent Bills</h2>
          <Button variant="secondary" onClick={() => onNavigate('bill-history')}>
            View All
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full overflow-hidden rounded-xl">
            <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Invoice No</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {summary.recentBills?.map((bill, index) => (
                <tr key={bill.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{bill.invoice_no}</td>
                  <td className="px-4 py-3 text-slate-700">{bill.patient_name || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{formatCurrency(bill.grand_total)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatDate(bill.date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => viewBill(bill.id)}>
                        <Eye size={14} className="mr-1" /> View
                      </Button>
                      <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => onReprint(bill.id)}>
                        Reprint
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!summary.recentBills?.length && (
                <tr>
                  <td colSpan="5" className="px-4 py-10 text-center text-sm text-slate-500">
                    No bills generated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

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
