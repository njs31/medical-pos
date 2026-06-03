function formatRegDate(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  const parts = raw.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return raw;
}

function formatAge(years) {
  const y = Number(years) || 0;
  return `${y}Years`;
}

function formatAmount(value) {
  const num = Number(value) || 0;
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

function LabelValue({ label, value, labelWidth = '88px', valueAlign = 'left' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', fontSize: '11px', lineHeight: 1.45, marginBottom: '1px' }}>
      <span style={{ width: labelWidth, flexShrink: 0, textAlign: 'left' }}>{label}</span>
      <span style={{ width: '10px', flexShrink: 0, textAlign: 'center' }}>:</span>
      <span style={{ flex: 1, fontWeight: 400, textAlign: valueAlign }}>{value || ''}</span>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <LabelValue label={label} value={value} labelWidth="108px" valueAlign="right" />
  );
}

const DEFAULT_CLINIC = {
  shop_name: 'DHARVI SREE POLY CLINIC',
  address:
    'GROUND FLOOR, VIJAY NAGAR, D.NO:2-22-134/A1, opp. HUDA PARK, Vijaya Nagar Colony, Kukatpally, Hyderabad, Telangana 500072',
  phone: '+91 91 00 4382 23',
};

function splitAddressLines(address) {
  const text = String(address || '').trim();
  if (!text) return [];
  if (text.length <= 42) return [text];
  const commaParts = text.split(',').map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const mid = Math.ceil(commaParts.length / 2);
    return [commaParts.slice(0, mid).join(', '), commaParts.slice(mid).join(', ')];
  }
  return [text];
}

function toTitleCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseClinicName(shopName) {
  const name = String(shopName || DEFAULT_CLINIC.shop_name).trim();
  const match = name.match(/^(.+?)\s+POLY\s*(CLINIC)?$/i);
  if (match) {
    return { title: toTitleCase(match[1].trim()), subtitle: 'Polyclinic' };
  }
  return { title: toTitleCase(name), subtitle: '' };
}

function ClinicBrand({ settings = {} }) {
  const { title, subtitle } = parseClinicName(settings.shop_name);

  return (
    <div style={{ width: '160px' }}>
      <div
        style={{
          fontFamily: 'Georgia, "Times New Roman", Times, serif',
          fontSize: '20px',
          lineHeight: 1.05,
          color: '#111',
          letterSpacing: '-0.2px',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '9px',
          letterSpacing: '0.2px',
          marginTop: '2px',
          color: '#222',
        }}
      >
        {subtitle || 'Polyclinic'}
      </div>
    </div>
  );
}

const dashed = { borderTop: '1px dashed #000', margin: '8px 0' };

export default function EmergencyBillTemplate({ bill }) {
  const settings = { ...DEFAULT_CLINIC, ...(bill.settings || {}) };
  const addressLines = splitAddressLines(settings.address);
  const items = bill.items?.length
    ? bill.items
    : [{ service_name: '', rate: 0, discount: 0, paid_amount: 0 }];

  const linePaid = items.reduce((sum, item) => sum + (Number(item.paid_amount) || 0), 0);
  const lineDiscount = items.reduce((sum, item) => sum + (Number(item.discount) || 0), 0);
  const paidAmount = Number(bill.paid_amount ?? linePaid) || 0;
  const dueAmount = Number(bill.due_amount) || 0;
  const discountAmount = Number(bill.discount_amount ?? lineDiscount) || 0;

  return (
    <div
      className="emergency-print-root print-root"
      style={{
        width: '100%',
        maxWidth: '720px',
        margin: '0 auto',
        padding: '6px 10px 12px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '11px',
        lineHeight: 1.35,
        color: '#000',
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <ClinicBrand settings={settings} />
        <div
          style={{
            textAlign: 'right',
            fontSize: '10.5px',
            lineHeight: 1.4,
            paddingTop: '2px',
            maxWidth: '280px',
          }}
        >
          {addressLines.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
          {settings.phone ? <div>Ph: {settings.phone}</div> : null}
        </div>
      </div>

      <div
        style={{
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: 700,
          textDecoration: 'underline',
          margin: '10px 0 6px',
          letterSpacing: '0.2px',
        }}
      >
        Procedures Registration
      </div>

      <div style={dashed} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.15fr 0.55fr 1fr',
          columnGap: '18px',
          padding: '2px 0 4px',
        }}
      >
        <div>
          <LabelValue label="Bill No." value={bill.bill_no} labelWidth="78px" />
          <LabelValue label="Doctor Name" value={bill.doctor_name} labelWidth="78px" />
          <LabelValue label="Patient Name" value={bill.patient_name} labelWidth="78px" />
          <LabelValue
            label="F/G/H Name"
            value={String(bill.father_guardian_name || '').toUpperCase()}
            labelWidth="78px"
          />
        </div>
        <div>
          <LabelValue label="Reg. No." value={bill.reg_no} labelWidth="58px" />
        </div>
        <div>
          <LabelValue label="Reg.Date" value={formatRegDate(bill.reg_date)} labelWidth="62px" />
          <LabelValue label="Reg Time" value={bill.reg_time} labelWidth="62px" />
          <LabelValue label="Sex" value={bill.sex} labelWidth="62px" />
          <LabelValue
            label="Age"
            value={formatAge(bill.age_years)}
            labelWidth="62px"
          />
        </div>
      </div>

      <div style={dashed} />

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '11px',
          marginTop: '4px',
        }}
      >
        <thead>
          <tr>
            <th style={{ width: '42px', textAlign: 'left', fontWeight: 700, padding: '2px 0' }}>S.No.</th>
            <th style={{ textAlign: 'left', fontWeight: 700, padding: '2px 0' }}>Service Name</th>
            <th style={{ width: '72px', textAlign: 'right', fontWeight: 700, padding: '2px 0' }}>Rate</th>
            <th style={{ width: '72px', textAlign: 'right', fontWeight: 700, padding: '2px 0' }}>Discount</th>
            <th style={{ width: '88px', textAlign: 'right', fontWeight: 700, padding: '2px 0' }}>Paid Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td style={{ padding: '3px 0', verticalAlign: 'top' }}>{index + 1}</td>
              <td style={{ padding: '3px 0', verticalAlign: 'top', textTransform: 'uppercase' }}>
                {item.service_name}
              </td>
              <td style={{ padding: '3px 0', textAlign: 'right', verticalAlign: 'top' }}>
                {formatAmount(item.rate)}
              </td>
              <td style={{ padding: '3px 0', textAlign: 'right', verticalAlign: 'top' }}>
                {formatAmount(item.discount)}
              </td>
              <td style={{ padding: '3px 0', textAlign: 'right', verticalAlign: 'top' }}>
                {formatAmount(item.paid_amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ ...dashed, marginTop: '10px' }} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px', paddingRight: '2px' }}>
        <div style={{ width: '210px' }}>
          <SummaryRow label="Paid Amount" value={formatAmount(paidAmount)} />
          <SummaryRow label="Due Amount" value={formatAmount(dueAmount)} />
          <SummaryRow label="Discount Amount" value={formatAmount(discountAmount)} />
        </div>
      </div>
    </div>
  );
}
