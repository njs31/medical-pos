import { calculateBillTotals } from '@/utils/calculations';
import { formatCurrency, formatDate } from '@/utils/formatters';

function formatBillQty(qty, tps) {
  const quantity = Number(qty) || 0;
  const perSheet = Number(tps) || 0;
  if (perSheet <= 0) return String(quantity);
  const sheets = Math.floor(quantity / perSheet);
  const loose = quantity % perSheet;
  return `${sheets}S and ${loose}T`;
}

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
    <div className="print-root mx-auto bg-white text-slate-900 border border-black max-w-[800px] min-h-[500px]">
      <div className="p-6">
        {/* Header Section */}
        <div className="text-left mb-6">
          <h1 className="text-3xl font-bold uppercase text-black mb-3 leading-none">
            {settings.shop_name}
          </h1>
          <div className="text-[13px] text-slate-800 uppercase space-y-1 w-full max-w-3xl">
            {settings.address && settings.address.split(', ').map((part, index, array) => {
               // Heuristic to break address similar to image
               if (index === 0) return <span key={index}>{part}, </span>;
               if (index === array.length - 1) return <span key={index}>{part}</span>;
               return <span key={index}>{part}, </span>;
            })}
            {/* Hard-coded style as per image request if the DB address is one line */}
            <div className="mt-1">
               {settings.address || 'GROUND FLOOR, VIJAY NAGAR, D.NO:2-22-134/A1, opp. HUDA PARK,'} <br/>
               {settings.address ? `Phone: ${settings.phone}` : 'Vijaya Nagar Colony, Kukatpally, Hyderabad, Telangana 500072 | Phone: +91 91 00 4382 23'}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full border-t border-black"></div>

      {/* Invoice Title */}
      <h2 className="text-center font-bold text-[15px] tracking-wide py-3">INVOICE</h2>

      {/* Details Box */}
      <div className="px-6 pb-6">
        <div className="border border-slate-500 mx-auto max-w-[600px] grid grid-cols-2 gap-y-4 gap-x-12 p-4 text-[13px] mb-6 shadow-sm">
          <div className="space-y-4 text-slate-800">
            <div>Patient Name: <span className="font-bold text-slate-900">{bill.patient_name || '-'}</span></div>
            <div>Patient Phone: <span className="font-bold text-slate-900">{bill.patient_phone || '-'}</span></div>
            <div>Doctor Name: <span className="font-bold text-slate-900">{bill.doctor_name || settings.default_doctor || '-'}</span></div>
          </div>
          <div className="space-y-4 text-slate-800">
            <div>Invoice No: <span className="font-bold text-slate-900">{bill.invoice_no}</span></div>
            <div>Date: <span className="font-bold text-slate-900">{formatDate(bill.date)}</span></div>
            <div>Time: <span className="font-bold text-slate-900">{new Date(bill.created_at || new Date()).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })}</span></div>
          </div>
        </div>

        {/* Table */}
        <div className="flex justify-center max-w-[600px] mx-auto">
          <table className="w-full border-collapse border border-slate-500 text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-500">
                {['SN', 'Product Name', 'Batch No', 'Exp', 'Qty', 'Amount'].map((head, index) => (
                  <th key={head} className={`border border-slate-500 px-3 py-2.5 font-bold ${index === 0 || index === 2 || index === 3 || index === 4 || index === 5 ? "" : ""} ${index === 5 ? 'text-right' : 'text-left'} text-slate-800`}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {totals.items.map((item, index) => (
                <tr key={`${item.product_name}-${index}`} className="border-b border-slate-500 last:border-b-0">
                  <td className="border-r border-slate-500 px-3 py-2.5">{index + 1}</td>
                  <td className="border-r border-slate-500 px-3 py-2.5 font-medium">{item.product_name}</td>
                  <td className="border-r border-slate-500 px-3 py-2.5 text-slate-700">{item.batch}</td>
                  <td className="border-r border-slate-500 px-3 py-2.5 text-slate-700">{item.expiry}</td>
                  <td className="border-r border-slate-500 px-3 py-2.5">{formatBillQty(item.qty, item.tablets_per_sheet)}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{Number(item.mrp).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Box aligned to right side exactly like screenshot */}
        <div className="max-w-[600px] mx-auto flex justify-end mt-4">
          <div className="w-[300px] text-[13px] border-b border-t border-transparent">
            {/* Subtotal */}
            <div className="flex justify-between px-3 py-2 mb-1 border-b border-transparent">
              <span className="font-semibold text-slate-700">Subtotal</span>
              <span className="text-slate-900">{formatCurrency(totals.subtotal, 'INR')}</span>
            </div>
            
            {/* Discount */}
            <div className="flex justify-between px-3 py-2 font-bold text-red-600 bg-red-50 rounded-sm mb-1">
              <span>Discount (Save)</span>
              <span>- {formatCurrency(totals.discountAmount, 'INR')}</span>
            </div>

            {/* Grand Total */}
            <div className="flex justify-between px-3 py-3 text-[14px] font-black border-t border-slate-200 mt-1">
              <span className="text-black">Grand Total</span>
              <span className="text-black">{formatCurrency(totals.grandTotal, 'INR')}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
