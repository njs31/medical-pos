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
  const [stock, setStock] = useState({ inventoryValuation: 0, lowStockList: [], expiryBuckets: {} });
  const [gst, setGst] = useState({ monthlySummary: [] });

  async function load() {
    const now = new Date();
    const [salesData, stockData, gstData] = await Promise.all([
      window.api.reports.getSalesSummary(range.from, range.to),
      window.api.reports.getStockReport(),
      window.api.reports.getGSTReport(now.getMonth() + 1, now.getFullYear()),
    ]);
    setSales(salesData);
    setStock(stockData);
    setGst(gstData);
  }

  useEffect(() => {
    load();
  }, []);

  const expirySummary = useMemo(
    () => ({
      expired: stock.expiryBuckets?.expired?.length || 0,
      within30: stock.expiryBuckets?.within30?.length || 0,
      within60: stock.expiryBuckets?.within60?.length || 0,
      within90: stock.expiryBuckets?.within90?.length || 0,
    }),
    [stock],
  );

  function exportGstCsv() {
    const rows = [
      ['month', 'sgst_collected', 'cgst_collected', 'total_gst'],
      ...(gst.monthlySummary || []).map((row) => [row.month, row.sgst_collected, row.cgst_collected, row.total_gst]),
    ];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gst-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

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

      <div className="grid gap-5 md:grid-cols-3">
        <InfoCard label="Total Sales" value={formatCurrency(sales.totals.total_sales)} />
        <InfoCard label="Total Bills" value={sales.totals.total_bills || 0} />
        <InfoCard label="Total GST Collected" value={formatCurrency(sales.totals.total_gst)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
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

        <section className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Top 10 Medicines Sold</h2>
          <div className="space-y-3">
            {sales.topMedicines.map((item) => (
              <div key={item.product_name} className="rounded-xl bg-slate-50 px-4 py-3">
                <div className="font-semibold text-slate-900">{item.product_name}</div>
                <div className="mt-1 text-sm text-slate-600">
                  Qty: {item.qty} | Revenue: {formatCurrency(item.revenue)}
                </div>
              </div>
            ))}
            {!sales.topMedicines.length && <div className="text-sm text-slate-500">No sales data in the selected range.</div>}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Stock Report</h2>
          <div className="mb-4 rounded-xl bg-slate-50 px-4 py-4">
            <div className="text-sm text-slate-500">Current Inventory Valuation</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{formatCurrency(stock.inventoryValuation)}</div>
          </div>
          <div className="space-y-2">
            {stock.lowStockList?.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <div className="font-semibold text-slate-900">{item.name}</div>
                  <div className="text-sm text-slate-500">Stock: {item.stock_qty} | Suggested reorder: {item.suggested_order}</div>
                </div>
                <div className="text-sm font-semibold text-amber-700">Low Stock</div>
              </div>
            ))}
            {!stock.lowStockList?.length && <div className="text-sm text-slate-500">No low stock items right now.</div>}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Expiry Report</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoCard label="Expired" value={expirySummary.expired} />
            <InfoCard label="Expiring in 30 Days" value={expirySummary.within30} />
            <InfoCard label="Expiring in 60 Days" value={expirySummary.within60} />
            <InfoCard label="Expiring in 90 Days" value={expirySummary.within90} />
          </div>
        </section>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">GST Report</h2>
          <Button variant="secondary" onClick={exportGstCsv}>
            Export CSV
          </Button>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">SGST Collected</th>
                <th className="px-4 py-3">CGST Collected</th>
                <th className="px-4 py-3">Total GST</th>
              </tr>
            </thead>
            <tbody>
              {gst.monthlySummary?.map((row) => (
                <tr key={row.month} className="border-t border-slate-100">
                  <td className="px-4 py-3">{row.month}</td>
                  <td className="px-4 py-3">{formatCurrency(row.sgst_collected)}</td>
                  <td className="px-4 py-3">{formatCurrency(row.cgst_collected)}</td>
                  <td className="px-4 py-3">{formatCurrency(row.total_gst)}</td>
                </tr>
              ))}
              {!gst.monthlySummary?.length && (
                <tr>
                  <td colSpan="4" className="px-4 py-10 text-center text-slate-500">
                    No GST entries available for the current month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
