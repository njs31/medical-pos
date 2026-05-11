import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatBillQty, formatCurrency, formatDate, todayIso } from '@/utils/formatters';

function InfoCard({ label, value, tone }) {
  const toneClass =
    tone === 'profit-negative'
      ? 'text-red-600'
      : tone === 'profit-positive'
      ? 'text-emerald-600'
      : 'text-slate-900';
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-extrabold ${toneClass}`}>{value}</div>
    </div>
  );
}

function profitTone(profit) {
  if (profit < 0) return 'text-red-600';
  if (profit === 0) return 'text-slate-500';
  return 'text-emerald-600';
}

function isoFromDate(date) {
  const tz = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tz).toISOString().slice(0, 10);
}

function SalesCalendar({ monthDate, onChangeMonth, salesByDate, onPickDay }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = lastOfMonth.getDate();
  const todayKey = todayIso();

  const monthLabel = firstOfMonth.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChangeMonth(-1)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-base font-semibold text-slate-900">{monthLabel}</div>
        <button
          type="button"
          onClick={() => onChangeMonth(1)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} className="h-20" />;
          const key = isoFromDate(cell);
          const entry = salesByDate.get(key);
          const sales = Number(entry?.sales) || 0;
          const bills = Number(entry?.bills) || 0;
          const hasSales = sales > 0 || bills > 0;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPickDay(key)}
              className={`flex h-20 flex-col items-start justify-between rounded-lg border p-2 text-left transition ${
                hasSales
                  ? 'border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className="flex w-full items-center justify-between">
                <span className={`text-sm font-semibold ${hasSales ? 'text-blue-700' : 'text-slate-700'}`}>
                  {cell.getDate()}
                </span>
                {bills > 0 && (
                  <span className="rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
                    {bills}
                  </span>
                )}
              </div>
              {hasSales && (
                <div className="text-[11px] font-semibold leading-tight text-slate-700">
                  {formatCurrency(sales)}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MedicineProfitList({ items, emptyText }) {
  if (!items || items.length === 0) {
    return <div className="py-8 text-center text-sm text-slate-500">{emptyText}</div>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, idx) => {
        const profit = Number(item.profit) || 0;
        const qtyLabel = formatBillQty(
          item.qty,
          item.tablets_per_sheet,
          item.item_category || 'Medicine',
        );
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
                  Qty: {qtyLabel}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-900">
                  {formatCurrency(item.total_amount)}
                </div>
                <div className={`text-xs font-medium ${profitTone(profit)}`}>
                  {formatCurrency(profit)} profit
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
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
            <div className={`mt-1 text-base font-bold ${profitTone(totalProfit)}`}>
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
          ) : (
            <MedicineProfitList items={items} emptyText="No sales on this day." />
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
  const [sales, setSales] = useState({ totals: {}, dayWise: [], items: [], topMedicines: [] });
  const [dayPanel, setDayPanel] = useState({ open: false, loading: false, data: null });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarSales, setCalendarSales] = useState([]);

  async function load(overrideRange) {
    const r = overrideRange || range;
    const salesData = await window.api.reports.getSalesSummary(r.from, r.to);
    setSales(salesData);
  }

  async function loadCalendar(monthStart) {
    const from = isoFromDate(monthStart);
    const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const to = isoFromDate(end);
    const data = await window.api.reports.getSalesSummary(from, to);
    setCalendarSales(data?.dayWise || []);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    loadCalendar(calendarMonth);
  }, [calendarMonth]);

  function applyPresetDays(days) {
    const to = todayIso();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    const from = isoFromDate(start);
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
    const from = isoFromDate(start);
    return range.from === from && range.to === to;
  }

  async function openDayDetails(rawDate) {
    const date = String(rawDate || '').slice(0, 10);
    if (!date) return;
    setDayPanel({ open: true, loading: true, data: { date } });
    try {
      const details = await window.api.reports.getDayDetails(date);
      setDayPanel({ open: true, loading: false, data: details });
    } catch (err) {
      console.error('Failed to load day details', err);
      setDayPanel({
        open: true,
        loading: false,
        data: { date, items: [], totalSales: 0, totalProfit: 0, totalBills: 0 },
      });
    }
  }

  function closeDayPanel() {
    setDayPanel({ open: false, loading: false, data: null });
  }

  function changeMonth(delta) {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  const salesByDate = useMemo(() => {
    const map = new Map();
    for (const row of calendarSales) {
      if (row?.date) map.set(String(row.date).slice(0, 10), row);
    }
    return map;
  }, [calendarSales]);

  const totalSales = Number(sales.totals.total_sales) || 0;
  const totalProfit = Number(sales.totals.total_profit) || 0;
  const totalBills = Number(sales.totals.total_bills) || 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="grid gap-4 md:grid-cols-3">
          <Input
            label="From"
            type="date"
            value={range.from}
            onChange={(e) => setRange((prev) => ({ ...prev, from: e.target.value }))}
          />
          <Input
            label="To"
            type="date"
            value={range.to}
            onChange={(e) => setRange((prev) => ({ ...prev, to: e.target.value }))}
          />
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

      <div className="grid gap-5 md:grid-cols-3">
        <InfoCard label="Total Revenue" value={formatCurrency(totalSales)} />
        <InfoCard
          label="Total Profit"
          value={formatCurrency(totalProfit)}
          tone={totalProfit < 0 ? 'profit-negative' : 'profit-positive'}
        />
        <InfoCard label="Total Bills" value={totalBills} />
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Sales Calendar</h2>
          <span className="text-xs text-slate-500">Click any day to see what was sold</span>
        </div>
        <SalesCalendar
          monthDate={calendarMonth}
          onChangeMonth={changeMonth}
          salesByDate={salesByDate}
          onPickDay={openDayDetails}
        />
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Medicines Sold in Range</h2>
          <span className="text-xs text-slate-500">
            {formatDate(range.from)} – {formatDate(range.to)}
          </span>
        </div>
        <MedicineProfitList
          items={sales.items || []}
          emptyText="No sales in this range."
        />
      </section>

      <DayDetailsPanel
        open={dayPanel.open}
        loading={dayPanel.loading}
        data={dayPanel.data}
        onClose={closeDayPanel}
      />
    </div>
  );
}
