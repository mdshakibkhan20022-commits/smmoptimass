import { useEffect, useState } from 'react';
import { Users, ListOrdered, DollarSign, TrendingUp, Wallet, LifeBuoy, Activity, AlertTriangle, PiggyBank, Server } from 'lucide-react';
import { Badge, ErrorNote, LoadingBlock, PageHeader, StatCard } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { STATUS_META, formatDate } from '@/lib/format';
import { Link } from '@/lib/router';
import type { Order, Provider } from '@/lib/types';

type Stats = {
  users: number; users_today: number; user_balance: number; orders: number; orders_today: number;
  active_orders: number; failed_orders: number; revenue: number; cost: number; revenue_today: number;
  deposits: number; pending_payments: number; open_tickets: number;
};

export function AdminOverviewPage() {
  const { money } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Order[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('admin_stats').then(({ data, error: err }) => {
      if (err || !data) {
        console.error(err);
        setError('Could not load statistics.');
      } else setStats(data as Stats);
    });
    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(8).then(({ data }) => setRecent((data as Order[]) ?? []));
    supabase.from('providers').select('id, name, balance, currency, active').order('name').then(({ data }) => setProviders((data as Provider[]) ?? []));
  }, []);

  if (error) return <ErrorNote message={error} />;
  if (!stats) return <LoadingBlock />;
  const profit = Number(stats.revenue) - Number(stats.cost);

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle="How your panel is doing today." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={DollarSign} label="Total sales" value={money(stats.revenue)} />
        <StatCard icon={TrendingUp} label="Estimated profit" value={money(profit)} tone="text-sky-600 bg-sky-500/10" />
        <StatCard icon={PiggyBank} label="Total deposits" value={money(stats.deposits)} tone="text-amber-600 bg-amber-500/10" />
        <StatCard icon={Wallet} label="User balances" value={money(stats.user_balance)} tone="text-rose-600 bg-rose-500/10" />
        <StatCard icon={Activity} label="Sales today" value={money(stats.revenue_today)} />
        <StatCard icon={ListOrdered} label="Orders (today)" value={`${stats.orders} (${stats.orders_today})`} tone="text-sky-600 bg-sky-500/10" />
        <StatCard icon={Users} label="Users (today)" value={`${stats.users} (${stats.users_today})`} tone="text-amber-600 bg-amber-500/10" />
        <StatCard icon={Activity} label="Active orders" value={stats.active_orders} tone="text-rose-600 bg-rose-500/10" />
      </div>

      {(stats.pending_payments > 0 || stats.open_tickets > 0 || stats.failed_orders > 0) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {stats.pending_payments > 0 && <Alert to="/admin/payments" icon={Wallet} text={`${stats.pending_payments} payment(s) waiting for review`} />}
          {stats.open_tickets > 0 && <Alert to="/admin/tickets" icon={LifeBuoy} text={`${stats.open_tickets} open ticket(s)`} />}
          {stats.failed_orders > 0 && <Alert to="/admin/orders" icon={AlertTriangle} text={`${stats.failed_orders} order(s) failed to send`} />}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <p className="font-bold">Latest orders</p>
            <Link to="/admin/orders" className="text-sm font-semibold text-brand-600 hover:underline">View all</Link>
          </div>
          <ul className="divide-y divide-line">
            {recent.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No orders yet.</li>}
            {recent.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">#{o.id} · {o.service_name}</p>
                  <p className="text-xs text-muted">{formatDate(o.created_at)} · {o.quantity.toLocaleString()}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-bold">{money(o.charge)}</span>
                  <Badge tone={STATUS_META[o.status].tone}>{STATUS_META[o.status].label}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <p className="font-bold">Provider balances</p>
            <Link to="/admin/providers" className="text-sm font-semibold text-brand-600 hover:underline">Manage</Link>
          </div>
          <ul className="divide-y divide-line">
            {providers.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No providers connected yet.</li>}
            {providers.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-5 py-3">
                <span className="flex items-center gap-2 text-sm font-semibold"><Server className="h-4 w-4 text-muted" />{p.name}</span>
                <span className="text-sm font-bold">{p.balance == null ? '-' : `${Number(p.balance).toFixed(2)} ${p.currency}`}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Alert({ to, icon: Icon, text }: { to: string; icon: typeof Wallet; text: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-500/15 dark:text-amber-400">
      <Icon className="h-5 w-5 shrink-0" /> {text}
    </Link>
  );
}
