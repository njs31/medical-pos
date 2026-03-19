export function ToastStack({ toasts = [] }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'error' ? 'bg-danger' : 'bg-success'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
