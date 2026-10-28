import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Search, ListOrdered, RefreshCw, Save, Send, AlertTriangle, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, Button, EmptyState, LoadingBlock, Modal, PageHeader } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { callFunction, supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { STATUS_META, formatDate } from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';

const PAGE = 50;
const STATUSES = Object.keys(STATUS_META) as OrderStatus[];

export function AdminOrdersPage() {
  const { money } = useApp();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<'all' | 'failed' | OrderStatus>('all');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [edit, setEdit] = useState<Order | null>(null);

  const load = useCallback(async () => {
    let query = supabase.from('orders').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (status === 'failed') query = query.eq('status', 'pending').not('provider_error', 'is', null);
    else if (status !== 'all') query = query.eq('status', status);
    const s = search.trim().replace(/[,%()]/g, '');
    if (s) query = /^\d+$/.test(s) ? query.or(`id.eq.${s},provider_order_id.eq.${s}`) : query.ilike('link', `%${s}%`);
    const { data, count, error } = await query.range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) console.error(error);
    const list = (data as Order[]) ?? [];
    setOrders(list);
    setTotal(count ?? 0);
    const ids = [...new Set(list.map((o) => o.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, username').in('id', ids);
      setNames(Object.fromEntries((profs ?? []).map((p) => [p.id, p.username])));
    }
  }, [page, status, search]);

  useEffect(() => {
    load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await callFunction<{ sent: number; updated: number }>('provider', { action: 'sync' });
      toast(`Sync done: ${r.sent} sent, ${r.updated} updated`);
      load();
    } catch (e) {
      toast(friendlyError(e, 'Sync failed. Please try again.'), 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <PageHeader title="Orders" subtitle={`${total.toLocaleString()} orders`} action={<Button icon={RefreshCw} loading={syncing} onClick={sync}>Sync with providers</Button>} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', ...STATUSES, 'failed'] as const).map((t) => (
            <button key={t} onClick={() => { setStatus(t); setPage(0); }}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${status === t ? 'bg-brand-600 text-white' : 'border border-line bg-surface text-muted hover:text-ink'}`}>
              {t === 'all' ? 'All' : t === 'failed' ? 'Failed to send' : STATUS_META[t].label}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setSearch(q); }} className="relative lg:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-10" placeholder="Order ID, provider ID or link" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
      </div>

      <div className="card overflow-hidden">
        {orders === null ? <LoadingBlock /> : orders.length === 0 ? <EmptyState icon={ListOrdered} title="No orders found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead><tr className="border-b border-line bg-soft/50">{['ID', 'User', 'Service', 'Link', 'Qty', 'Charge', 'Cost', 'Provider ID', 'Status', 'Date'].map((h) => <th key={h} className="table-head">{h}</th>)}</tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} onClick={() => setEdit(o)} className="cursor-pointer border-b border-line/60 transition last:border-0 hover:bg-soft/40">
                    <td className="table-cell font-semibold">{o.id}</td>
                    <td className="table-cell">{names[o.user_id] ?? '-'}</td>
                    <td className="table-cell max-w-[220px]"><span className="line-clamp-2">{o.service_name}</span></td>
                    <td className="table-cell max-w-[180px] truncate text-muted">{o.link}</td>
                    <td className="table-cell">{o.quantity.toLocaleString()}</td>
                    <td className="table-cell font-semibold">{money(o.charge, 4)}</td>
                    <td className="table-cell text-muted">{money(o.cost, 4)}</td>
                    <td className="table-cell">
                      {o.provider_order_id ?? (o.provider_error ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> Failed</span> : '-')}
                    </td>
                    <td className="table-cell"><Badge tone={STATUS_META[o.status].tone}>{STATUS_META[o.status].label}</Badge></td>
                    <td className="table-cell whitespace-nowrap text-muted">{formatDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {total > PAGE && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
          <span className="text-muted">Page {page + 1} of {Math.ceil(total / PAGE)}</span>
          <Button size="sm" variant="secondary" icon={ChevronRight} disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      {edit && <OrderEditor order={edit} username={names[edit.user_id]} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function OrderEditor({ order, username, onClose, onSaved }: { order: Order; username?: string; onClose: () => void; onSaved: () => void }) {
  const { money } = useApp();
  const toast = useToast();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [start, setStart] = useState(order.start_count?.toString() ?? '');
  const [remains, setRemains] = useState(order.remains?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const final = ['completed', 'partial', 'canceled'].includes(order.status);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'partial' && !(Number(remains) > 0)) return toast('Enter how many are remaining for a partial order.', 'error');
    setBusy(true);
    const { error } = await supabase.rpc('admin_set_order_status', {
      p_order: order.id, p_status: status,
      p_start: start === '' ? null : Number(start),
      p_remains: remains === '' ? null : Number(remains),
    });
    setBusy(false);
    if (error) return toast(friendlyError(error), 'error');
    toast(status === 'canceled' || status === 'partial' ? 'Order updated and refund applied' : 'Order updated');
    onSaved();
  };

  const resend = async () => {
    setResending(true);
    try {
      await callFunction('provider', { action: 'submit', order_id: order.id });
      toast('Order sent to provider again');
      onSaved();
    } catch (e) {
      toast(friendlyError(e, 'Could not send the order.'), 'error');
    } finally {
      setResending(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Order #${order.id}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['User', username ?? '-'],
            ['Quantity', order.quantity.toLocaleString()],
            ['Charge', money(order.charge, 4)],
            ['Cost', money(order.cost, 4)],
            ['Provider order', order.provider_order_id ?? '-'],
            ['Refunded', money(order.refunded, 4)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-soft/60 p-3"><p className="text-xs text-muted">{k}</p><p className="truncate font-semibold">{v}</p></div>
          ))}
        </div>
        <p className="text-sm font-semibold">{order.service_name}</p>
        <a href={/^https?:\/\//i.test(order.link) ? order.link : undefined} target="_blank" rel="noreferrer noopener" className="inline-flex max-w-full items-center gap-1.5 break-all text-sm text-brand-600 hover:underline">
          {order.link} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
        {order.provider_error && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400">
            <span><span className="font-semibold">Provider said:</span> {order.provider_error}</span>
            {!order.provider_order_id && order.status === 'pending' && <Button size="sm" variant="secondary" icon={Send} loading={resending} onClick={resend}>Retry</Button>}
          </div>
        )}
        {final ? (
          <p className="rounded-xl bg-soft/60 p-3 text-sm text-muted">This order is finished and can no longer be changed.</p>
        ) : (
          <form onSubmit={save} className="space-y-4 border-t border-line pt-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label">Status</label>
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </select>
              </div>
              <div><label className="label">Start count</label><input type="number" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></div>
              <div><label className="label">Remains</label><input type="number" className="input" value={remains} onChange={(e) => setRemains(e.target.value)} /></div>
            </div>
            <p className="text-xs text-muted">Setting Canceled refunds the full charge. Partial refunds the remaining amount.</p>
            <Button type="submit" loading={busy} icon={Save}>Save changes</Button>
          </form>
        )}
      </div>
    </Modal>
  );
}
