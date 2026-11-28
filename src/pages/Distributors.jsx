import { useEffect, useMemo, useState } from 'react';
import { Search, Truck } from 'lucide-react';
import Button from '@/components/ui/Button';
import { formatCurrency, formatDate, formatInventoryQty } from '@/utils/formatters';

const ROWS_PER_PAGE = 100;
const EARLIER_STOCK = 'existing';

const SOURCE_LABELS = {
  add: 'Add Stock',
  bulk_add: 'Bulk Add',
  supplier_import: 'Supplier file',
  stock_patch: 'Inward entry',
  [EARLIER_STOCK]: 'Earlier stock*',
};

function displayName(name) {
  return name || 'Unknown distributor';
}

function matches(text, query) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const haystack = text.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

/** Groups purchase entries into one row per medicine name. */
function groupByMedicine(purchases) {
  const groups = new Map();
  for (const entry of purchases) {
    const key = entry.name.trim().toUpperCase();
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        name: entry.name,
        times: 0,
        qty: 0,
        value: 0,
        batches: new Set(),
        last: entry, // purchases arrive newest first
        stockByBatch: new Map(),
        hasEarlier: false,
      };
      groups.set(key, group);
    }
    group.times += 1;
    group.qty += Number(entry.qty) || 0;
    group.value += (Number(entry.qty) || 0) * (Number(entry.purchase_rate) || 0);
    if (entry.batch) group.batches.add(entry.batch);
    if (entry.medicine_id != null && entry.current_stock != null) {
      group.stockByBatch.set(entry.medicine_id, Number(entry.current_stock) || 0);
    }
    if (entry.source === EARLIER_STOCK) group.hasEarlier = true;
  }
  return [...groups.values()].map((group) => ({
    ...group,
    batchCount: group.batches.size,
    inStock: [...group.stockByBatch.values()].reduce((sum, qty) => sum + qty, 0),
  }));
}

function qtyText(entry, qty) {
  return formatInventoryQty(qty, entry.tablets_per_sheet, entry.item_category);
}

