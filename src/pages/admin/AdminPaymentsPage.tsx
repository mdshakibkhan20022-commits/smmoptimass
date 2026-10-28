import { useCallback, useEffect, useState } from 'react';
import { Wallet, Search, Check, X, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, Button, EmptyState, LoadingBlock, Modal, PageHeader } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { callFunction, supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { Payment } from '@/lib/types';

const PAGE = 50;
const TABS = ['pending', 'approved', 'rejected', 'all'] as const;
const TONE: Record<Payment['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  approved: 'bg-brand-500/10 text-brand-700 dark:text-brand-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
};
const METHOD: Record<Payment['method'], string> = { bkash: 'bKash', stripe: 'Card', admin: 'Admin', affiliate: 'Affiliate' };

export function AdminPaymentsPage() {
  const { money } = useApp();
  const [tab, setTab] = useState<(typeof TABS)[number]>('pending');
  const [rows, setRows] = useState<Payment[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [review, setReview] = useState<Payment | null>(null);

  const load = useCallback(async () => {
    let query = supabase.from('payments').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (tab !== 'all') query = query.eq('status', tab);
    const s = search.trim().replace(/[,%()]/g, '');
    if (s) query = query.or(`trx_id.ilike.%${s}%,sender_number.ilike.%${s}%`);
    const { data, count, error } = await query.range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) console.error(error);
    const list = (data as Payment[]) ?? [];
    setRows(list);
    setTotal(count ?? 0);
    const ids = [...new Set(list.map((p) => p.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, username').in('id', ids);
      setNames(Object.fromEntries((profs ?? []).map((p) => [p.id, p.username])));
    }
  }, [tab, page, search]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Payments" subtitle="Check bKash transactions and add funds to customer balances." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => { setTab(t); setPage(0); }}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold capitalize transition ${tab === t ? 'bg-brand-600 text-white' : 'border border-line bg-surface text-muted hover:text-ink'}`}>
              {t}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setSearch(q); }} className="relative lg:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-10" placeholder="Transaction ID or sender number" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
      </div>

      <div className="card overflow-hidden">
        {rows === null ? <LoadingBlock /> : rows.length === 0 ? <EmptyState icon={Wallet} title={tab === 'pending' ? 'No payments waiting' : 'No payments found'} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead><tr className="border-b border-line bg-soft/50">{['User', 'Method', 'Amount', 'BDT', 'Transaction ID', 'Sender', 'Status', 'Date', ''].map((h) => <th key={h} className="table-head">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-line/60 transition last:border-0 hover:bg-soft/40">
                    <td className="table-cell font-semibold">{names[p.user_id] ?? '-'}</td>
                    <td className="table-cell">{METHOD[p.method]}</td>
                    <td className="table-cell font-semibold">{money(p.amount_usd)}</td>
                    <td className="table-cell text-muted">{p.amount_bdt != null ? `৳${Number(p.amount_bdt).toLocaleString()}` : '-'}</td>
                    <td className="table-cell font-mono text-xs">{p.trx_id ?? '-'}</td>
                    <td className="table-cell text-muted">{p.sender_number ?? '-'}</td>
                    <td className="table-cell"><Badge tone={TONE[p.status]}>{p.status}</Badge></td>
                    <td className="table-cell whitespace-nowrap text-muted">{formatDate(p.created_at)}</td>
                    <td className="table-cell">{p.status === 'pending' && <Button size="sm" onClick={() => setReview(p)}>Review</Button>}</td>
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
      {review && <ReviewModal payment={review} username={names[review.user_id]} onClose={() => setReview(null)} onDone={() => { setReview(null); load(); }} />}
    </div>
  );
}

function ReviewModal({ payment, username, onClose, onDone }: { payment: Payment; username?: string; onClose: () => void; onDone: () => void }) {
  const { money } = useApp();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  const decide = async (approve: boolean) => {
    setBusy(approve ? 'approve' : 'reject');
    const { error } = await supabase.rpc('admin_review_payment', { p_payment: payment.id, p_approve: approve, p_note: note.trim() });
    if (error) {
      setBusy(null);
      return toast(friendlyError(error), 'error');
    }
    if (approve) {
      callFunction('email', { action: 'notify', template: 'payment_approved', user_id: payment.user_id, vars: { amount: `$${Number(payment.amount_usd).toFixed(2)}` } })
        .catch((e) => console.error('payment email failed', e));
    }
    toast(approve ? `${money(payment.amount_usd)} added to ${username ?? 'the user'}` : 'Payment rejected');
    onDone();
  };

  const copy = (v: string) => navigator.clipboard.writeText(v).then(() => toast('Copied'));

  return (
    <Modal open onClose={onClose} title="Review bKash payment">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['User', username ?? '-'],
            ['Credit', money(payment.amount_usd)],
            ['Paid (BDT)', payment.amount_bdt != null ? `৳${Number(payment.amount_bdt).toLocaleString()}` : '-'],
            ['Sender', payment.sender_number ?? '-'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-soft/60 p-3"><p className="text-xs text-muted">{k}</p><p className="truncate font-semibold">{v}</p></div>
          ))}
        </div>
        {payment.trx_id && (
          <div className="flex items-center justify-between rounded-xl border border-line p-3">
            <div><p className="text-xs text-muted">Transaction ID</p><p className="font-mono font-semibold">{payment.trx_id}</p></div>
            <button onClick={() => copy(payment.trx_id!)} className="rounded-lg p-2 text-muted hover:bg-soft hover:text-brand-600" aria-label="Copy"><Copy className="h-4 w-4" /></button>
          </div>
        )}
        <p className="text-sm text-muted">Check your bKash app for this transaction ID and amount before approving.</p>
        <div><label className="label">Note (optional, shown to the user)</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Amount did not match" /></div>
        <div className="flex justify-end gap-2">
          <Button variant="danger" icon={X} loading={busy === 'reject'} disabled={!!busy} onClick={() => decide(false)}>Reject</Button>
          <Button icon={Check} loading={busy === 'approve'} disabled={!!busy} onClick={() => decide(true)}>Approve & add funds</Button>
        </div>
      </div>
    </Modal>
  );
}
