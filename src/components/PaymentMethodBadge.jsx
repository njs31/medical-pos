export function formatPaymentMethod(method) {
  const value = String(method || '').trim();
  return value || 'Cash';
}

const BADGE_STYLES = {
  Cash: 'bg-emerald-100 text-emerald-700',
  UPI: 'bg-blue-100 text-blue-700',
  Card: 'bg-violet-100 text-violet-700',
};

export default function PaymentMethodBadge({ method, className = '' }) {
  const label = formatPaymentMethod(method);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${BADGE_STYLES[label] || 'bg-slate-100 text-slate-700'} ${className}`}
    >
      {label}
    </span>
  );
}
