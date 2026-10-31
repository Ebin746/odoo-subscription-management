'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Pause, RefreshCw, XCircle, Package } from 'lucide-react';

export function CustomerSubCard({ subscription }: { subscription: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: 'pause' | 'resume' | 'renew' | 'close-early') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/catalog/subscriptions/${subscription.id}/${action}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Action failed`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-700/50 text-slate-300 border-slate-600',
    QUOTATION: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    CONFIRMED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    CLOSED: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  };

  return (
    <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <span className="font-mono text-sm font-bold text-white">{subscription.number}</span>
            <h3 className="text-lg font-bold text-white mt-1">{subscription.plan.name}</h3>
            <span className="text-xs text-slate-400">
              Billing: {subscription.plan.billingPeriod} • Terms: {subscription.paymentTerms}
            </span>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              statusColors[subscription.status] || 'bg-slate-800 text-slate-300'
            }`}
          >
            {subscription.status}
            {subscription.isPaused && ' (PAUSED)'}
          </span>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 space-y-1">
          <div className="flex justify-between">
            <span>Start Date:</span>
            <span className="text-white font-medium">
              {new Date(subscription.startDate).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Next Renewal / Expiry:</span>
            <span className="text-white font-medium">
              {new Date(subscription.expiryDate).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Lines */}
        <div className="mt-4 pt-3 border-t border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
            Included Services
          </span>
          <div className="space-y-1.5">
            {subscription.lines.map((line: any) => (
              <div key={line.id} className="text-xs flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-slate-500" />
                  {line.product.name}
                  {line.variant && <span className="text-indigo-400">({line.variant.value})</span>}
                </span>
                <span className="font-mono text-slate-400">×{line.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Customer Action Bar (governed strictly by Plan Permissions) */}
      <div className="mt-6 pt-4 border-t border-slate-800">
        {error && <p className="text-xs text-rose-400 mb-2">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {subscription.status === 'ACTIVE' && subscription.plan.allowPause && (
            subscription.isPaused ? (
              <button
                onClick={() => handleAction('resume')}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold"
              >
                <Play className="w-3.5 h-3.5 inline mr-1" /> Resume
              </button>
            ) : (
              <button
                onClick={() => handleAction('pause')}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold"
              >
                <Pause className="w-3.5 h-3.5 inline mr-1" /> Pause
              </button>
            )
          )}

          {subscription.status !== 'CLOSED' && subscription.plan.allowRenew && (
            <button
              onClick={() => handleAction('renew')}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5 inline mr-1" /> Renew Term
            </button>
          )}

          {subscription.status !== 'CLOSED' && subscription.plan.allowEarlyClose && (
            <button
              onClick={() => handleAction('close-early')}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold"
            >
              <XCircle className="w-3.5 h-3.5 inline mr-1" /> Cancel Early
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
