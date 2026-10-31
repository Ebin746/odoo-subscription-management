import { prisma } from '@/lib/prisma';
import { BillingNav } from '@/components/billing/BillingNav';
import { StatusBadge } from '@/components/billing/StatusBadge';
import { fmtDate, money } from '@/components/billing/format';
import { UserCheck } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { PrintButton } from '@/components/billing/PrintButton';

export default async function MyInvoicesPage() {
  // The logged-in customer (the proxy has already checked the login).
  const session = await getSessionUser();
  const customer = session ? await prisma.user.findUnique({ where: { id: session.id } }) : null;

  const invoices = customer
    ? await prisma.invoice.findMany({
        where: { customerId: customer.id, status: { not: 'DRAFT' } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { subscription: { select: { number: true } } },
      })
    : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <BillingNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Customer Portal
            </span>
            <span className="text-xs text-slate-500">
              Logged in as: <strong className="text-slate-300">{customer?.name || 'Guest'}</strong>
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-emerald-400" />
            My Invoices
          </h1>
        </div>

        <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="text-left px-4 py-3">Invoice</th>
                <th className="text-left px-4 py-3">Subscription</th>
                <th className="text-left px-4 py-3">Issued</th>
                <th className="text-left px-4 py-3">Due</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Balance</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    You have no invoices yet.
                  </td>
                </tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="px-4 py-3 text-white font-medium">{inv.number}</td>
                  <td className="px-4 py-3 text-slate-400">{inv.subscription.number}</td>
                  <td className="px-4 py-3 text-slate-400">{fmtDate(inv.issueDate)}</td>
                  <td className="px-4 py-3 text-slate-400">{fmtDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-right text-white">{money(Number(inv.total))}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{money(Number(inv.total) - Number(inv.amountPaid))}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PrintButton invoiceId={inv.id} className="inline-flex items-center gap-1 text-cyan-400 hover:underline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
