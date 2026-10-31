'use client';

// App shell — top bar + collapsible sidebar + main content area.
// Owner: P1

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Layers, LogOut, User as UserIcon } from 'lucide-react';
import { useCurrentUser, logout } from '@/lib/useCurrentUser';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const user = useCurrentUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* ── Sidebar (desktop: always visible; mobile: drawer) ── */}
      <aside className="hidden lg:flex shrink-0">
        <Sidebar role={user?.role || 'CUSTOMER'} />
      </aside>

      {/* Mobile drawer backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 lg:hidden transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar role={user?.role || 'CUSTOMER'} onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* ── Main content area ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-600/20 text-indigo-400 rounded-md border border-indigo-500/30">
                <Layers className="w-4 h-4" />
              </div>
              <span className="font-bold text-white text-base tracking-tight">
                Brightloop
              </span>
            </div>
          </div>

          {/* Right side: user info + logout */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-white leading-none">{user.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
                </div>
                <button
                  title="Sign out"
                  className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5 text-xs font-medium"
                  onClick={() => logout()}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <button
                className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition flex items-center gap-1.5"
                onClick={() => router.push('/auth/login')}
              >
                <UserIcon className="w-3.5 h-3.5" />
                Login
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
