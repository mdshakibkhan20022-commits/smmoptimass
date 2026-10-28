import { useState, type FormEvent } from 'react';
import { Save, KeyRound, Store, Wallet, MessageCircle, ShieldAlert } from 'lucide-react';
import { Button, ErrorNote, LoadingBlock, PageHeader } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import type { Settings } from '@/lib/types';

type Form = Record<Exclude<keyof Settings, 'id'>, string>;

export function AdminSettingsPage() {
  const { settings } = useApp();
  if (!settings) return <LoadingBlock />;
  return (
    <div>
      <PageHeader title="Settings" subtitle="Site details, payment info and contact links." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2"><SettingsForm settings={settings} /></div>
        <PasswordCard />
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Store; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600"><Icon className="h-[18px] w-[18px]" /></div>
        <h2 className="font-bold">{title}</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function SettingsForm({ settings }: { settings: Settings }) {
  const { reloadSettings } = useApp();
  const toast = useToast();
  const [f, setF] = useState<Form>(() =>
    Object.fromEntries(Object.entries(settings).filter(([k]) => k !== 'id').map(([k, v]) => [k, v == null ? '' : String(v)])) as Form);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = (k: keyof Form) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value }) });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const rate = Number(f.usd_to_bdt);
    const min = Number(f.min_deposit_usd);
    const aff = Number(f.affiliate_rate);
    if (!(rate > 0)) return setError('The exchange rate must be above 0.');
    if (!(min >= 0)) return setError('Minimum deposit cannot be negative.');
    if (!(aff >= 0 && aff <= 50)) return setError('Affiliate commission must be between 0 and 50%.');
    setBusy(true);
    const { error: err } = await supabase.from('settings').update({
      site_name: f.site_name.trim(), bkash_number: f.bkash_number.trim(), bkash_account_type: f.bkash_account_type,
      usd_to_bdt: rate, min_deposit_usd: min, affiliate_rate: aff,
      whatsapp: f.whatsapp.trim(), telegram: f.telegram.trim(), support_email: f.support_email.trim(), notice: f.notice.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setBusy(false);
    if (err) return setError(friendlyError(err, 'Could not save settings.'));
    await reloadSettings();
    toast('Settings saved');
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <Section icon={Store} title="General">
        <div><label className="label">Site name</label><input className="input" {...field('site_name')} required /></div>
        <div><label className="label">Support email</label><input type="email" className="input" {...field('support_email')} /></div>
        <div className="sm:col-span-2">
          <label className="label">Notice banner</label>
          <textarea rows={2} className="input" {...field('notice')} placeholder="Shown at the top of the customer panel. Leave empty to hide." />
        </div>
      </Section>
      <Section icon={Wallet} title="Payments and affiliates">
        <div><label className="label">bKash number</label><input className="input" {...field('bkash_number')} placeholder="01XXXXXXXXX" /></div>
        <div>
          <label className="label">bKash account type</label>
          <select className="input" {...field('bkash_account_type')}>{['Personal', 'Agent', 'Merchant'].map((t) => <option key={t}>{t}</option>)}</select>
        </div>
        <div><label className="label">1 USD = how many BDT</label><input type="number" step="0.01" className="input" {...field('usd_to_bdt')} required /></div>
        <div><label className="label">Minimum deposit (USD)</label><input type="number" step="0.01" className="input" {...field('min_deposit_usd')} required /></div>
        <div><label className="label">Affiliate commission (%)</label><input type="number" step="0.1" className="input" {...field('affiliate_rate')} required /></div>
      </Section>
      <Section icon={MessageCircle} title="Contact buttons">
        <div><label className="label">WhatsApp number</label><input className="input" {...field('whatsapp')} placeholder="8801XXXXXXXXX" /></div>
        <div><label className="label">Telegram username or link</label><input className="input" {...field('telegram')} placeholder="smmoptima" /></div>
      </Section>
      <ErrorNote message={error} />
      <div className="flex justify-end"><Button type="submit" loading={busy} icon={Save}>Save settings</Button></div>
    </form>
  );
}

function PasswordCard() {
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError('Use at least 8 characters.');
    if (pw !== pw2) return setError('The passwords do not match.');
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) return setError(friendlyError(err, 'Could not change the password.'));
    setPw('');
    setPw2('');
    toast('Admin password changed');
  };

  return (
    <form onSubmit={save} className="card h-fit space-y-4 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600"><KeyRound className="h-[18px] w-[18px]" /></div>
        <h2 className="font-bold">Admin password</h2>
      </div>
      <p className="flex gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> If you are still using the starter password, change it now so nobody else can get into your admin area.
      </p>
      <div><label className="label">New password</label><input type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
      <div><label className="label">Repeat password</label><input type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></div>
      <ErrorNote message={error} />
      <Button type="submit" loading={busy} icon={Save} className="w-full">Change password</Button>
    </form>
  );
}
