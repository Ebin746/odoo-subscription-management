'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { api } from '@/components/billing/api';

interface RunSummary {
  subscriptionsChecked: number;
  invoicesCreated: number;
  skippedExisting: number;
  failed: unknown[];
}

interface RunStatus extends RunSummary {
  runId: string;
  status: 'running' | 'done';
  chunksTotal: number;
  chunksDone: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function RunBillingButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const mounted = useRef(true);

  const summary = (r: RunSummary) => ({
    ok: r.failed.length === 0,
    text: `${r.invoicesCreated} invoice(s) created, ${r.skippedExisting} already billed, ${r.failed.length} failed (${r.subscriptionsChecked} subscriptions checked)`,
  });

  // A queued run is followed until it finishes.
  const follow = async (runId: string) => {
    for (;;) {
      const s = await api<RunStatus>(`/api/invoices/run-billing/${runId}`);
      if (!mounted.current) return;
      if (s.status === 'done') {
        setMessage(summary(s));
        router.refresh();
        return;
      }
      setMessage({ ok: true, text: `Billing in progress... ${s.chunksDone}/${s.chunksTotal || '?'} batches, ${s.invoicesCreated} invoice(s) so far` });
      await sleep(1000);
    }
  };

  const run = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const r = await api<any>('/api/invoices/run-billing', 'POST');
      if (r.queued) await follow(r.runId);
      else {
        setMessage(summary(r));
        router.refresh();
      }
    } catch (err: any) {
      setMessage({ ok: false, text: err.message });
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  // Pick up a run that is already in progress (started by the daily schedule or another admin).
  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const active = await api<RunStatus | null>('/api/invoices/run-billing/active');
        if (active && active.status === 'running') {
          setLoading(true);
          await follow(active.runId);
          if (mounted.current) setLoading(false);
        }
      } catch {
        /* no active run, or the status is unavailable */
      }
    })();
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
