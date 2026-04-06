import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatCurrency, todayIso } from '@/utils/formatters';

function InfoCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

export default function Reports() {
  const [range, setRange] = useState({
    from: todayIso().slice(0, 8) + '01',
    to: todayIso(),
  });
  const [sales, setSales] = useState({ totals: {}, dayWise: [], topMedicines: [] });

  async function load() {
    const salesData = await window.api.reports.getSalesSummary(range.from, range.to);
    setSales(salesData);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="From" type="date" value={range.from} onChange={(e) => setRange((prev) => ({ ...prev, from: e.target.value }))} />
          <Input label="To" type="date" value={range.to} onChange={(e) => setRange((prev) => ({ ...prev, to: e.target.value }))} />
          <div className="flex items-end">
            <Button className="w-full" onClick={load}>
              Refresh Reports
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <InfoCard label="Total Sales" value={formatCurrency(sales.totals.total_sales)} />
        <InfoCard label="Total Bills" value={sales.totals.total_bills || 0} />
      </div>

      <div className="grid gap-6">
        <section className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Day-wise Sales</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sales.dayWise}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sales" fill="#2563EB" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
