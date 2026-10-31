'use client';

// Role-based sidebar — lists EVERY route for all four people.
// Owner: P1

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@/lib/useCurrentUser';
import {
  // Auth / Users (P1)
  Users, Shield,
  // Catalog (P2)
  Package, CalendarClock, FileText, Repeat, UserCheck,
  // Billing (P3)
  Receipt, Tag, Percent,
  // Payments (P4)
  CreditCard, BarChart3,
  // Common
  LayoutDashboard,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
  external?: boolean; // true if page is still a placeholder (e.g. P4 Payments)
  area: 'Auth' | 'Catalog' | 'Billing' | 'Payments';
}

const NAV_ITEMS: NavItem[] = [
  // ── P1: Auth & Users ──────────────────────────────────────────────────────
  { href: '/auth/staff',          label: 'Add Staff',           icon: Shield,       roles: ['ADMIN'],          area: 'Auth' },
  { href: '/auth/customers',      label: 'Customers',           icon: Users,        roles: ['ADMIN', 'STAFF'], area: 'Auth' },

  // ── P2: Catalog & Subscriptions ───────────────────────────────────────────
  { href: '/catalog',             label: 'Catalog Dashboard',   icon: LayoutDashboard, roles: ['ADMIN', 'STAFF'], area: 'Catalog' },
  { href: '/catalog/products',    label: 'Products & Variants', icon: Package,      roles: ['ADMIN', 'STAFF'], area: 'Catalog' },
  { href: '/catalog/plans',       label: 'Plans',               icon: CalendarClock,roles: ['ADMIN', 'STAFF'], area: 'Catalog' },
  { href: '/catalog/quotation-templates', label: 'Quotation Templates', icon: FileText, roles: ['ADMIN', 'STAFF'], area: 'Catalog' },
  { href: '/catalog/subscriptions',       label: 'Subscriptions',       icon: Repeat,   roles: ['ADMIN', 'STAFF'], area: 'Catalog' },
  { href: '/catalog/my-subscriptions',    label: 'My Subscriptions',    icon: UserCheck,roles: ['CUSTOMER'],       area: 'Catalog' },

  // ── P3: Billing, Taxes, Discounts ─────────────────────────────────────────
  { href: '/billing/invoices',    label: 'Invoices',            icon: Receipt,      roles: ['ADMIN', 'STAFF'], area: 'Billing' },
  { href: '/billing/taxes',       label: 'Tax Rules',           icon: Percent,      roles: ['ADMIN'],          area: 'Billing' },
  { href: '/billing/discounts',   label: 'Discounts',           icon: Tag,          roles: ['ADMIN'],          area: 'Billing' },
  { href: '/billing/my-invoices', label: 'My Invoices',         icon: Receipt,      roles: ['CUSTOMER'],       area: 'Billing' },

  // ── P4: Payments & Reporting (Placeholders until P4 integrates) ───────────
  { href: '/payments',            label: 'Payments',            icon: CreditCard,   roles: ['ADMIN', 'STAFF'], area: 'Payments', external: true },
  { href: '/payments/dashboard',  label: 'Finance Dashboard',   icon: BarChart3,    roles: ['ADMIN', 'STAFF'], area: 'Payments', external: true },
  { href: '/payments/my-payments',label: 'My Payments',         icon: CreditCard,   roles: ['CUSTOMER'],       area: 'Payments', external: true },
];

interface SidebarProps {
  role: Role;
  onClose?: () => void;
}

export function Sidebar({ role, onClose }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <nav className="flex flex-col h-full bg-slate-950 border-r border-slate-800 w-64 py-4 px-3 gap-1 overflow-y-auto">
      <div className="px-3 pb-4 mb-2 border-b border-slate-800">
        <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">
          Brightloop Software
        </span>
        <div className="mt-1 text-xs px-2 py-0.5 inline-block rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
          Role: {role}
        </div>
      </div>

      <div className="space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/catalog' && pathname.startsWith(item.href + '/'));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.external && (
                <span className="ml-auto text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700/50">
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
