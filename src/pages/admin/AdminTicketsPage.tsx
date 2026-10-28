import { useCallback, useEffect, useState } from 'react';
import { LifeBuoy, Search } from 'lucide-react';
import { Badge, EmptyState, LoadingBlock, PageHeader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import type { Ticket } from '@/lib/types';
import { TICKET_TONE, TicketThread } from '@/pages/panel/TicketsPage';

const TABS = ['open', 'answered', 'closed', 'all'] as const;

export function AdminTicketsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('open');
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Ticket | null>(null);

  const load = useCallback(async () => {
    let query = supabase.from('tickets').select('*').order('updated_at', { ascending: false }).limit(200);
    if (tab !== 'all') query = query.eq('status', tab);
    const { data, error } = await query;
    if (error) console.error(error);
    const list = (data as Ticket[]) ?? [];
    setTickets(list);
    const ids = [...new Set(list.map((t) => t.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, username').in('id', ids);
      setNames(Object.fromEntries((profs ?? []).map((p) => [p.id, p.username])));
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  if (open) return <TicketThread ticket={open} admin onBack={() => { setOpen(null); load(); }} />;

  const s = q.trim().toLowerCase();
  const shown = (tickets ?? []).filter((t) => !s || String(t.id) === s || t.subject.toLowerCase().includes(s) || (names[t.user_id] ?? '').toLowerCase().includes(s) || (t.order_ref ?? '').includes(s));

  return (
    <div>
      <PageHeader title="Support tickets" subtitle="Reply to customer questions. Customers get an email when you answer." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold capitalize transition ${tab === t ? 'bg-brand-600 text-white' : 'border border-line bg-surface text-muted hover:text-ink'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-10" placeholder="Ticket ID, user or order" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="card overflow-hidden">
        {tickets === null ? <LoadingBlock /> : shown.length === 0 ? <EmptyState icon={LifeBuoy} title="No tickets here" text={tab === 'open' ? 'You are all caught up.' : undefined} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead><tr className="border-b border-line bg-soft/50">{['ID', 'User', 'Subject', 'Order', 'Status', 'Last update'].map((h) => <th key={h} className="table-head">{h}</th>)}</tr></thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t.id} onClick={() => setOpen(t)} className="cursor-pointer border-b border-line/60 transition last:border-0 hover:bg-soft/40">
                    <td className="table-cell font-semibold">#{t.id}</td>
                    <td className="table-cell">{names[t.user_id] ?? '-'}</td>
                    <td className="table-cell font-semibold">{t.subject}</td>
                    <td className="table-cell text-muted">{t.order_ref || '-'}</td>
                    <td className="table-cell"><Badge tone={TICKET_TONE[t.status]}>{t.status}</Badge></td>
                    <td className="table-cell whitespace-nowrap text-muted">{formatDate(t.updated_at)}</td>
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
