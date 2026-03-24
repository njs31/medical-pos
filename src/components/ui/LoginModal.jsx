import { useState, useRef, useEffect } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, X } from 'lucide-react';

const VALID_USERNAME = 'ramya';
const VALID_PASSWORD = 'care@ramya';

export default function LoginModal({ open, onClose, onAuthenticated, toast }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef(null);

  useEffect(() => {
    if (open) {
      setUsername('');
      setPassword('');
      setError('');
      setShowPassword(false);
      setTimeout(() => usernameRef.current?.focus(), 100);
    }
  }, [open]);

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate a brief auth delay for polish
    setTimeout(() => {
      if (username === VALID_USERNAME && password === VALID_PASSWORD) {
        onAuthenticated();
        toast?.('Inventory access granted', 'success');
        setLoading(false);
      } else {
        setError('Invalid username or password');
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
        setLoading(false);
      }
    }, 400);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div
        className={`relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden transition-transform duration-300 ${shaking ? 'animate-shake' : ''}`}
      >
        {/* Header gradient strip */}
        <div className="h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        {/* Close button */}
        <button
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors"
          onClick={onClose}
        >
          <X size={20} />
        </button>

        {/* Icon & Title */}
        <div className="flex flex-col items-center pt-8 pb-2 px-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 mb-4">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Authentication Required</h2>
          <p className="text-sm text-slate-500 mt-1 text-center">
            Sign in to make changes to the inventory
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pt-4 pb-8 space-y-5">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 animate-fadeIn">
              <Lock size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Username */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Username
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <User size={16} />
              </div>
              <input
                ref={usernameRef}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                autoComplete="off"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock size={16} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoComplete="off"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-11 text-sm shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-blue-500/30 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Verifying...
              </span>
            ) : (
              'Sign In & Continue'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
