import { useEffect, useState } from 'react';
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

  async function load() {
    const data = await window.api.settings.get();
    setForm({ ...defaults, ...data });
  }

  useEffect(() => {
    load();
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

      <div className="flex justify-end">
        <Button type="submit">Save Settings</Button>
      </div>
    </form>
  );
}
