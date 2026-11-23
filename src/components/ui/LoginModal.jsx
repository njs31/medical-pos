import { useState, useRef, useEffect } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, X } from 'lucide-react';

export const INVENTORY_PASSCODE = '3105';

/** Returns true when the entered passcode matches (ignores surrounding spaces). */
export function isValidPasscode(value) {
  return String(value ?? '').trim() === INVENTORY_PASSCODE;
}

export default function LoginModal({ open, onClose, onAuthenticated, toast }) {
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPasscode('');
      setError('');
      setShowPasscode(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  function attempt(value) {
    if (isValidPasscode(value)) {
      setError('');
      onAuthenticated();
      toast?.('Inventory access granted', 'success');
    } else {
      setError('Incorrect passcode');
      setPasscode('');
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    attempt(passcode);
  }

  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, INVENTORY_PASSCODE.length);
    setPasscode(digits);
    if (error) setError('');
    // Unlock automatically once the full passcode length is typed
    if (digits.length === INVENTORY_PASSCODE.length) attempt(digits);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div
        className={`relative w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden transition-transform duration-300 ${shaking ? 'animate-shake' : ''}`}
      >
        <div className="h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        <button
          type="button"
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors"
          onClick={onClose}
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center pt-8 pb-2 px-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 mb-4">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Enter Passcode</h2>
          <p className="text-sm text-slate-500 mt-1 text-center">
            Enter the passcode to make changes to the inventory
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 pt-4 pb-8 space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 animate-fadeIn">
              <Lock size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative">
            <input
              ref={inputRef}
              type={showPasscode ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              value={passcode}
              onChange={handleChange}
              placeholder="••••"
              required
              autoComplete="off"
              aria-label="Passcode"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 py-3 px-11 text-center text-2xl tracking-[0.5em] shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => setShowPasscode((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition-all hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
