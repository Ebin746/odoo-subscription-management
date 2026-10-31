'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Package, 
  CalendarClock, 
  FileText, 
  Repeat, 
  UserCheck, 
  LayoutDashboard,
  Layers
} from 'lucide-react';

export function CatalogNav() {
  const pathname = usePathname();

  const links = [
    { href: '/catalog', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/catalog/products', label: 'Products & Variants', icon: Package },
    { href: '/catalog/plans', label: 'Plans', icon: CalendarClock },
    { href: '/catalog/quotation-templates', label: 'Quotation Templates', icon: FileText },
    { href: '/catalog/subscriptions', label: 'All Subscriptions', icon: Repeat },
    { href: '/catalog/my-subscriptions', label: 'Customer Portal', icon: UserCheck },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-white text-lg tracking-tight">Brightloop</span>
              <span className="ml-2 text-xs uppercase px-2 py-0.5 font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">
                Catalog & Subscriptions (P2)
              </span>
            </div>
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
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
