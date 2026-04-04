import { cn } from '@/lib/cn';

export default function Input({ label, error, className, as = 'input', ...props }) {
  const Comp = as;
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      {label && <span>{label}</span>}
      <Comp
        className={cn(
          'w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20',
          error ? 'border-red-500 focus:border-red-600 focus:ring-red-100' : 'border-slate-300',
          className,
        )}
        {...props}
      />
      {error && <span className="text-[11px] font-semibold text-red-500 mt-0.5">{error}</span>}
    </label>
  );
}
