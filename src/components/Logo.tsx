import { TrendingUp } from 'lucide-react';
import { Link } from '@/lib/router';

export function Logo({ to = '/', light = false }: { to?: string; light?: boolean }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm transition group-hover:rotate-[-6deg] group-hover:shadow-lift">
        <TrendingUp className="h-5 w-5" strokeWidth={2.5} />
      </span>
      <span className={`text-lg font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>
        SMM <span className="text-brand-600">OPTIMA</span>
      </span>
    </Link>
  );
}
