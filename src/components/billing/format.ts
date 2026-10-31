export const money = (v: number | string | null | undefined) => `$${Number(v ?? 0).toFixed(2)}`;

export const fmtDate = (v: string | Date | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : '-');

export const statusStyles: Record<string, string> = {
  DRAFT: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  CONFIRMED: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  PAID: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  CANCELLED: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
};

// Plain objects only: Prisma Decimals and Dates cannot be passed to client components.
export const plain = (value: unknown): any => JSON.parse(JSON.stringify(value));
