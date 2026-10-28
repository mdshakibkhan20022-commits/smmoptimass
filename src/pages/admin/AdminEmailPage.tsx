import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Save, Send, Server, FileText, Mail, CheckCircle2, Circle } from 'lucide-react';
import { Badge, Button, ErrorNote, LoadingBlock, PageHeader, Toggle } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { callFunction, supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { EmailBroadcast, EmailLog } from './EmailBroadcast';

type EmailSettings = {
  enabled: boolean; smtp_host: string; smtp_port: number; smtp_secure: boolean; smtp_user: string;
  from_name: string; from_email: string; has_password: boolean;
};
type Template = { id: string; key: string; name: string; subject: string; body: string; enabled: boolean };

const SETTINGS_COLS = 'enabled, smtp_host, smtp_port, smtp_secure, smtp_user, from_name, from_email, has_password';
const TABS = [
  { id: 'setup', label: 'Mail server', icon: Server },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'send', label: 'Send to users', icon: Send },
  { id: 'log', label: 'Sent log', icon: Mail },
] as const;
const PLACEHOLDERS = ['{name}', '{username}', '{email}', '{balance}', '{amount}', '{ticket}', '{message}'];

export function AdminEmailPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('setup');
  return (
    <div>
      <PageHeader title="Email" subtitle="Send mail to your customers from your own business address." />
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${tab === t.id ? 'bg-brand-600 text-white' : 'border border-line bg-surface text-muted hover:text-ink'}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'setup' && <SmtpSetup />}
      {tab === 'templates' && <Templates />}
      {tab === 'send' && <EmailBroadcast />}
      {tab === 'log' && <EmailLog />}
    </div>
  );
}

