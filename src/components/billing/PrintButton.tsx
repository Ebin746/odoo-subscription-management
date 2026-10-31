'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import { openInvoicePdf } from './api';

export function PrintButton({ invoiceId, className }: { invoiceId: string; className?: string }) {
  const [busy, setBusy] = useState(false);

  const print = async () => {
    setBusy(true);
    try {
      await openInvoicePdf(invoiceId);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={print} disabled={busy} className={className}>
      <Printer className="w-4 h-4" /> {busy ? 'Opening...' : 'Print'}
    </button>
  );
}
