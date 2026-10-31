'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Send } from 'lucide-react';
import { api } from '@/components/billing/api';
import { PrintButton } from '@/components/billing/PrintButton';

export function InvoiceActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const act = async (action: 'confirm' | 'cancel' | 'send') => {
    if (action === 'cancel' && !confirm('Cancel this invoice?')) return;
    setBusy(action);
    setMessage(null);
    try {
      const res = await api<{ queued?: boolean }>(`/api/invoices/${id}/${action}`, 'POST');
      setMessage({
        ok: true,
        text: action === 'send' ? (res?.queued ? 'Invoice queued for sending' : 'Invoice emailed to the customer') : `Invoice ${action}ed`,
      });
      router.refresh();
    } catch (err: any) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setBusy(null);
    }
  };

  const btn = 'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50';

  return (
    <div className="flex flex-col items-start sm:items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {status === 'DRAFT' && (
          <button onClick={() => act('confirm')} disabled={!!busy} className={`${btn} bg-indigo-600 hover:bg-indigo-500 text-white`}>
            <CheckCircle2 className="w-4 h-4" /> {busy === 'confirm' ? 'Confirming...' : 'Confirm'}
          </button>
        )}
        {(status === 'DRAFT' || status === 'CONFIRMED') && (
          <button onClick={() => act('cancel')} disabled={!!busy} className={`${btn} bg-slate-800 hover:bg-rose-600/80 text-white`}>
            <XCircle className="w-4 h-4" /> {busy === 'cancel' ? 'Cancelling...' : 'Cancel'}
          </button>
        )}
        {status !== 'CANCELLED' && (
          <button onClick={() => act('send')} disabled={!!busy} className={`${btn} bg-slate-800 hover:bg-slate-700 text-white`}>
            <Send className="w-4 h-4" /> {busy === 'send' ? 'Sending...' : 'Send'}
          </button>
        )}
        <PrintButton invoiceId={id} className={`${btn} bg-slate-800 hover:bg-slate-700 text-white`} />
      </div>
      {message && <span className={`text-xs ${message.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{message.text}</span>}
    </div>
  );
}