export default function Distributors() {
  const [distributors, setDistributors] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listSearch, setListSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [tab, setTab] = useState('medicines');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(ROWS_PER_PAGE);

  useEffect(() => {
    let cancelled = false;
    window.api.purchases.distributors()
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setDistributors(list);
        const first = list.find((row) => row.entries > 0) || list[0];
        if (first) setSelectedKey(first.supplier_key);
      })
      .finally(() => !cancelled && setLoadingList(false));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (selectedKey == null) return undefined;
    let cancelled = false;
    setLoadingPurchases(true);
    setSearch('');
    setVisibleCount(ROWS_PER_PAGE);
    window.api.purchases.byDistributor(selectedKey)
      .then((rows) => !cancelled && setPurchases(Array.isArray(rows) ? rows : []))
      .finally(() => !cancelled && setLoadingPurchases(false));
    return () => { cancelled = true; };
  }, [selectedKey]);

  useEffect(() => setVisibleCount(ROWS_PER_PAGE), [tab, search]);

  const shownDistributors = useMemo(
    () => distributors.filter((row) => matches(displayName(row.supplier_name), listSearch)),
    [distributors, listSearch],
  );
  const selected = distributors.find((row) => row.supplier_key === selectedKey) || null;

  const medicines = useMemo(() => groupByMedicine(purchases), [purchases]);

  const rows = useMemo(() => {
    if (tab === 'medicines') {
      return medicines
        .filter((group) => matches(`${group.name} ${[...group.batches].join(' ')}`, search))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    return purchases.filter((entry) => matches(`${entry.name} ${entry.batch}`, search));
  }, [tab, medicines, purchases, search]);

  const visibleRows = rows.slice(0, visibleCount);
  const hasEarlier = purchases.some((entry) => entry.source === EARLIER_STOCK);

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* Distributor list */}
      <section className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-card lg:max-h-[calc(100vh-180px)]">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-base font-bold text-slate-900">Distributors</h2>
          <p className="mt-0.5 text-xs text-slate-500">Pick one to see what you bought from them</p>
          <div className="relative mt-3">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search distributors"
              className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingList && <p className="p-4 text-sm text-slate-500">Loading…</p>}
          {!loadingList && shownDistributors.length === 0 && (
            <p className="p-4 text-sm text-slate-500">No distributors found.</p>
          )}
          {shownDistributors.map((row) => {
            const active = row.supplier_key === selectedKey;
            return (
              <button
                key={row.supplier_key || '__unknown'}
                type="button"
                onClick={() => setSelectedKey(row.supplier_key)}
                className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition ${
                  active ? 'bg-blue-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className={`text-sm font-semibold ${active ? 'text-blue-800' : 'text-slate-800'} ${row.supplier_key ? '' : 'italic'}`}>
                  {displayName(row.supplier_name)}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {row.entries
                    ? `${row.medicines} medicine${row.medicines === 1 ? '' : 's'} · last ${formatDate(row.last_purchased_at) || '—'}`
                    : 'No purchases recorded yet'}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Purchases from the selected distributor */}
      <section className="min-w-0 space-y-4">
        {!selected ? (
          <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-card">
            {loadingList ? 'Loading…' : 'No purchases recorded yet.'}
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Truck size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{displayName(selected.supplier_name)}</h2>
                    <p className="text-xs text-slate-500">
                      Last purchase {formatDate(selected.last_purchased_at) || '—'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-6 text-right">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Medicines</div>
                    <div className="text-xl font-bold text-slate-900">{selected.medicines}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Purchases</div>
                    <div className="text-xl font-bold text-slate-900">{selected.entries}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Purchase value</div>
                    <div className="text-xl font-bold text-slate-900">{formatCurrency(selected.value)}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-lg bg-slate-100 p-1">
                  {[
                    ['medicines', `Medicines (${medicines.length})`],
                    ['history', `Purchase history (${purchases.length})`],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                        tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="relative min-w-[220px] flex-1">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search medicine or batch"
                    className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl bg-white shadow-card">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    {tab === 'medicines' ? (
                      <tr>
                        <th className="px-4 py-3">Medicine</th>
                        <th className="px-4 py-3 text-center">Times bought</th>
                        <th className="px-4 py-3">Total bought</th>
                        <th className="px-4 py-3 text-center">Batches</th>
                        <th className="px-4 py-3">Last bought</th>
                        <th className="px-4 py-3 text-right">Last rate</th>
                        <th className="px-4 py-3">In stock now</th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Medicine</th>
                        <th className="px-4 py-3">Batch</th>
                        <th className="px-4 py-3">Expiry</th>
                        <th className="px-4 py-3">Qty</th>
                        <th className="px-4 py-3 text-right">Rate</th>
                        <th className="px-4 py-3 text-right">Value</th>
                        <th className="px-4 py-3">Entered via</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {loadingPurchases && (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Loading…</td></tr>
                    )}
                    {!loadingPurchases && rows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                          {search ? `Nothing matches "${search}".` : 'No purchases recorded from this distributor yet.'}
                        </td>
                      </tr>
                    )}
                    {!loadingPurchases && tab === 'medicines' && visibleRows.map((group, index) => (
                      <tr key={group.key} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {group.name}
                          {group.hasEarlier && <span className="ml-1 text-slate-400" title="Includes earlier stock">*</span>}
                        </td>
                        <td className="px-4 py-3 text-center">{group.times}</td>
                        <td className="px-4 py-3">{qtyText(group.last, group.qty)}</td>
                        <td className="px-4 py-3 text-center">{group.batchCount || '—'}</td>
                        <td className="px-4 py-3">{formatDate(group.last.purchased_at) || '—'}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(group.last.purchase_rate)}</td>
                        <td className={`px-4 py-3 ${group.inStock > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {group.inStock > 0 ? qtyText(group.last, group.inStock) : 'Out of stock'}
                        </td>
                      </tr>
                    ))}
                    {!loadingPurchases && tab === 'history' && visibleRows.map((entry, index) => (
                      <tr key={entry.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(entry.purchased_at) || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{entry.name}</td>
                        <td className="px-4 py-3">{entry.batch || '—'}</td>
                        <td className="px-4 py-3">{entry.expiry || '—'}</td>
                        <td className="px-4 py-3">{qtyText(entry, entry.qty)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(entry.purchase_rate)}</td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatCurrency((Number(entry.qty) || 0) * (Number(entry.purchase_rate) || 0))}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{SOURCE_LABELS[entry.source] || entry.source}</td>
                      </tr>
                    ))}
                    {!loadingPurchases && rows.length > visibleRows.length && (
                      <tr>
                        <td colSpan={8} className="px-4 py-4 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500">
                            <span>Showing {visibleRows.length} of {rows.length}</span>
                            <Button variant="secondary" onClick={() => setVisibleCount((n) => n + ROWS_PER_PAGE)}>
                              Show {Math.min(ROWS_PER_PAGE, rows.length - visibleRows.length)} more
                            </Button>
                            <Button variant="secondary" onClick={() => setVisibleCount(rows.length)}>Show all</Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="px-1 text-xs text-slate-500">
              Purchase value uses the purchase rate saved with each entry.
              {hasEarlier && (
                <>
                  {' '}* Earlier stock: batches added before purchase tracking started.
                  Their quantity is the stock on hand when tracking began, not the amount originally bought.
                </>
              )}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
