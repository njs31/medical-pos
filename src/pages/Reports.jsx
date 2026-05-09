import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatCurrency, formatDate, todayIso } from '@/utils/formatters';

function InfoCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

function DayDetailsPanel({ open, loading, data, onClose }) {
  if (!open) return null;

  const items = data?.items || [];
  const totalSales = Number(data?.totalSales) || 0;
  const totalProfit = Number(data?.totalProfit) || 0;
  const totalBills = Number(data?.totalBills) || 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Day Report</div>
            <div className="mt-1 text-lg font-bold text-slate-900">
              {data?.date ? formatDate(data.date) : ''}
            </div>
          </div>
          <button
            className="text-2xl leading-none text-slate-400 hover:text-slate-700"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-[11px] uppercase text-slate-500">Sales</div>
            <div className="mt-1 text-base font-bold text-slate-900">{formatCurrency(totalSales)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase text-slate-500">Profit</div>
            <div
              className={`mt-1 text-base font-bold ${
                totalProfit < 0 ? 'text-red-600' : totalProfit === 0 ? 'text-slate-700' : 'text-emerald-600'
              }`}
            >
              {formatCurrency(totalProfit)}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase text-slate-500">Bills</div>
            <div className="mt-1 text-base font-bold text-slate-900">{totalBills}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-700">Products Sold</h4>

          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No sales on this day.</div>
          ) : (
            <ul className="space-y-2">
              {items.map((item, idx) => {
                const profit = Number(item.profit) || 0;
                return (
                  <li
                    key={`${item.product_name}-${idx}`}
                    className="rounded-xl border border-slate-200 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {item.product_name}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          Qty: {Number(item.qty) || 0}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-900">
                          {formatCurrency(item.total_amount)}
                        </div>
                        <div
                          className={`text-xs font-medium ${
                            profit < 0 ? 'text-red-600' : profit === 0 ? 'text-slate-500' : 'text-emerald-600'
                          }`}
                        >
                          {formatCurrency(profit)} profit
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const [range, setRange] = useState({
    from: todayIso().slice(0, 8) + '01',
    to: todayIso(),
  });
  const [sales, setSales] = useState({ totals: {}, dayWise: [], topMedicines: [] });
  const [dayPanel, setDayPanel] = useState({ open: false, loading: false, data: null });

  async function load(overrideRange) {
    const r = overrideRange || range;
    const salesData = await window.api.reports.getSalesSummary(r.from, r.to);
    setSales(salesData);
  }

  useEffect(() => {
    load();
  }, []);

  function applyPresetDays(days) {
    const to = todayIso();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    const tz = start.getTimezoneOffset() * 60000;
    const from = new Date(start.getTime() - tz).toISOString().slice(0, 10);
    const next = { from, to };
    setRange(next);
    load(next);
  }

  const presets = [
    { label: 'Past 1 week', days: 7 },
    { label: 'Past 10 days', days: 10 },
    { label: 'Past 15 days', days: 15 },
    { label: 'Past 30 days', days: 30 },
  ];

  function isPresetActive(days) {
    const to = todayIso();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    const tz = start.getTimezoneOffset() * 60000;
    const from = new Date(start.getTime() - tz).toISOString().slice(0, 10);
    return range.from === from && range.to === to;
  }

  function normalizeDate(value) {
    if (!value) return '';
    if (value instanceof Date) {
      const tz = value.getTimezoneOffset() * 60000;
      return new Date(value.getTime() - tz).toISOString().slice(0, 10);
    }
    return String(value).slice(0, 10);
  }

  async function openDayDetails(rawDate) {
    const date = normalizeDate(rawDate);
    if (!date) return;
    setDayPanel({ open: true, loading: true, data: { date } });
    try {
      const details = await window.api.reports.getDayDetails(date);
      setDayPanel({ open: true, loading: false, data: details });
    } catch (err) {
      console.error('Failed to load day details', err);
      setDayPanel({ open: true, loading: false, data: { date, items: [], totalSales: 0, totalProfit: 0, totalBills: 0 } });
    }
  }

  function closeDayPanel() {
    setDayPanel({ open: false, loading: false, data: null });
  }

  function handleChartClick(payload) {
    const date =
      payload?.activeLabel ||
      payload?.activePayload?.[0]?.payload?.date ||
      payload?.payload?.date;
    if (date) openDayDetails(date);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="From" type="date" value={range.from} onChange={(e) => setRange((prev) => ({ ...prev, from: e.target.value }))} />
          <Input label="To" type="date" value={range.to} onChange={(e) => setRange((prev) => ({ ...prev, to: e.target.value }))} />
          <div className="flex items-end">
            <Button className="w-full" onClick={() => load()}>
              Refresh Reports
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {presets.map((preset) => {
            const active = isPresetActive(preset.days);
            return (
              <button
                key={preset.days}
                type="button"
                onClick={() => applyPresetDays(preset.days)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <InfoCard label="Total Sales" value={formatCurrency(sales.totals.total_sales)} />
        <InfoCard label="Total Bills" value={sales.totals.total_bills || 0} />
      </div>

      <div className="grid gap-6">
        <section className="rounded-2xl bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Day-wise Sales</h2>
            <span className="text-xs text-slate-500">Click a bar to see that day's products & profit</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sales.dayWise} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="sales"
                  fill="#2563EB"
                  radius={[8, 8, 0, 0]}
                  cursor="pointer"
                  onClick={(entry) => openDayDetails(entry?.date || entry?.payload?.date)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <DayDetailsPanel
        open={dayPanel.open}
        loading={dayPanel.loading}
        data={dayPanel.data}
        onClose={closeDayPanel}
      />
    </div>
  );
}
