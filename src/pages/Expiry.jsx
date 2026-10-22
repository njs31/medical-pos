import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Input from '@/components/ui/Input';
import {
  currentExpiryMonth,
  expiresInMonth,
  formatExpiryMonthLabel,
  shiftExpiryMonth,
} from '@/utils/expiryMonth';
import {
  formatCurrency,
  formatInventoryQty,
  isExpired,
} from '@/utils/formatters';

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function Expiry() {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(() => currentExpiryMonth().year);
  const [month, setMonth] = useState(() => currentExpiryMonth().month);
  const [search, setSearch] = useState('');
  const baseYear = useMemo(() => currentExpiryMonth().year, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    window.api.medicines
      .getAll()
      .then((rows) => {
        if (!cancelled) setCatalog(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const yearOptions = useMemo(() => {
    const years = new Set([year, baseYear]);
    for (let y = baseYear - 2; y <= baseYear + 5; y += 1) years.add(y);
    catalog.forEach((item) => {
      const raw = String(item.expiry || '').trim();
      const parts = raw.split('/');
      if (parts.length !== 2) return;
      let y = Number(parts[1]);
      if (!Number.isFinite(y)) return;
      if (y < 100) y = 2000 + y;
      years.add(y);
    });
    return [...years].sort((a, b) => a - b);
  }, [catalog, year, baseYear]);

  const monthItems = useMemo(() => {
    return catalog.filter((item) => expiresInMonth(item.expiry, year, month));
  }, [catalog, year, month]);

  const filtered = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let rows = monthItems;
    if (tokens.length) {
      rows = rows.filter((item) => {
        const hay = [
          item.name,
          item.batch,
          item.supplier_name,
          item.rack_number,
          item.combination,
        ]
          .map((v) => String(v || '').toLowerCase())
          .join(' ');
        return tokens.every((t) => hay.includes(t));
      });
    }
    return [...rows].sort((a, b) => {
      const nameCmp = String(a.name || '').localeCompare(String(b.name || ''));
      if (nameCmp !== 0) return nameCmp;
      return String(a.batch || '').localeCompare(String(b.batch || ''));
    });
  }, [monthItems, search]);

  const label = formatExpiryMonthLabel(year, month);

  function goPrev() {
    const next = shiftExpiryMonth({ year, month }, -1);
    setYear(next.year);
    setMonth(next.month);
  }

  function goNext() {
    const next = shiftExpiryMonth({ year, month }, 1);
    setYear(next.year);
    setMonth(next.month);
  }

  function goThisMonth() {
    const cur = currentExpiryMonth();
    setYear(cur.year);
    setMonth(cur.month);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] flex-1">
            <Input
              label="Search in this month"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, batch, rack, supplier…"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Month</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                title="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={goNext}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                title="Next month"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={goThisMonth}
            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
          >
            This month
          </button>
        </div>

        <div className="mt-4 inline-flex rounded-full bg-slate-100 px-4 py-1.5 text-sm font-semibold text-slate-700">
          {loading
            ? 'Loading…'
            : `${filtered.length} product${filtered.length === 1 ? '' : 's'} expire in ${label}`}
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Rack</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3 text-right">MRP</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No products expire in {label}.
                  </td>
                </tr>
              )}
              {filtered.map((item, index) => {
                const expired = isExpired(item.expiry);
                return (
                  <tr
                    key={item.id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} ${
                      expired ? 'text-red-700' : 'text-slate-800'
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold">{item.name}</td>
                    <td className="px-4 py-3">{item.batch || '—'}</td>
                    <td className={`px-4 py-3 font-semibold ${expired ? 'text-red-600' : ''}`}>
                      {item.expiry || '—'}
                      {expired ? (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide">Expired</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {formatInventoryQty(item.stock_qty, item.tablets_per_sheet, item.item_category)}
                    </td>
                    <td className="px-4 py-3">{item.rack_number || '—'}</td>
                    <td className="px-4 py-3">{item.supplier_name || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.mrp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
