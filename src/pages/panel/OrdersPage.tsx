import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListOrdered, RefreshCcw, Search, XCircle, Copy } from 'lucide-react';
import { Badge, EmptyState, ErrorNote, LoadingBlock, PageHeader } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { callFunction, supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { STATUS_META, formatDate } from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';
import { Link } from '@/lib/router';

const TABS: Array<'all' | OrderStatus> = ['all', 'pending', 'processing', 'in_progress', 'completed', 'partial', 'canceled'];

export function OrdersPage() {
  const { money } = useApp();
  const { refreshProfile } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [refillable, setRefillable] = useState<Set<number>>(new Set());
  const [cancelable, setCancelable] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(500);
    if (err) {
      console.error(err);
      setError('Could not load your orders.');
    } else {
      const list = data as Order[];
      setOrders(list);
      const ids = [...new Set(list.map((o) => o.service_id).filter(Boolean))] as number[];
      if (ids.length) {
        const { data: svc } = await supabase.from('services').select('id, refill, cancel').in('id', ids);
        setRefillable(new Set((svc ?? []).filter((s) => s.refill).map((s) => s.id)));
        setCancelable(new Set((svc ?? []).filter((s) => s.cancel).map((s) => s.id)));
      }
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    callFunction<{ updated: number }>('provider', { action: 'sync_mine' })
      .then((r) => {
        if (r.updated > 0) {
          load();
          refreshProfile();
        }
      })
      .catch((e) => console.error('sync failed', e));
  }, [load, refreshProfile]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => (tab === 'all' || o.status === tab) &&
      (!needle || String(o.id).includes(needle) || o.link.toLowerCase().includes(needle) || o.service_name.toLowerCase().includes(needle)));
  }, [orders, tab, q]);

  const act = async (o: Order, kind: 'refill' | 'cancel') => {
    setBusy(o.id);
    const { error: err } = await supabase.rpc(kind === 'refill' ? 'request_refill' : 'request_cancel', { p_order: o.id });
    setBusy(null);
    if (err) return toast(friendlyError(err), 'error');
    toast(kind === 'refill' ? 'Refill requested' : 'Cancel requested');
    await Promise.all([load(), refreshProfile()]);
  };

  return (
    <div>
      <PageHeader title="My Orders" subtitle="Track the progress of every order in real time." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${tab === t ? 'bg-brand-600 text-white' : 'border border-line bg-surface text-muted hover:text-ink'}`}>
              {t === 'all' ? 'All' : STATUS_META[t].label}
            </button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-10" placeholder="Search by ID or link" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <LoadingBlock /> : error ? <div className="p-5"><ErrorNote message={error} /></div> : filtered.length === 0 ? (
          <EmptyState icon={ListOrdered} title="No orders yet" text="Your orders will appear here." action={<Link to="/new-order" className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Place an order</Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="border-b border-line bg-soft/50">
                  {['ID', 'Date', 'Link', 'Charge', 'Start count', 'Quantity', 'Service', 'Status', 'Remains', ''].map((h) => <th key={h} className="table-head">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-line/60 transition last:border-0 hover:bg-soft/40">
                    <td className="table-cell font-semibold">{o.id}</td>
                    <td className="table-cell whitespace-nowrap text-muted">{formatDate(o.created_at)}</td>
                    <td className="table-cell max-w-[200px]">
                      <button onClick={() => { navigator.clipboard.writeText(o.link); toast('Link copied'); }} className="group flex max-w-full items-center gap-1.5 text-left">
                        <span className="truncate">{o.link}</span><Copy className="h-3 w-3 shrink-0 text-muted opacity-0 group-hover:opacity-100" />
                      </button>
                    </td>
                    <td className="table-cell whitespace-nowrap font-semibold">{money(o.charge, 4)}</td>
                    <td className="table-cell text-muted">{o.start_count ?? '-'}</td>
                    <td className="table-cell">{o.quantity.toLocaleString()}</td>
                    <td className="table-cell max-w-[240px]"><span className="line-clamp-2">{o.service_name}</span></td>
                    <td className="table-cell"><Badge tone={STATUS_META[o.status].tone}>{STATUS_META[o.status].label}</Badge></td>
                    <td className="table-cell text-muted">{o.remains ?? '-'}</td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-1.5">
                        {o.service_id && refillable.has(o.service_id) && ['completed', 'partial'].includes(o.status) && (
                          o.refill_status === 'none' || o.refill_status === 'failed' ? (
                            <button disabled={busy === o.id} onClick={() => act(o, 'refill')} className="inline-flex items-center gap-1 rounded-lg bg-brand-500/10 px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-500/20 disabled:opacity-50 dark:text-brand-400">
                              <RefreshCcw className="h-3 w-3" /> Refill
                            </button>
                          ) : <Badge>Refill {o.refill_status}</Badge>
                        )}
                        {['pending', 'processing', 'in_progress'].includes(o.status) && !o.cancel_requested &&
                          ((!o.provider_order_id && o.status === 'pending') || (o.service_id && cancelable.has(o.service_id))) && (
                          <button disabled={busy === o.id} onClick={() => act(o, 'cancel')} className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-500/20 disabled:opacity-50">
                            <XCircle className="h-3 w-3" /> Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
