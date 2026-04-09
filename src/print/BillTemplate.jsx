import { calculateBillTotals } from '@/utils/calculations';
import { formatBillQty, formatBillTime, formatCurrency, formatDate } from '@/utils/formatters';

export default function BillTemplate({ bill }) {
  const settings = bill.settings || {};
  const totals = calculateBillTotals(
    bill.items?.map((item) => ({
      ...item,
      product_name: item.product_name,
      qty: item.qty,
      rate: item.rate,
      discount: item.discount || 0,
    })) || [],
    bill.discount_percent || 0,
  );

  return (
    <div className="print-root" style={{ width: '100%', fontSize: '11px', lineHeight: 1.3, background: 'white', color: '#000' }}>
      {/* Header */}
      <div style={{ padding: '4px 8px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, lineHeight: 1.1 }}>
          {settings.shop_name}
        </h1>
        <div style={{ fontSize: '10px', marginTop: '2px', textTransform: 'uppercase' }}>
          {settings.address && <span>{settings.address} | </span>}
          Phone: {settings.phone}
        </div>
      </div>

      <div style={{ borderBottom: '1px solid #000', margin: '2px 0' }}></div>

      {/* Invoice Title */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px', padding: '4px 0' }}>INVOICE</div>

      <div style={{ padding: '0 8px 8px' }}>
        {/* Patient / Invoice Info */}
        <div style={{ border: '1px solid #333', padding: '4px 8px', marginBottom: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '3px 12px', fontSize: '10.5px' }}>
          <div>Patient Name: <b>{bill.patient_name || '-'}</b></div>
          <div>Invoice No: <b>{bill.invoice_no}</b></div>
          <div>Date: <b>{formatDate(bill.date)}</b></div>
          <div>Patient Phone: <b>{bill.patient_phone || '-'}</b></div>
          <div>Doctor Name: <b>{bill.doctor_name || settings.default_doctor || '-'}</b></div>
          <div>Time: <b>{formatBillTime(bill.created_at)}</b></div>
        </div>

        {/* Items Table — full width */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #000' }}>
              {['SN', 'Product', 'Batch No', 'Exp', 'MRP', 'Qty', 'Amount'].map((head, i) => (
                <th key={head} style={{ padding: '3px 6px', textAlign: i >= 4 ? 'right' : 'left', fontWeight: 'bold' }}>
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {totals.items.map((item, index) => (
              <tr key={`${item.product_name}-${index}`} style={{ borderBottom: '0.5px solid #ccc' }}>
                <td style={{ padding: '3px 6px', width: '30px' }}>{index + 1}</td>
                <td style={{ padding: '3px 6px', fontWeight: 500 }}>{item.product_name}</td>
                <td style={{ padding: '3px 6px', width: '70px' }}>{item.batch}</td>
                <td style={{ padding: '3px 6px', width: '50px' }}>{item.expiry}</td>
                <td style={{ padding: '3px 6px', textAlign: 'right', width: '70px' }}>{formatCurrency(item.mrp)}</td>
                <td style={{ padding: '3px 6px', textAlign: 'right', width: '50px' }}>{formatBillQty(item.qty, item.tablets_per_sheet, item.item_category)}</td>
                <td style={{ padding: '3px 6px', textAlign: 'right', width: '80px' }}>{formatCurrency(item.base_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
          <div style={{ width: '220px', fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px' }}>
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            {Number(totals.discountAmount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 4px', fontWeight: 'bold', color: '#dc2626', fontSize: '15px' }}>
                <span>Discount</span>
                <span>- {formatCurrency(totals.discountAmount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 4px', fontWeight: 'bold', borderTop: '1px solid #000', marginTop: '2px' }}>
              <span>Grand Total</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
