import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { LifeBuoy, Plus, Send, ArrowLeft, Lock } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorNote, LoadingBlock, Modal, PageHeader } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { callFunction, supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { Ticket, TicketMessage } from '@/lib/types';

export const TICKET_TONE: Record<Ticket['status'], string> = {
  open: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  answered: 'bg-brand-500/10 text-brand-700 dark:text-brand-400',
  closed: 'bg-soft text-muted',
};

const SUBJECTS = ['Order', 'Payment', 'Refill', 'Cancel', 'API', 'Other'];

export function TicketsPage() {
  const toast = useToast();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [open, setOpen] = useState<Ticket | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [orderRef, setOrderRef] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('tickets').select('*').order('updated_at', { ascending: false });
    if (err) console.error(err);
    setTickets((data as Ticket[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const { data, error: err } = await supabase.from('tickets').insert({ subject, order_ref: orderRef.trim() || null }).select().single();
    if (err || !data) {
      setSaving(false);
      return setError(friendlyError(err, 'Could not create the ticket.'));
    }
    const { error: mErr } = await supabase.from('ticket_messages').insert({ ticket_id: data.id, message: message.trim() });
    setSaving(false);
    if (mErr) return setError(friendlyError(mErr, 'Ticket created, but the message could not be sent.'));
    toast('Ticket created. We will reply soon.');
    setCreating(false);
    setMessage('');
    setOrderRef('');
    load();
  };

  if (open) return <TicketThread ticket={open} onBack={() => { setOpen(null); load(); }} />;

  return (
    <div>
      <PageHeader title="Support Tickets" subtitle="Our team usually replies within a few hours." action={<Button icon={Plus} onClick={() => setCreating(true)}>New ticket</Button>} />
      <div className="card overflow-hidden">
        {tickets === null ? <LoadingBlock /> : tickets.length === 0 ? (
          <EmptyState icon={LifeBuoy} title="No tickets yet" text="Need help with an order or payment? Open a ticket." action={<Button icon={Plus} onClick={() => setCreating(true)}>New ticket</Button>} />
        ) : (
          <ul className="divide-y divide-line">
            {tickets.map((t) => (
              <li key={t.id}>
                <button onClick={() => setOpen(t)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-soft/50">
                  <div className="min-w-0">
                    <p className="font-semibold">#{t.id} · {t.subject}{t.order_ref ? <span className="text-muted"> · Order {t.order_ref}</span> : null}</p>
                    <p className="mt-0.5 text-xs text-muted">Updated {formatDate(t.updated_at)}</p>
                  </div>
                  <Badge tone={TICKET_TONE[t.status]}>{t.status}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="New ticket">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="label" htmlFor="subj">Subject</label>
            <select id="subj" className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="oref">Order ID(s) <span className="font-normal text-muted">(optional)</span></label>
            <input id="oref" className="input" placeholder="e.g. 1024, 1025" value={orderRef} onChange={(e) => setOrderRef(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="msg">Message</label>
            <textarea id="msg" rows={5} className="input" value={message} onChange={(e) => setMessage(e.target.value)} required minLength={5} />
          </div>
          <ErrorNote message={error} />
          <Button type="submit" loading={saving} icon={Send} className="w-full">Submit ticket</Button>
        </form>
      </Modal>
    </div>
  );
}

export function TicketThread({ ticket, onBack, admin }: { ticket: Ticket; onBack: () => void; admin?: boolean }) {
  const toast = useToast();
  const [messages, setMessages] = useState<TicketMessage[] | null>(null);
  const [status, setStatus] = useState(ticket.status);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [{ data, error }, { data: t }] = await Promise.all([
      supabase.from('ticket_messages').select('*').eq('ticket_id', ticket.id).order('created_at'),
      supabase.from('tickets').select('status').eq('id', ticket.id).maybeSingle(),
    ]);
    if (error) console.error(error);
    setMessages((data as TicketMessage[]) ?? []);
    if (t) setStatus(t.status);
  }, [ticket.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const { error } = await supabase.from('ticket_messages').insert({ ticket_id: ticket.id, message: text.trim() });
    setSending(false);
    if (error) return toast(friendlyError(error, 'Could not send your message.'), 'error');
    if (admin) {
      callFunction('email', { action: 'notify', template: 'ticket_reply', user_id: ticket.user_id, vars: { ticket: ticket.id, message: text.trim() } })
        .catch((x) => console.error('ticket email', x));
    }
    setText('');
    load();
  };

  const close = async () => {
    const { error } = await supabase.from('tickets').update({ status: 'closed' }).eq('id', ticket.id);
    if (error) return toast(friendlyError(error), 'error');
    setStatus('closed');
    toast('Ticket closed');
  };

  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </button>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="font-bold">#{ticket.id} · {ticket.subject}</p>
            {ticket.order_ref && <p className="text-xs text-muted">Order {ticket.order_ref}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={TICKET_TONE[status]}>{status}</Badge>
            {status !== 'closed' && <Button size="sm" variant="secondary" icon={Lock} onClick={close}>Close</Button>}
          </div>
        </div>
        <div className="max-h-[55vh] min-h-[240px] space-y-4 overflow-y-auto bg-soft/30 p-5">
          {messages === null ? <LoadingBlock /> : messages.map((m) => {
            const mine = admin ? m.from_admin : !m.from_admin;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-line bg-surface'}`}>
                  <p className={`mb-1 text-xs font-semibold ${mine ? 'text-white/80' : 'text-muted'}`}>{m.from_admin ? 'Support' : admin ? 'Customer' : 'You'} · {formatDate(m.created_at)}</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.message}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        {status === 'closed' && !admin ? (
          <p className="border-t border-line p-4 text-center text-sm text-muted">This ticket is closed. Open a new ticket if you need more help.</p>
        ) : (
          <form onSubmit={send} className="flex gap-2 border-t border-line p-4">
            <textarea rows={2} className="input flex-1 resize-none" placeholder="Write a reply..." value={text} onChange={(e) => setText(e.target.value)} />
            <Button type="submit" loading={sending} icon={Send}>Send</Button>
          </form>
        )}
      </div>
    </div>
  );
}
