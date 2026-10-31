'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { api } from '@/components/billing/api';

export function RunBillingButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const r = await api<{ subscriptionsChecked: number; invoicesCreated: number; skippedExisting: number; failed: unknown[] }>(
        '/api/invoices/run-billing',
        'POST'
      );
      setMessage({
        ok: r.failed.length === 0,
        text: `${r.invoicesCreated} invoice(s) created, ${r.skippedExisting} already billed, ${r.failed.length} failed (${r.subscriptionsChecked} subscriptions checked)`,
      });
      router.refresh();
    } catch (err: any) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition disabled:opacity-50"
      >
        <Play className="w-4 h-4" />
        {loading ? 'Running...' : 'Run billing now'}
      </button>
      {message && <span className={`text-xs ${message.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{message.text}</span>}
    </div>
  );
}
