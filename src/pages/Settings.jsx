import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

const defaults = {
  shop_name: '',
  address: '',
  phone: '',
  gstin: '',
  logo_path: '',
  default_doctor: '',
  invoice_prefix: 'A000',
  invoice_start: 1,
  default_discount: 0,
  terms: '',
  footer_message: 'GET WELL SOON',
  paper_size: 'A4',
  show_hsn: 1,
  copies: 1,
};

export default function Settings({ toast }) {
  const [form, setForm] = useState(defaults);
  const [suppliers, setSuppliers] = useState([]);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [updateStatus, setUpdateStatus] = useState({
    checking: false,
    available: null,
    downloading: false,
    progress: 0,
    downloaded: false,
    error: null,
  });

  async function load() {
    const data = await window.api.settings.get();
    setForm({ ...defaults, ...data });
  }

  async function loadSuppliers() {
    const list = await window.api.suppliers.getAll();
    setSuppliers(list);
  }

  useEffect(() => {
    load();
    loadSuppliers();

    if (!window.api?.updater) return;

    const cleanup = [
      window.api.updater.onUpdateAvailable((info) => {
        setUpdateStatus((prev) => ({ ...prev, checking: false, available: info }));
        toast(`New update available: ${info.version}`);
      }),
      window.api.updater.onUpdateNotAvailable(() => {
        setUpdateStatus((prev) => ({ ...prev, checking: false, available: false }));
        toast('Software is up to date');
      }),
      window.api.updater.onUpdateError((err) => {
        setUpdateStatus((prev) => ({ ...prev, checking: false, error: err }));
        toast(`Update error: ${err}`, 'error');
      }),
      window.api.updater.onDownloadProgress((p) => {
        setUpdateStatus((prev) => ({ ...prev, downloading: true, progress: Math.round(p.percent) }));
      }),
      window.api.updater.onUpdateDownloaded(() => {
        setUpdateStatus((prev) => ({ ...prev, downloading: false, downloaded: true }));
        toast('Update downloaded. Ready to install.');
      }),
    ].filter(fn => typeof fn === 'function');

    return () => cleanup.forEach((unsub) => unsub());
  }, []);

  async function save(event) {
    event.preventDefault();
    await window.api.settings.save({
      ...form,
      invoice_start: Number(form.invoice_start || 1),
      default_discount: Number(form.default_discount || 0),
      show_hsn: Number(form.show_hsn ? 1 : 0),
      copies: Number(form.copies || 1),
    });
    toast('Settings saved successfully');
    load();
  }

  async function checkUpdates() {
    setUpdateStatus((prev) => ({ ...prev, checking: true, error: null, available: null }));
    try {
      await window.api.updater.checkForUpdates();
    } catch (err) {
      setUpdateStatus((prev) => ({ ...prev, checking: false, error: err.message }));
      toast('Failed to check for updates', 'error');
    }
  }

  async function downloadUpdate() {
    setUpdateStatus((prev) => ({ ...prev, downloading: true }));
    try {
      await window.api.updater.downloadUpdate();
    } catch (err) {
      setUpdateStatus((prev) => ({ ...prev, downloading: false, error: err.message }));
      toast('Download failed', 'error');
    }
  }

  async function installUpdate() {
    await window.api.updater.installUpdate();
  }

  async function addSupplier() {
    if (!newSupplierName.trim()) return;
    await window.api.suppliers.add({ name: newSupplierName.trim(), details: '' });
    setNewSupplierName('');
    toast('Supplier added successfully');
    loadSuppliers();
  }

  async function deleteSupplier(id) {
    if (!window.confirm('Are you sure you want to delete this supplier?')) return;
    await window.api.suppliers.delete(id);
    toast('Supplier deleted');
    loadSuppliers();
  }

  return (
    <form className="space-y-6" onSubmit={save}>
      <section className="rounded-2xl bg-white p-6 shadow-card">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Shop Information</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Shop Name *" required value={form.shop_name} onChange={(e) => setForm((prev) => ({ ...prev, shop_name: e.target.value }))} />
          <Input label="Phone *" required value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
          <Input label="GSTIN *" required value={form.gstin} onChange={(e) => setForm((prev) => ({ ...prev, gstin: e.target.value }))} />
          <div className="space-y-2">
            <Input label="Shop Logo Path" value={form.logo_path} onChange={(e) => setForm((prev) => ({ ...prev, logo_path: e.target.value }))} />
            <input
              type="file"
              accept="image/*"
              className="block w-full text-sm text-slate-600"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file?.path) setForm((prev) => ({ ...prev, logo_path: file.path }));
              }}
            />
          </div>
          <div className="md:col-span-2">
            <Input label="Address *" as="textarea" rows="3" required value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-card">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Bill Defaults</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Default Doctor Name" value={form.default_doctor} onChange={(e) => setForm((prev) => ({ ...prev, default_doctor: e.target.value }))} />
          <Input label="Invoice Number Prefix" value={form.invoice_prefix} onChange={(e) => setForm((prev) => ({ ...prev, invoice_prefix: e.target.value }))} />
          <Input label="Invoice Starting Number" type="number" value={form.invoice_start} onChange={(e) => setForm((prev) => ({ ...prev, invoice_start: e.target.value }))} />
          <Input label="Default Discount %" type="number" value={form.default_discount} onChange={(e) => setForm((prev) => ({ ...prev, default_discount: e.target.value }))} />
          <div className="md:col-span-2">
            <Input label="Terms & Conditions" as="textarea" rows="4" value={form.terms} onChange={(e) => setForm((prev) => ({ ...prev, terms: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Input label="Footer Message" value={form.footer_message} onChange={(e) => setForm((prev) => ({ ...prev, footer_message: e.target.value }))} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-card">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Print Settings</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            <span>Paper Size</span>
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.paper_size}
              onChange={(e) => setForm((prev) => ({ ...prev, paper_size: e.target.value }))}
            >
              <option value="A4">A4</option>
              <option value="80mm">80mm thermal</option>
            </select>
          </label>
          <Input label="Number of Copies" type="number" min="1" max="2" value={form.copies} onChange={(e) => setForm((prev) => ({ ...prev, copies: e.target.value }))} />
          <label className="flex items-center gap-3 pt-7 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(form.show_hsn)}
              onChange={(e) => setForm((prev) => ({ ...prev, show_hsn: e.target.checked ? 1 : 0 }))}
            />
            Show HSN on bill
          </label>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-card">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Manage Suppliers</h2>
        <div className="flex items-end gap-3 mb-4">
          <div className="flex-1">
            <Input 
              label="New Supplier Name" 
              value={newSupplierName} 
              onChange={(e) => setNewSupplierName(e.target.value)} 
              placeholder="e.g. Acme Pharma"
            />
          </div>
          <Button type="button" onClick={addSupplier}>Add Supplier</Button>
        </div>

        <div className="mt-4 border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {suppliers.map(sup => (
                <tr key={sup.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{sup.name}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => deleteSupplier(sup.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr><td className="px-4 py-4 text-center text-slate-500">No suppliers added yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-card border-t-4 border-blue-500">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Software Updates</h2>
            <p className="text-sm text-slate-500">Keep your Pharmacy POS running the latest version.</p>
          </div>
          <div className="flex items-center gap-3">
            {updateStatus.downloaded ? (
              <Button type="button" onClick={installUpdate} className="bg-emerald-600 hover:bg-emerald-700">
                Install & Restart
              </Button>
            ) : updateStatus.available ? (
              <Button type="button" onClick={downloadUpdate} disabled={updateStatus.downloading}>
                {updateStatus.downloading ? `Downloading (${updateStatus.progress}%)` : 'Download Update'}
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={checkUpdates} disabled={updateStatus.checking}>
                {updateStatus.checking ? 'Checking...' : 'Check for Updates'}
              </Button>
            )}
          </div>
        </div>

        {updateStatus.downloading && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${updateStatus.progress}%` }}
              />
            </div>
          </div>
        )}

        {updateStatus.available === false && !updateStatus.checking && (
          <p className="mt-3 text-sm font-medium text-emerald-600">✓ You are using the latest version</p>
        )}

        {updateStatus.error && (
          <p className="mt-3 text-sm font-medium text-red-500">⚠ {updateStatus.error}</p>
        )}
      </section>

      <div className="flex justify-end pt-2">
        <Button type="submit">Save All Settings</Button>
      </div>
    </form>
  );
}
