import { useEffect, useMemo, useState } from 'react';
import { GitCommitHorizontal, Plus, RotateCcw } from 'lucide-react';
import Button from '@/components/ui/Button';
import { formatCurrency } from '@/utils/formatters';

function sourceLabel(source) {
  const labels = {
    add: 'Add stock',
    bulk_add: 'Bulk add',
    update: 'Update',
    delete: 'Delete',
    adjust: 'Adjust',
    bill: 'Sale',
    bill_update: 'Bill edit',
    bill_delete: 'Bill delete',
    restore: 'Restore',
    manual: 'Manual',
    system: 'System',
  };
  return labels[source] || source || 'Change';
}

function formatWhen(value) {
  if (!value) return '—';
  const normalized = String(value).includes('T') ? value : String(value).replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ChangeField({ label, from, to }) {
  return (
    <div className="text-xs text-slate-600">
      <span className="font-semibold text-slate-700">{label}: </span>
      <span className="text-red-600 line-through">{from ?? '—'}</span>
      <span className="mx-1 text-slate-400">→</span>
      <span className="text-emerald-700">{to ?? '—'}</span>
    </div>
  );
}

function DiffSection({ title, tone, items, emptyText, renderItem }) {
  const toneClass =
    tone === 'added'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'removed'
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-amber-200 bg-amber-50 text-amber-900';

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className={`border-b px-4 py-2 text-sm font-bold ${toneClass}`}>
        {title} ({items.length})
      </div>
      <div className="max-h-72 space-y-2 overflow-auto p-3">
        {items.length === 0 ? (
          <div className="px-1 py-3 text-sm text-slate-400">{emptyText}</div>
        ) : (
          items.map((item) => (
            <div key={`${tone}-${item.id}-${item.name}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              {renderItem(item)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function StockTimeline({ toast }) {
  const [checkpoints, setCheckpoints] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadList(preferId = null) {
    setLoading(true);
    try {
      const rows = await window.api.stockTimeline.list(250);
      setCheckpoints(rows);
      const nextId = preferId || selectedId || rows[0]?.id || null;
      setSelectedId(nextId);
      if (nextId) {
        setDetail(await window.api.stockTimeline.getById(nextId));
      } else {
        setDetail(null);
      }
    } catch (error) {
      toast?.(error?.message || 'Failed to load stock timeline', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  async function openCheckpoint(id) {
    setSelectedId(id);
    try {
      setDetail(await window.api.stockTimeline.getById(id));
    } catch (error) {
      toast?.(error?.message || 'Failed to open checkpoint', 'error');
    }
  }

  async function createCheckpoint() {
    setBusy(true);
    try {
      const created = await window.api.stockTimeline.create('Manual stock checkpoint');
      toast?.(`Checkpoint #${created.id} saved`);
      await loadList(created.id);
    } catch (error) {
      toast?.(error?.message || 'Failed to create checkpoint', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function restoreCheckpoint(id) {
    if (!window.confirm(`Restore inventory to checkpoint #${id}?\n\nCurrent stock will be replaced. A new checkpoint will be created for this restore.`)) {
      return;
    }
    setBusy(true);
    try {
      const result = await window.api.stockTimeline.restore(id);
      toast?.(`Restored ${result.item_count} products from checkpoint #${id}`);
      await loadList();
    } catch (error) {
      toast?.(error?.message || 'Restore failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  const selected = useMemo(
    () => checkpoints.find((row) => row.id === selectedId) || null,
    [checkpoints, selectedId],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-card">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Stock Timeline</h2>
          <p className="text-sm text-slate-500">
            Every stock change creates a checkpoint. Inspect what was added, removed, or changed — and restore any point.
          </p>
        </div>
        <Button disabled={busy} onClick={createCheckpoint}>
          <Plus size={16} className="mr-2" /> Save Checkpoint
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-2xl bg-white shadow-card">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
            History
          </div>
          <div className="max-h-[70vh] overflow-auto">
            {loading ? (
              <div className="p-4 text-sm text-slate-400">Loading checkpoints…</div>
            ) : checkpoints.length === 0 ? (
              <div className="p-4 text-sm text-slate-400">
                No checkpoints yet. Add or edit stock to create the first one, or save a manual checkpoint.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {checkpoints.map((cp) => {
                  const active = cp.id === selectedId;
                  return (
                    <li key={cp.id}>
                      <button
                        type="button"
                        onClick={() => openCheckpoint(cp.id)}
                        className={`w-full px-4 py-3 text-left transition ${
                          active ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <GitCommitHorizontal
                            size={16}
                            className={`mt-1 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-slate-900">{cp.message}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
                                #{cp.id}
                              </span>
                              <span>{sourceLabel(cp.source)}</span>
                              <span>{formatWhen(cp.created_at)}</span>
                            </div>
                            <div className="mt-1.5 flex gap-2 text-xs font-semibold">
                              <span className="text-emerald-600">+{cp.added_count}</span>
                              <span className="text-red-600">-{cp.removed_count}</span>
                              <span className="text-amber-600">~{cp.changed_count}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {!selected || !detail ? (
            <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-400 shadow-card">
              Select a checkpoint to view details
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Checkpoint #{detail.id} · {sourceLabel(detail.source)}
                    </div>
                    <h3 className="mt-1 text-xl font-bold text-slate-900">{detail.message}</h3>
                    <div className="mt-1 text-sm text-slate-500">{formatWhen(detail.created_at)}</div>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => restoreCheckpoint(detail.id)}
                  >
                    <RotateCcw size={16} className="mr-2" /> Restore to this point
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
                  <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-700">
                    +{detail.added_count} added
                  </span>
                  <span className="rounded-lg bg-red-50 px-3 py-1.5 text-red-700">
                    -{detail.removed_count} removed
                  </span>
                  <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-amber-700">
                    ~{detail.changed_count} changed
                  </span>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <DiffSection
                  title="Added"
                  tone="added"
                  items={detail.diff?.added || []}
                  emptyText="Nothing added"
                  renderItem={(item) => (
                    <>
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Batch {item.batch || '—'} · Exp {item.expiry || '—'} · Qty {item.stock_qty}
                        {item.mrp ? ` · MRP ${formatCurrency(item.mrp)}` : ''}
                      </div>
                    </>
                  )}
                />
                <DiffSection
                  title="Removed"
                  tone="removed"
                  items={detail.diff?.removed || []}
                  emptyText="Nothing removed"
                  renderItem={(item) => (
                    <>
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Batch {item.batch || '—'} · Exp {item.expiry || '—'} · Qty {item.stock_qty}
                      </div>
                    </>
                  )}
                />
                <DiffSection
                  title="Changed"
                  tone="changed"
                  items={detail.diff?.changed || []}
                  emptyText="Nothing changed"
                  renderItem={(item) => (
                    <>
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="mt-2 space-y-1">
                        {Object.entries(item.changes || {}).map(([field, change]) => (
                          <ChangeField
                            key={`${item.id}-${field}`}
                            label={field.replace(/_/g, ' ')}
                            from={change.from}
                            to={change.to}
                          />
                        ))}
                      </div>
                    </>
                  )}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
