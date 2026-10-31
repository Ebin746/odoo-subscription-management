'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Calendar,
  DollarSign,
  FileText,
  User,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

interface InvoiceLookupItem {
  id: string;
  number: string;
  customerName: string;
  total: number;
  amountPaid: number;
  amountOwed: number;
  dueDate: string;
  status: string;
}

interface Props {
  initialInvoiceId?: string;
  availableInvoices: InvoiceLookupItem[];
}

export function RecordPaymentForm({ initialInvoiceId, availableInvoices }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    initialInvoiceId && availableInvoices.some((i) => i.id === initialInvoiceId)
      ? initialInvoiceId
      : availableInvoices[0]?.id || ''
  );

  const selectedInvoice = availableInvoices.find((i) => i.id === selectedInvoiceId);

  const [amount, setAmount] = useState<string>(
    selectedInvoice ? selectedInvoice.amountOwed.toFixed(2) : ''
  );
  const [method, setMethod] = useState<string>('CARD');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [note, setNote] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any>(null);

  const handleInvoiceChange = (id: string) => {
    setSelectedInvoiceId(id);
    const inv = availableInvoices.find((i) => i.id === id);
    if (inv) {
      setAmount(inv.amountOwed.toFixed(2));
    }
    setError(null);
  };

  const handlePayFull = () => {
    if (selectedInvoice) {
      setAmount(selectedInvoice.amountOwed.toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedInvoiceId) {
      setError('Please select an invoice to apply payment to.');
      return;
    }

    const payVal = parseFloat(amount);
    if (isNaN(payVal) || payVal <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }

    if (selectedInvoice && payVal > selectedInvoice.amountOwed + 0.001) {
      setError(
        `Payment amount ($${payVal.toFixed(2)}) exceeds remaining amount owed ($${selectedInvoice.amountOwed.toFixed(2)}).`
      );
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceId: selectedInvoiceId,
            amount: payVal,
            method,
            paymentDate,
            note,
          }),
        });

        const json = await res.json();
        if (!res.ok || json.error) {
          setError(json.error || 'Failed to record payment');
        } else {
          setSuccessData(json.data);
          router.refresh();
        }
      } catch (err: any) {
        setError(err.message || 'Network error occurred');
      }
    });
  };

  if (successData) {
    const isPaid = successData.invoice?.isFullyPaid;
    return (
      <div className="max-w-2xl mx-auto p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white">Payment Recorded Successfully!</h2>
          <p className="text-slate-400 text-sm mt-1">
            Receipt #{successData.payment.id.slice(0, 8)} applied against Invoice{' '}
            <span className="font-mono text-emerald-400">{successData.invoice.number}</span>
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Amount Paid:</span>
            <span className="font-bold text-emerald-400">
              ${Number(successData.payment.amount).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Payment Method:</span>
            <span className="text-white font-medium">{successData.payment.method}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Payment Date:</span>
            <span className="text-white">
              {new Date(successData.payment.paymentDate).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-2">
            <span className="text-slate-400">Invoice Status:</span>
            <span
              className={`font-semibold ${
                isPaid ? 'text-emerald-400' : 'text-blue-400'
              }`}
            >
              {successData.invoice.status} {isPaid ? '(Settled in Full)' : '(Partially Paid)'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Remaining Balance:</span>
            <span className="text-white">
              $
              {Math.max(
                0,
                successData.invoice.total - successData.invoice.amountPaid
              ).toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <button
            onClick={() => {
              setSuccessData(null);
              setAmount('');
              setNote('');
            }}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition"
          >
            Record Another Payment
          </button>
          <Link
            href="/payments/invoices"
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition flex items-center gap-1.5"
          >
            View Invoices <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/payments"
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-sm font-medium transition"
          >
            Finance Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Invoice Selection */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
          Target Invoice (R20)
        </label>
        {availableInvoices.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-sm">
            No open or confirmed invoices available to receive payments.
          </div>
        ) : (
          <select
            value={selectedInvoiceId}
            onChange={(e) => handleInvoiceChange(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            {availableInvoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.number} — {inv.customerName} (Owed: ${inv.amountOwed.toFixed(2)})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Invoice Overview Card */}
      {selectedInvoice && (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              {selectedInvoice.customerName}
            </span>
            <span>Due Date: {new Date(selectedInvoice.dueDate).toLocaleDateString()}</span>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1 text-center">
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Total Invoice</div>
              <div className="text-sm font-bold text-white mt-0.5">
                ${selectedInvoice.total.toFixed(2)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Already Paid</div>
              <div className="text-sm font-bold text-emerald-400 mt-0.5">
                ${selectedInvoice.amountPaid.toFixed(2)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Remaining Owed</div>
              <div className="text-sm font-bold text-rose-400 mt-0.5">
                ${selectedInvoice.amountOwed.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Amount Input with Pay Full Button */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Payment Amount ($)
          </label>
          {selectedInvoice && (
            <button
              type="button"
              onClick={handlePayFull}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition"
            >
              Pay Full Remaining (${selectedInvoice.amountOwed.toFixed(2)})
            </button>
          )}
        </div>
        <div className="relative">
          <DollarSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={selectedInvoice ? selectedInvoice.amountOwed : undefined}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-3 text-base font-semibold text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Payment Method Selector */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
          Payment Method (R20)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {[
            { id: 'CARD', label: 'Credit Card' },
            { id: 'BANK_TRANSFER', label: 'Bank Transfer' },
            { id: 'UPI', label: 'UPI' },
            { id: 'CASH', label: 'Cash' },
            { id: 'OTHER', label: 'Other' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={`p-3 rounded-xl border text-xs font-medium text-center transition flex flex-col items-center gap-1.5 ${
                method === m.id
                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 font-semibold shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Payment Date */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
          Payment Date
        </label>
        <input
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          required
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Internal Note */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
          Payment Note (Optional)
        </label>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Bank wire reference #TXN-98412 or customer memo"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending || !selectedInvoiceId}
        className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <ShieldCheck className="w-4 h-4" />
        {isPending ? 'Recording Payment...' : `Record Payment of $${Number(amount || 0).toFixed(2)}`}
      </button>
    </form>
  );
}

