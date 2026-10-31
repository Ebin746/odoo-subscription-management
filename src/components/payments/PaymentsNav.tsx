'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  AlertCircle,
  CreditCard,
  History,
  UserCheck,
  DollarSign,
  Layers,
} from 'lucide-react';

export function PaymentsNav() {
  const pathname = usePathname();

  const links = [
    { href: '/payments', label: 'Finance Dashboard', icon: LayoutDashboard },
    { href: '/payments/invoices', label: 'Invoices & Overdue', icon: AlertCircle },
    { href: '/payments/record', label: 'Record Payment', icon: CreditCard },
    { href: '/payments/history', label: 'Payment History', icon: History },
    { href: '/payments/my-payments', label: 'Customer Portal', icon: UserCheck },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/30 flex items-center justify-center group-hover:bg-emerald-600/30 transition">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-white text-lg tracking-tight">Brightloop</span>
                <span className="ml-2 text-xs uppercase px-2 py-0.5 font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                  Finance & Payments (P4)
                </span>
              </div>
            </Link>
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto py-2">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            <div className="h-5 w-px bg-slate-800 mx-2" />

            <Link
              href="/catalog"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/40 transition"
              title="Switch to Catalog & Subscriptions (P2)"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Catalog Hub</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
