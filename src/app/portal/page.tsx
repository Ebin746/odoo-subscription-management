'use client';

// Customer Portal Home
// Owner: P1 (Hosts customer pages for P2, P3, P4 + profile)

import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { useCurrentUser } from '@/lib/useCurrentUser';
import {
  UserCheck,
  Receipt,
  CreditCard,
  User as UserIcon,
  ArrowRight,
  ShieldCheck,
  Building2,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';

export default function CustomerPortalPage() {
  const user = useCurrentUser();

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/20 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Customer Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
            Welcome back, {user?.name || 'Customer'}
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-xl">
            Manage your Brightloop software subscriptions, view billing invoices, and keep your contact details up to date.
          </p>
        </div>

        {/* Portal Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Subscriptions Card (P2) */}
          <Link
            href="/catalog/my-subscriptions"
            className="group p-6 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg w-fit border border-indigo-500/20 group-hover:scale-105 transition">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mt-4">My Subscriptions</h3>
              <p className="text-xs text-slate-400 mt-2">
                View active plans, check renewal dates, and manage permitted pause/close actions.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-indigo-400 gap-1 group-hover:translate-x-1 transition">
              Open subscriptions <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* Invoices Card (P3) */}
          <Link
            href="/billing/my-invoices"
            className="group p-6 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg w-fit border border-emerald-500/20 group-hover:scale-105 transition">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mt-4">My Invoices</h3>
              <p className="text-xs text-slate-400 mt-2">
                Access your itemized billing invoices, tax breakdowns, and download official PDF statements.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-emerald-400 gap-1 group-hover:translate-x-1 transition">
              View invoices <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* Payments Card (P4) */}
          <Link
            href="/payments/my-payments"
            className="group p-6 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 transition duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-lg w-fit border border-cyan-500/20 group-hover:scale-105 transition">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mt-4">My Payments</h3>
              <p className="text-xs text-slate-400 mt-2">
                Review payment histories, track recorded payment receipts, and see outstanding balances.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-cyan-400 gap-1 group-hover:translate-x-1 transition">
              View payments (soon) <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>

        {/* Customer Profile Section */}
        <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-semibold text-white">Your Account Profile</h2>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              Active Account
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/50 border border-slate-800/80">
              <UserIcon className="w-4 h-4 text-slate-500 mt-0.5" />
              <div>
                <span className="text-xs text-slate-500 block">Full Name</span>
                <span className="text-slate-200 font-medium">{user?.name || 'Not provided'}</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/50 border border-slate-800/80">
              <Mail className="w-4 h-4 text-slate-500 mt-0.5" />
              <div>
                <span className="text-xs text-slate-500 block">Email Address</span>
                <span className="text-slate-200 font-medium">{user?.email || 'Not provided'}</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/50 border border-slate-800/80">
              <Building2 className="w-4 h-4 text-slate-500 mt-0.5" />
              <div>
                <span className="text-xs text-slate-500 block">Company Name</span>
                <span className="text-slate-200 font-medium">{user?.companyName || 'None listed'}</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/50 border border-slate-800/80">
              <Phone className="w-4 h-4 text-slate-500 mt-0.5" />
              <div>
                <span className="text-xs text-slate-500 block">Phone</span>
                <span className="text-slate-200 font-medium">{user?.phone || 'None listed'}</span>
              </div>
            </div>

            <div className="sm:col-span-2 flex items-start gap-3 p-3 rounded-lg bg-slate-950/50 border border-slate-800/80">
              <MapPin className="w-4 h-4 text-slate-500 mt-0.5" />
              <div>
                <span className="text-xs text-slate-500 block">Billing Address</span>
                <span className="text-slate-200 font-medium">{user?.billingAddress || 'No address provided'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

