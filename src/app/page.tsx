import Link from 'next/link';
import { 
  Layers, 
  Package, 
  CalendarClock, 
  Repeat, 
  FileText, 
  ArrowRight, 
  CheckCircle, 
  Zap,
  ShieldCheck 
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <span className="font-bold text-white text-lg">Brightloop Software</span>
          </div>

          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-600/30 transition"
          >
            Open Catalog Hub <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-1 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-6">
          <Zap className="w-3.5 h-3.5" /> Next-Gen Subscription Management Platform
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight max-w-4xl">
          Complete Lifecycle Management for <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Subscription Business</span>
        </h1>

        <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mt-6">
          Person 2 slice implemented: Products, Variants with dynamic pricing, Flexible Billing Plans, Quotation Templates, and high-performance Subscription lifecycles.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/catalog"
            className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base shadow-lg shadow-indigo-600/40 flex items-center gap-2 transition"
          >
            Launch Catalog & Subscriptions <ArrowRight className="w-5 h-5" />
          </Link>

          <Link
            href="/catalog/my-subscriptions"
            className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold text-base transition"
          >
            Customer Portal View
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-16 w-full text-left">
          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
            <Package className="w-6 h-6 text-indigo-400 mb-2" />
            <h3 className="font-semibold text-white">Products & Variants</h3>
            <p className="text-xs text-slate-400 mt-1">
              R6 & R7: Dynamic variants (e.g. Odoo brand +$560), cost/sales prices, and notes.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
            <CalendarClock className="w-6 h-6 text-cyan-400 mb-2" />
            <h3 className="font-semibold text-white">Plans & Policies</h3>
            <p className="text-xs text-slate-400 mt-1">
              R8 & R9: Daily, Weekly, Monthly, Yearly with Auto-close, Pause, Renew, and Early-close flags.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
            <FileText className="w-6 h-6 text-amber-400 mb-2" />
            <h3 className="font-semibold text-white">Quotation Templates</h3>
            <p className="text-xs text-slate-400 mt-1">
              R10: Pre-bundled product lines and plan combinations with validity days.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
            <Repeat className="w-6 h-6 text-emerald-400 mb-2" />
            <h3 className="font-semibold text-white">Subscriptions</h3>
            <p className="text-xs text-slate-400 mt-1">
              R11, R12 & R23: 5,000+ seeded records, strict status flow, response under 2 seconds.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        Brightloop Software • Built for MakeAton Hackathon • Person 2 Slice (Catalog & Subscriptions)
      </footer>
    </div>
  );
}
