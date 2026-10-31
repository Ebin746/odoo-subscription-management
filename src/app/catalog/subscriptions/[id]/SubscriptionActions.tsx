'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Pause, RefreshCw, XCircle, ArrowRightCircle } from 'lucide-react';

export function SubscriptionActions({ subscription }: { subscription: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStatusChange = async (nextStatus: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/catalog/subscriptions/${subscription.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update status');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'pause' | 'resume' | 'renew' | 'close-early') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/catalog/subscriptions/${subscription.id}/${action}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Action ${action} failed`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {error && (
        <span className="text-xs text-rose-400 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
          {error}
        </span>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Status Flow Buttons (R12) */}
        {subscription.status === 'DRAFT' && (
          <button
            onClick={() => handleStatusChange('QUOTATION')}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition"
          >
            <ArrowRightCircle className="w-3.5 h-3.5" /> Move to Quotation
          </button>
        )}

        {subscription.status === 'QUOTATION' && (
          <button
            onClick={() => handleStatusChange('CONFIRMED')}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition"
          >
            <ArrowRightCircle className="w-3.5 h-3.5" /> Confirm Subscription
          </button>
        )}

        {subscription.status === 'CONFIRMED' && (
          <button
            onClick={() => handleStatusChange('ACTIVE')}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
          >
            <ArrowRightCircle className="w-3.5 h-3.5" /> Activate
          </button>
        )}

        {/* Plan Permissions Buttons (R9) */}
        {subscription.status === 'ACTIVE' && subscription.plan.allowPause && (
          subscription.isPaused ? (
            <button
              onClick={() => handleAction('resume')}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition"
            >
              <Play className="w-3.5 h-3.5" /> Resume
            </button>
          ) : (
            <button
              onClick={() => handleAction('pause')}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-medium transition"
            >
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>
          )
        )}

        {subscription.status !== 'CLOSED' && subscription.plan.allowRenew && (
          <button
            onClick={() => handleAction('renew')}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Renew ({subscription.plan.billingPeriod})
          </button>
        )}

        {subscription.status !== 'CLOSED' && subscription.plan.allowEarlyClose && (
          <button
            onClick={() => handleAction('close-early')}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-medium transition"
          >
            <XCircle className="w-3.5 h-3.5" /> Close Early
          </button>
        )}
      </div>
    </div>
  );
}