function SmtpSetup() {
  const toast = useToast();
  const { profile } = useAuth();
  const [s, setS] = useState<EmailSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState(profile?.email ?? '');
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('email_settings').select(SETTINGS_COLS).eq('id', 1).maybeSingle();
    if (error || !data) {
      console.error(error);
      return setLoadError('Could not load email settings.');
    }
    setS(data as EmailSettings);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) return <ErrorNote message={loadError} />;
  if (!s) return <LoadingBlock />;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const row: Record<string, unknown> = {
      enabled: s.enabled, smtp_host: s.smtp_host.trim(), smtp_port: Number(s.smtp_port) || 465, smtp_secure: s.smtp_secure,
      smtp_user: s.smtp_user.trim(), from_name: s.from_name.trim(), from_email: s.from_email.trim(), updated_at: new Date().toISOString(),
    };
    if (pass) row.smtp_pass = pass;
    const { error } = await supabase.from('email_settings').update(row).eq('id', 1);
    setBusy(false);
    if (error) return toast(friendlyError(error, 'Could not save email settings.'), 'error');
    setPass('');
    toast('Email settings saved');
    load();
  };

  const test = async () => {
    setTesting(true);
    try {
      await callFunction('email', { action: 'test', to: testTo.trim() });
      toast(`Test email sent to ${testTo.trim()}`);
    } catch (e) {
      toast(friendlyError(e, 'The test email could not be sent.'), 'error');
    } finally {
      setTesting(false);
    }
  };

  const ready = !!(s.smtp_host && s.smtp_user && s.has_password && s.from_email);
  const set = (k: keyof EmailSettings) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: e.target.value });

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <form onSubmit={save} className="card space-y-5 p-5 sm:p-6 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">SMTP mail server</h2>
          <Toggle checked={s.enabled} onChange={(v) => setS({ ...s, enabled: v })} label="Sending turned on" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2"><label className="label">SMTP host</label><input className="input" value={s.smtp_host} onChange={set('smtp_host')} placeholder="smtp.hostinger.com" /></div>
          <div><label className="label">Port</label><input type="number" className="input" value={s.smtp_port} onChange={set('smtp_port')} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ label: 'SSL (port 465)', port: 465, secure: true }, { label: 'TLS (port 587)', port: 587, secure: false }].map((o) => (
            <button type="button" key={o.port} onClick={() => setS({ ...s, smtp_port: o.port, smtp_secure: o.secure })}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${s.smtp_secure === o.secure && Number(s.smtp_port) === o.port ? 'border-brand-600 bg-brand-500/10 text-brand-700 dark:text-brand-400' : 'border-line text-muted hover:text-ink'}`}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Username (usually your email)</label><input className="input" value={s.smtp_user} onChange={set('smtp_user')} autoComplete="off" /></div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" placeholder={s.has_password ? 'Saved. Type to replace' : 'Mailbox password'} />
          </div>
          <div><label className="label">Sender name</label><input className="input" value={s.from_name} onChange={set('from_name')} placeholder="SMM OPTIMA" /></div>
          <div><label className="label">Sender email</label><input type="email" className="input" value={s.from_email} onChange={set('from_email')} placeholder="support@yourdomain.com" /></div>
        </div>
        <div className="flex justify-end"><Button type="submit" loading={busy} icon={Save}>Save</Button></div>
      </form>

      <div className="space-y-6">
        <div className="card space-y-3 p-5 sm:p-6">
          <h2 className="font-bold">Checklist</h2>
          {[['Mail server details', !!(s.smtp_host && s.smtp_user)], ['Password saved', s.has_password], ['Sender email', !!s.from_email], ['Sending turned on', s.enabled]].map(([label, ok]) => (
            <p key={String(label)} className={`flex items-center gap-2 text-sm ${ok ? 'text-ink' : 'text-muted'}`}>
              {ok ? <CheckCircle2 className="h-4 w-4 text-brand-600" /> : <Circle className="h-4 w-4" />} {label}
            </p>
          ))}
        </div>
        <div className="card space-y-3 p-5 sm:p-6">
          <h2 className="font-bold">Send a test</h2>
          <input type="email" className="input" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
          <Button variant="secondary" icon={Send} loading={testing} disabled={!ready || !testTo.trim()} onClick={test} className="w-full">Send test email</Button>
          {!ready && <p className="text-xs text-muted">Save your mail server details and password first.</p>}
        </div>
      </div>
    </div>
  );
}

function Templates() {
  const [items, setItems] = useState<Template[] | null>(null);

  useEffect(() => {
    supabase.from('email_templates').select('*').order('name').then(({ data, error }) => {
      if (error) console.error(error);
      setItems((data as Template[]) ?? []);
    });
  }, []);

  if (!items) return <LoadingBlock />;
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2 p-4 text-sm text-muted">
        You can use: {PLACEHOLDERS.map((p) => <code key={p} className="rounded-md bg-soft px-1.5 py-0.5 text-xs font-semibold text-ink">{p}</code>)}
      </div>
      {items.map((t) => <TemplateCard key={t.id} template={t} />)}
    </div>
  );
}

function TemplateCard({ template }: { template: Template }) {
  const toast = useToast();
  const [t, setT] = useState(template);
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('email_templates')
      .update({ subject: t.subject.trim(), body: t.body, enabled: t.enabled, updated_at: new Date().toISOString() }).eq('id', t.id);
    setBusy(false);
    if (error) return toast(friendlyError(error), 'error');
    toast(`${t.name} saved`);
  };

  return (
    <form onSubmit={save} className="card space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><h2 className="font-bold">{t.name}</h2>{!t.enabled && <Badge>Off</Badge>}</div>
        <Toggle checked={t.enabled} onChange={(v) => setT({ ...t, enabled: v })} label="Send automatically" />
      </div>
      <div><label className="label">Subject</label><input className="input" value={t.subject} onChange={(e) => setT({ ...t, subject: e.target.value })} required /></div>
      <div><label className="label">Message</label><textarea rows={6} className="input" value={t.body} onChange={(e) => setT({ ...t, body: e.target.value })} required /></div>
      <div className="flex justify-end"><Button type="submit" size="sm" loading={busy} icon={Save}>Save template</Button></div>
    </form>
  );
}
