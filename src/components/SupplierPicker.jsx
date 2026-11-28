import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { findSupplierOption, supplierKey } from '@/utils/supplierOptions';

const ADD_NEW = '__add_new_supplier__';

/**
 * Distributor dropdown with an inline "+ Add new supplier" option.
 * `options` comes from buildSupplierOptions(); `onSupplierAdded` receives the saved row.
 */
export default function SupplierPicker({
  label = 'Supplier / Distributor',
  value,
  onChange,
  options,
  onSupplierAdded,
  toast,
  hint,
  required = false,
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (adding) setTimeout(() => inputRef.current?.focus(), 0);
  }, [adding]);

  const current = String(value || '').trim();
  const match = findSupplierOption(options, current);
  // A name from a file or an old batch that isn't in the list yet still shows.
  const unknownCurrent = current && !match ? current : '';
  const selectValue = match ? match.name : unknownCurrent;

  function handleSelect(e) {
    const next = e.target.value;
    if (next === ADD_NEW) {
      setNewName(unknownCurrent);
      setError('');
      setAdding(true);
      return;
    }
    onChange(next);
  }

  async function saveNew() {
    const name = newName.trim().replace(/\s+/g, ' ');
    if (!name) {
      setError('Enter the supplier name');
      return;
    }
    const existing = findSupplierOption(options, name);
    if (existing?.saved) {
      onChange(existing.name);
      setAdding(false);
      toast?.(`${existing.name} is already in the list — selected it`, 'success');
      return;
    }
    setSaving(true);
    try {
      const saved = await window.api.suppliers.add({ name: existing?.name || name, details: '' });
      onSupplierAdded?.(saved);
      onChange(saved.name);
      setAdding(false);
      toast?.(saved.existed ? `${saved.name} selected` : `Supplier ${saved.name} added`, 'success');
    } catch (err) {
      setError(err?.message || 'Could not add supplier');
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault(); // don't submit the surrounding stock form
      saveNew();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      <span>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {adding ? (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="New supplier name"
            aria-label="New supplier name"
            className="min-w-0 flex-1 rounded-md border border-blue-400 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={saveNew}
            disabled={saving}
            className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            disabled={saving}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <select
          value={selectValue}
          onChange={handleSelect}
          aria-label={label}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Select supplier</option>
          {unknownCurrent && (
            <option value={unknownCurrent}>{unknownCurrent} (new — will be saved)</option>
          )}
          {options.map((option) => (
            <option key={supplierKey(option.name)} value={option.name}>
              {option.name}
            </option>
          ))}
          <option value={ADD_NEW}>+ Add new supplier…</option>
        </select>
      )}
      {error && <span className="text-[11px] font-semibold text-red-500">{error}</span>}
      {!error && hint && <span className="text-[11px] font-medium text-slate-500">{hint}</span>}
      {!adding && (
        <button
          type="button"
          onClick={() => { setNewName(''); setError(''); setAdding(true); }}
          className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
        >
          <Plus size={11} /> Add new supplier
        </button>
      )}
    </div>
  );
}
