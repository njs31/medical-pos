import { cn } from '@/lib/cn';

export default function Input({ label, className, as = 'input', ...props }) {
  const Comp = as;
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      {label && <span>{label}</span>}
      <Comp
        className={cn(
          'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20',
          className,
        )}
        {...props}
      />
    </label>
  );
}
