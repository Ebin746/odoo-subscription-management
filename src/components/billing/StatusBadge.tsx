import { statusStyles } from './format';

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs uppercase font-semibold px-2 py-0.5 rounded border ${statusStyles[status] || statusStyles.DRAFT}`}>
      {status}
    </span>
  );
}
