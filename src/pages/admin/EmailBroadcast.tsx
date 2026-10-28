import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Send, Mail, RefreshCw } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorNote, LoadingBlock } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { callFunction, supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/lib/format';

type Audience = 'all' | 'with_balance' | 'customers' | 'selected';
type LogRow = { id: string; to_email: string; subject: string; kind: string; status: 'sent' | 'failed'; error: string | null; created_at: string };

const AUDIENCES: { id: Audience; label: string; hint: string }[] = [
  { id: 'all', label: 'All users', hint: 'Every active account' },
  { id: 'customers', label: 'Customers', hint: 'Users who placed an order' },
  { id: 'with_balance', label: 'With balance', hint: 'Users who have funds' },
  { id: 'selected', label: 'Chosen users', hint: 'Type usernames below' },
];

export function EmailBroadcast() {
  const toast = useToast();
  const [audience, setAudience] = useState<Audience>('all');
  const [usernames, setUsernames] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    let userIds: string[] | undefined;
    if (audience === 'selected') {
      const names = [...new Set(usernames.split(/[\s,]+/).map((n) => n.trim().toLowerCase()).filter(Boolean))];
      if (!names.length) return setError('Type at least one username.');
      const { data, error: err } = await supabase.from('profiles').select('id, username').in('username', names);
      if (err) return setError(friendlyError(err));
      if (!data?.length) return setError('None of those usernames were found.');
      userIds = data.map((p) => p.id as string);
    }
    if (!confirm('Send this email now? This cannot be undone.')) return;
    setBusy(true);
    const totals = { sent: 0, failed: 0 };
    setProgress(totals);
    try {
      let offset: number | null = 0;
      while (offset !== null) {
        const r: { sent: number; failed: number; next_offset: number | null } = await callFunction('email', {
          action: 'bulk', subject: subject.trim(), body: body.trim(), audience, user_ids: userIds, offset,
        });
        totals.sent += Number(r.sent) || 0;
        totals.failed += Number(r.failed) || 0;
        setProgress({ ...totals });
        offset = typeof r.next_offset === 'number' ? r.next_offset : null;
      }
      toast(`Done: ${totals.sent} sent${totals.failed ? `, ${totals.failed} failed` : ''}`);
      setSubject('');
      setBody('');
    } catch (err) {
      setError(friendlyError(err, 'Sending stopped. Check your mail server settings.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={send} className="card max-w-3xl space-y-5 p-5 sm:p-6">
      <div>
        <label className="label">Who should get it</label>
        <div className="grid gap-2 sm:grid-cols-4">
          {AUDIENCES.map((a) => (
            <button type="button" key={a.id} onClick={() => setAudience(a.id)}
              className={`rounded-xl border p-3 text-left transition ${audience === a.id ? 'border-brand-600 bg-brand-500/10' : 'border-line hover:border-brand-500/50'}`}>
              <p className={`text-sm font-semibold ${audience === a.id ? 'text-brand-700 dark:text-brand-400' : ''}`}>{a.label}</p>
              <p className="text-xs text-muted">{a.hint}</p>
            </button>
          ))}
        </div>
      </div>
      {audience === 'selected' && (
        <div><label className="label">Usernames</label><textarea rows={2} className="input" value={usernames} onChange={(e) => setUsernames(e.target.value)} placeholder="rahim, karim, sumon" /></div>
      )}
      <div><label className="label">Subject</label><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={200} /></div>
      <div>
        <label className="label">Message</label>
        <textarea rows={8} className="input" value={body} onChange={(e) => setBody(e.target.value)} required placeholder={'Hi {name},\n\nWe just added new TikTok services...'} />
        <p className="mt-1.5 text-xs text-muted">{'{name}'}, {'{username}'} and {'{balance}'} are filled in for each person.</p>
      </div>
      <ErrorNote message={error} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">{progress && <>Sent <span className="font-semibold text-ink">{progress.sent}</span>{progress.failed > 0 && <>, failed <span className="font-semibold text-red-600">{progress.failed}</span></>}{busy && '...'}</>}</p>
        <Button type="submit" icon={Send} loading={busy}>Send email</Button>
      </div>
    </form>
  );
}

export function EmailLog() {
  const [rows, setRows] = useState<LogRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('email_log').select('id, to_email, subject, kind, status, error, created_at').order('created_at', { ascending: false }).limit(200);
    if (error) console.error(error);
    setRows((data as LogRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <p className="text-sm font-semibold">Last 200 emails</p>
        <Button size="sm" variant="ghost" icon={RefreshCw} loading={loading} onClick={load}>Refresh</Button>
      </div>
      {rows === null ? <LoadingBlock /> : rows.length === 0 ? <EmptyState icon={Mail} title="No emails sent yet" /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead><tr className="border-b border-line bg-soft/50">{['To', 'Subject', 'Type', 'Status', 'Date'].map((h) => <th key={h} className="table-head">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0">
                  <td className="table-cell font-semibold">{r.to_email}</td>
                  <td className="table-cell max-w-[260px] truncate">{r.subject}</td>
                  <td className="table-cell text-muted">{r.kind.replace(/_/g, ' ')}</td>
                  <td className="table-cell">
                    {r.status === 'sent'
                      ? <Badge tone="bg-brand-500/10 text-brand-700 dark:text-brand-400">Sent</Badge>
                      : <span title={r.error ?? ''}><Badge tone="bg-red-500/10 text-red-600 dark:text-red-400">Failed</Badge></span>}
                  </td>
                  <td className="table-cell whitespace-nowrap text-muted">{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
