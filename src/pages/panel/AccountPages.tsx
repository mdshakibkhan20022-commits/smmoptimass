import { useEffect, useState, type FormEvent } from 'react';
import { Users, Copy, Gift, Percent, ArrowRightLeft, KeyRound, Save, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Button, ErrorNote, LoadingBlock, PageHeader, StatCard } from '@/components/ui';
import { ApiDocs } from '@/components/ApiDocs';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';

export function AffiliatesPage() {
  const { profile, refreshProfile } = useAuth();
  const { settings, money } = useApp();
  const toast = useToast();
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.rpc('my_referral_count').then(({ data, error }) => {
      if (error) console.error(error);
      setCount(typeof data === 'number' ? data : 0);
    });
  }, []);

  if (!profile) return <LoadingBlock />;
  const link = `${window.location.origin}/signup?ref=${encodeURIComponent(profile.username)}`;

  const transfer = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('transfer_affiliate_earnings');
    setBusy(false);
    if (error) return toast(friendlyError(error), 'error');
    toast('Earnings moved to your balance');
    refreshProfile();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Affiliates" subtitle="Invite friends and earn a commission on every deposit they make." />
      <div className="card p-5 sm:p-6">
        <label className="label">Your referral link</label>
        <div className="flex gap-2">
          <input readOnly className="input font-mono text-sm" value={link} onFocus={(e) => e.target.select()} />
          <Button variant="secondary" icon={Copy} onClick={() => { navigator.clipboard.writeText(link); toast('Link copied'); }}>Copy</Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Percent} label="Commission rate" value={`${settings?.affiliate_rate ?? 5}%`} />
        <StatCard icon={Users} label="Referred users" value={count ?? '...'} tone="text-sky-600 bg-sky-500/10" />
        <StatCard icon={Gift} label="Available earnings" value={money(profile.affiliate_earnings)} tone="text-amber-600 bg-amber-500/10" />
      </div>
      <div className="card flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div>
          <p className="font-bold">Move earnings to your balance</p>
          <p className="text-sm text-muted">You can transfer once you have at least $1.00 in earnings.</p>
        </div>
        <Button icon={ArrowRightLeft} loading={busy} disabled={profile.affiliate_earnings < 1} onClick={transfer}>Transfer to balance</Button>
      </div>
    </div>
  );
}

export function AccountPage() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp ?? '');
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [regen, setRegen] = useState(false);

  if (!profile) return <LoadingBlock />;

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim(), whatsapp: whatsapp.trim() }).eq('id', profile.id);
    setSaving(false);
    if (error) return toast(friendlyError(error), 'error');
    toast('Profile saved');
    refreshProfile();
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (pw.next.length < 6) return setPwError('Password must be at least 6 characters.');
    if (pw.next !== pw.confirm) return setPwError('Passwords do not match.');
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setPwSaving(false);
    if (error) return setPwError(friendlyError(error, 'Could not change your password.'));
    setPw({ next: '', confirm: '' });
    toast('Password changed');
  };

  const regenerate = async () => {
    if (!confirm('Generate a new API key? Your old key will stop working immediately.')) return;
    setRegen(true);
    const { error } = await supabase.rpc('regenerate_api_key');
    setRegen(false);
    if (error) return toast(friendlyError(error), 'error');
    toast('New API key generated');
    refreshProfile();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Account" subtitle="Manage your profile, password and API key." />
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveProfile} className="card space-y-4 p-5 sm:p-6">
          <p className="font-bold">Profile</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Username</label><input className="input opacity-70" value={profile.username} disabled /></div>
            <div><label className="label">Email</label><input className="input opacity-70" value={profile.email} disabled /></div>
          </div>
          <div><label className="label" htmlFor="fn">Full name</label><input id="fn" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} /></div>
          <div><label className="label" htmlFor="wa">WhatsApp number</label><input id="wa" className="input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={30} /></div>
          <Button type="submit" loading={saving} icon={Save}>Save profile</Button>
        </form>

        <form onSubmit={savePassword} className="card space-y-4 p-5 sm:p-6">
          <p className="font-bold">Change password</p>
          <div><label className="label" htmlFor="np">New password</label><input id="np" type="password" autoComplete="new-password" className="input" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required /></div>
          <div><label className="label" htmlFor="cp">Confirm new password</label><input id="cp" type="password" autoComplete="new-password" className="input" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></div>
          <ErrorNote message={pwError} />
          <Button type="submit" loading={pwSaving} icon={KeyRound}>Update password</Button>
        </form>
      </div>

      <div className="card space-y-3 p-5 sm:p-6">
        <p className="font-bold">API key</p>
        <p className="text-sm text-muted">Use this key to connect your own panel or tools. Keep it private.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <input readOnly className="input pr-11 font-mono text-sm" value={showKey ? profile.api_key : '•'.repeat(32)} />
            <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink" aria-label="Toggle key visibility">
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button variant="secondary" icon={Copy} onClick={() => { navigator.clipboard.writeText(profile.api_key); toast('API key copied'); }}>Copy</Button>
          <Button variant="secondary" icon={RefreshCw} loading={regen} onClick={regenerate}>Regenerate</Button>
        </div>
      </div>
    </div>
  );
}

export function PanelApiPage() {
  const { profile } = useAuth();
  return (
    <div>
      <PageHeader title="API" subtitle="Connect your own panel or scripts to our services." />
      <ApiDocs apiKey={profile?.api_key} />
    </div>
  );
}
