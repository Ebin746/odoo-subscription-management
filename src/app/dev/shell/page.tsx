'use client';

import { AppShell } from '@/components/layout/AppShell';
import { useCurrentUser } from '@/lib/useCurrentUser';

export default function ShellPreviewPage() {
  const user = useCurrentUser();

  return (
    <AppShell>
      <div className="p-8 max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">App Shell & Role-Based Menu Preview</h1>
          <p className="text-slate-400 mt-2">
            This page renders inside <code className="text-indigo-400">AppShell</code> with the role-based <code className="text-indigo-400">Sidebar</code>.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-white">Current User State</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Name:</span> <span className="text-slate-200 font-medium">{user?.name}</span>
            </div>
            <div>
              <span className="text-slate-500">Email:</span> <span className="text-slate-200 font-medium">{user?.email}</span>
            </div>
            <div>
              <span className="text-slate-500">Role:</span>{' '}
              <span className="inline-block px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                {user?.role}
              </span>
            </div>
            <div>
              <span className="text-slate-500">User ID:</span> <span className="text-slate-200 font-mono text-xs">{user?.id}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-6 text-sm text-slate-400 space-y-2">
          <h3 className="font-semibold text-slate-300">How to test other roles:</h3>
          <p>
            Open <code className="text-amber-400">src/lib/useCurrentUser.ts</code> and change line 24:
          </p>
          <pre className="bg-slate-950 p-3 rounded-lg text-slate-300 font-mono text-xs overflow-x-auto">
            const DEV_ROLE: Role = &apos;ADMIN&apos;; // Change to &apos;STAFF&apos; or &apos;CUSTOMER&apos;
          </pre>
          <p>The sidebar menu will immediately update to reflect that role&apos;s permissions.</p>
        </div>
      </div>
    </AppShell>
  );
}

