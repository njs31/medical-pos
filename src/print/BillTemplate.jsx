import { calculateBillTotals } from '@/utils/calculations';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { numberToIndianWords } from '@/utils/numberToWords';

export default function BillTemplate({ bill }) {
  const settings = bill.settings || {};
  const totals = calculateBillTotals(
    bill.items?.map((item) => ({
      ...item,
      product_name: item.product_name,
      qty: item.qty,
      rate: item.rate,
      sgst_percent: item.sgst_percent,
      cgst_percent: item.cgst_percent,
    })) || [],
    bill.discount_percent || 0,
  );

  return (
    <div className={`print-root mx-auto bg-white p-4 text-[12px] text-slate-900 ${settings.paper_size === '80mm' ? 'thermal-bill max-w-[300px] p-4 text-[10px]' : 'max-w-[148mm] min-h-[210mm]'}`}>
      <div className="text-center">
        {settings.logo_path && settings.paper_size !== '80mm' && (
          <img src={`file://${settings.logo_path}`} alt="Shop Logo" className="mx-auto mb-3 h-16 object-contain" />
        )}
        <div className="text-2xl font-extrabold uppercase">{settings.shop_name}</div>
        <div>{settings.address} | Phone: {settings.phone}</div>
      </div>

      <div className="mt-4 text-center text-lg font-bold">INVOICE</div>

      <div className="mt-4 grid grid-cols-2 gap-3 border border-slate-800 p-3">
        <div>Patient Name: <span className="font-semibold">{bill.patient_name || '-'}</span></div>
        <div>Invoice No: <span className="font-semibold">{bill.invoice_no}</span></div>
        <div>Patient Phone: <span className="font-semibold">{bill.patient_phone || '-'}</span></div>
        <div>Date: <span className="font-semibold">{formatDate(bill.date)}</span></div>
        <div>Doctor Name: <span className="font-semibold">{bill.doctor_name || settings.default_doctor || '-'}</span></div>
        <div>Time: <span className="font-semibold">{new Date(bill.created_at || new Date()).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })}</span></div>
      </div>

      <table className="mt-4 w-full border-collapse border border-slate-800 text-[12px]">
        <thead>
          <tr className="bg-slate-100">
            {['SN', 'Product Name', 'Pack', 'Exp', 'Qty', 'MRP'].map((head) => (
              <th key={head} className="border border-slate-800 px-2 py-2 text-left font-bold">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {totals.items.map((item, index) => (
            <tr key={`${item.product_name}-${index}`}>
              <td className="border border-slate-800 px-2 py-2">{index + 1}</td>
              <td className="border border-slate-800 px-2 py-2">{item.product_name}</td>
              <td className="border border-slate-800 px-2 py-2">{item.pack}</td>
               <td className="border border-slate-800 px-2 py-2">{item.expiry}</td>
              <td className="border border-slate-800 px-2 py-2">{item.qty}</td>
              <td className="border border-slate-800 px-2 py-2 text-right">{Number(item.mrp).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto w-full max-w-sm space-y-1 text-sm">
        <div className="flex justify-between border-b border-slate-200 py-1">
          <span>Subtotal</span>
          <span>{formatCurrency(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between border-b border-slate-200 py-1">
          <span>Discount</span>
          <span>{formatCurrency(totals.discountAmount)}</span>
        </div>
        <div className="flex justify-between py-2 text-base font-bold">
          <span>Grand Total</span>
          <span>{formatCurrency(totals.grandTotal)}</span>
        </div>
      </div>



    </div>
  );
}
