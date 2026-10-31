import Link from 'next/link';
import { 
  Layers, 
  Package, 
  CalendarClock, 
  Repeat, 
  FileText, 
  ArrowRight, 
  DollarSign,
  AlertTriangle,
  Zap,
  CreditCard,
  History,
  UserCheck
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="font-bold text-white text-lg">Brightloop Software</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" /> Catalog Hub
            </Link>
            <Link
              href="/payments"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-md shadow-emerald-600/30 transition"
            >
              <DollarSign className="w-4 h-4" /> Finance Hub <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-1 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-6">
          <Zap className="w-3.5 h-3.5" /> Next-Gen Subscription Management & Finance Platform
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight max-w-4xl">
          Lifecycle & Revenue Operations for <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400">Subscription Business</span>
        </h1>

        <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mt-6">
          Complete implementation covering Catalog & Subscriptions (P2), Billing & Invoices (P3), and Payments & Financial Reporting (P4).
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/payments"
            className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-lg shadow-emerald-600/40 flex items-center gap-2 transition"
          >
            Launch Finance Dashboard (P4) <ArrowRight className="w-5 h-5" />
          </Link>

          <Link
            href="/payments/invoices"
            className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold text-base transition flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Invoices & Aging
          </Link>

          <Link
            href="/catalog"
            className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold text-base transition flex items-center gap-2"
          >
            <Layers className="w-4 h-4 text-indigo-400" />
            Catalog Hub (P2)
          </Link>

          <Link
            href="/payments/my-payments"
            className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold text-base transition flex items-center gap-2"
          >
            <UserCheck className="w-4 h-4 text-emerald-400" />
            Customer Portal
          </Link>
        </div>

        {/* Feature Cards Grid (P4 & P2) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-16 w-full text-left">
          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/40 transition">
            <DollarSign className="w-6 h-6 text-emerald-400 mb-2" />
            <h3 className="font-semibold text-white">Finance Dashboard (R22)</h3>
            <p className="text-xs text-slate-400 mt-1">
              Real-time active subscriptions, revenue collected, outstanding owed, and overdue summaries with filters.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-rose-500/40 transition">
            <AlertTriangle className="w-6 h-6 text-rose-400 mb-2" />
            <h3 className="font-semibold text-white">Paid vs. Outstanding (R21)</h3>
            <p className="text-xs text-slate-400 mt-1">
              Dynamic aging days calculation, overdue highlighted for immediate chase, and invoice settlement tracking.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-cyan-500/40 transition">
            <CreditCard className="w-6 h-6 text-cyan-400 mb-2" />
            <h3 className="font-semibold text-white">Payment Recording (R20)</h3>
            <p className="text-xs text-slate-400 mt-1">
              Method, date, amount and memo validation with atomic partial vs. full paid state transitions.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/40 transition">
            <UserCheck className="w-6 h-6 text-indigo-400 mb-2" />
            <h3 className="font-semibold text-white">Customer Portal & Scale (R23)</h3>
            <p className="text-xs text-slate-400 mt-1">
              Customer receipts and open balance view, responding in under 2 seconds across 5,000+ seeded records.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        Brightloop Software • Built for MakeAton Hackathon • Person 4 Slice (Payments & Financial Reporting)
      </footer>
    </div>
  );
}
