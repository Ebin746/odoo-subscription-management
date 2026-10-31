'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { PasswordChecklist, validatePasswordRules } from '@/components/auth/PasswordChecklist';
import { Layers, ArrowRight, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const rules = validatePasswordRules(password);
  const isPasswordValid = rules.hasMinLength && rules.hasUppercase && rules.hasLowercase && rules.hasSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid password reset link. Please request a new one.');
      return;
    }

    if (!isPasswordValid) {
      setError('Password does not meet all security requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });

      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/auth/login?reset=true');
        }, 2000);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold text-white">Missing Reset Token</h3>
        <p className="text-sm text-slate-400">
          This password reset link is invalid or incomplete. Please request a new link.
        </p>
        <div className="pt-2">
          <Link
            href="/auth/forgot-password"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition"
          >
            Request New Reset Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-sm text-rose-400">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p>{error}</p>
            {error.toLowerCase().includes('expired') || error.toLowerCase().includes('invalid') ? (
              <Link
                href="/auth/forgot-password"
                className="mt-1 text-xs underline font-semibold block text-indigo-400"
              >
                Request a new password reset link &rarr;
              </Link>
            ) : null}
          </div>
        </div>
      )}

      {success ? (
        <div className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-white">Password Updated!</h3>
          <p className="text-sm text-slate-400">
            Your password has been successfully reset. Redirecting to sign in...
          </p>
          <div className="pt-2">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400 hover:text-indigo-300"
            >
              Sign in now &rarr;
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300">New Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="•••••••••"
            />
            <div className="mt-2">
              <PasswordChecklist password={password} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="•••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !isPasswordValid}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-2.5 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-600/30 transition duration-150"
          >
            <KeyRound className="w-4 h-4" />
            {loading ? 'Saving new password...' : 'Reset Password'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-4">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
            <Layers className="w-6 h-6" />
          </div>
          <span className="font-bold text-white text-xl">Brightloop</span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-white">Set new password</h2>
        <p className="mt-1 text-sm text-slate-400">
          Ensure your new password complies with the security requirements below.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-slate-900/80 border border-slate-800 py-8 px-6 shadow-xl rounded-2xl sm:px-10">
          <Suspense fallback={<div className="text-center text-sm text-slate-500 py-6">Loading reset details...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
