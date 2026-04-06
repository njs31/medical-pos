import { calculateBillTotals } from '@/utils/calculations';
import { formatCurrency, formatDate } from '@/utils/formatters';

function formatBillQty(qty, tps) {
  const quantity = Number(qty) || 0;
  const perSheet = Number(tps) || 0;
  if (perSheet <= 0) return String(quantity);
  const sheets = Math.floor(quantity / perSheet);
  const loose = quantity % perSheet;
  return `${sheets}S, ${loose}T`;
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
    <div className="print-root mx-auto bg-white text-slate-900 border border-black" style={{ maxWidth: '700px', fontSize: '11px', lineHeight: '1.4' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px 8px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, lineHeight: 1.1 }}>
          {settings.shop_name}
        </h1>
        <div style={{ fontSize: '10px', marginTop: '4px', color: '#334155', textTransform: 'uppercase' }}>
          {settings.address && <span>{settings.address} |{' '}</span>}
          Phone: {settings.phone}
        </div>
      </div>

      <div style={{ borderTop: '1px solid black' }}></div>

      {/* Invoice Title */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', padding: '6px 0' }}>INVOICE</div>

      <div style={{ padding: '0 16px 12px' }}>
        {/* Patient / Invoice Info */}
        <div style={{ border: '1px solid #94a3b8', padding: '8px 10px', marginBottom: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 16px', fontSize: '10.5px' }}>
          <div>Patient Name: <b>{bill.patient_name || '-'}</b></div>
          <div>Invoice No: <b>{bill.invoice_no}</b></div>
          <div>Date: <b>{formatDate(bill.date)}</b></div>
          <div>Patient Phone: <b>{bill.patient_phone || '-'}</b></div>
          <div>Doctor Name: <b>{bill.doctor_name || settings.default_doctor || '-'}</b></div>
          <div>Time: <b>{new Date(bill.created_at || new Date()).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })}</b></div>
        </div>

        {/* Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #64748b', fontSize: '10.5px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              {['SN', 'Product Name', 'Batch No', 'Exp', 'Qty', 'Amount'].map((head, i) => (
                <th key={head} style={{ border: '1px solid #64748b', padding: '4px 6px', textAlign: i === 5 ? 'right' : 'left', fontWeight: 'bold', fontSize: '10.5px' }}>
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {totals.items.map((item, index) => (
              <tr key={`${item.product_name}-${index}`} style={{ borderBottom: '0.5px solid #cbd5e1' }}>
                <td style={{ borderRight: '1px solid #64748b', padding: '3px 6px' }}>{index + 1}</td>
                <td style={{ borderRight: '1px solid #64748b', padding: '3px 6px', fontWeight: 500 }}>{item.product_name}</td>
                <td style={{ borderRight: '1px solid #64748b', padding: '3px 6px' }}>{item.batch}</td>
                <td style={{ borderRight: '1px solid #64748b', padding: '3px 6px' }}>{item.expiry}</td>
                <td style={{ borderRight: '1px solid #64748b', padding: '3px 6px' }}>{formatBillQty(item.qty, item.tablets_per_sheet)}</td>
                <td style={{ padding: '3px 6px', textAlign: 'right' }}>{Number(item.mrp).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <div style={{ width: '240px', fontSize: '10.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px' }}>
              <span style={{ fontWeight: 600, color: '#475569' }}>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 6px', fontWeight: 'bold', color: '#dc2626', backgroundColor: '#fef2f2', borderRadius: '2px', fontSize: '26px' }}>
              <span>Discount</span>
              <span>- {formatCurrency(totals.discountAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 6px', fontSize: '12px', fontWeight: 900, borderTop: '1px solid #e2e8f0', marginTop: '2px' }}>
              <span>Grand Total</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
