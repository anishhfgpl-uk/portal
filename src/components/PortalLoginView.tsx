import React, { FormEvent, useState } from 'react';
import { LockKeyhole, LogIn, ShieldCheck, UserRound } from 'lucide-react';

interface PortalLoginViewProps {
  onAuthenticated: () => void;
}

export const PortalLoginView: React.FC<PortalLoginViewProps> = ({ onAuthenticated }) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError('');

    if (!userId.trim() || !password) {
      setError('User ID aur Password dono enter karein.');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: userId.trim(), password }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Invalid User ID or Password.');
      }

      setPassword('');
      onAuthenticated();
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-5">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
          <div className="bg-slate-900 text-white px-7 py-7">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-white/10">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <div className="text-xs font-semibold tracking-widest text-slate-300 uppercase">Anish Tally Portal</div>
                <h1 className="text-2xl font-bold mt-1">User Login</h1>
              </div>
            </div>
            <p className="text-sm text-slate-300 mt-4">
              Password verify hone ke baad hi Company Selection screen open hogi.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-7">
            <label className="block text-sm font-semibold text-slate-700 mb-2">User ID</label>
            <div className="relative mb-5">
              <UserRound className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoComplete="username"
                autoFocus
                placeholder="Enter User ID (Default: admin)"
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter Password (Default: admin123)"
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-medium">
                ❌ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-6 w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <LogIn className="w-5 h-5" />
              {busy ? 'Verifying...' : 'Login & Continue'}
            </button>

            <div className="mt-5 text-center text-xs text-slate-500">
              Secure access • Company data remains company-wise separated
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
