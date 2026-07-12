export const PAYMENT_METHODS = ['Cash', 'UPI', 'Card'];

export default function PaymentMethodSelector({ value, onChange }) {
  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Payment Method</div>
      <div className="flex flex-wrap gap-2">
        {PAYMENT_METHODS.map((method) => {
          const selected = value === method;
          return (
            <button
              key={method}
              type="button"
              onClick={() => onChange(method)}
              className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition active:scale-95 ${
                selected
                  ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {method}
            </button>
          );
        })}
      </div>
    </div>
  );
}
