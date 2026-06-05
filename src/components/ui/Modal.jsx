export default function Modal({
  open,
  title,
  children,
  footer,
  onClose,
  size = 'max-w-3xl',
  viewportInset = null,
}) {
  if (!open) return null;

  const fillViewport = viewportInset != null;

  return (
    <div
      className={
        fillViewport
          ? 'fixed inset-0 z-50 flex bg-slate-950/50'
          : 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4'
      }
      style={fillViewport ? { padding: `${viewportInset}%` } : undefined}
    >
      <div
        className={
          fillViewport
            ? 'flex min-h-0 w-full flex-1 flex-col rounded-2xl bg-white shadow-2xl'
            : `w-full rounded-2xl bg-white shadow-2xl ${size}`
        }
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button className="text-2xl text-slate-400 hover:text-slate-700" onClick={onClose}>
            ×
          </button>
        </div>
        <div
          className={
            fillViewport
              ? 'min-h-0 flex-1 overflow-y-auto px-6 py-5'
              : 'max-h-[75vh] overflow-y-auto px-6 py-5'
          }
        >
          {children}
        </div>
        {footer && <div className="shrink-0 border-t border-slate-200 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
