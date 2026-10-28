import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Wallet, Copy, Smartphone, CreditCard, History } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorNote, LoadingBlock, PageHeader } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { Payment } from '@/lib/types';

const PAY_STATUS: Record<Payment['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  approved: 'bg-brand-500/10 text-brand-700 dark:text-brand-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const METHOD_LABEL: Record<Payment['method'], string> = {
  bkash: 'bKash', stripe: 'Card', admin: 'Admin adjustment', affiliate: 'Affiliate transfer',
};

export function AddFundsPage() {
  const { settings, money } = useApp();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [trx, setTrx] = useState('');
  const [sender, setSender] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Payment[] | null>(null);

  const rate = settings?.usd_to_bdt ?? 125;
  const bdt = parseFloat(amount) || 0;

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(100);
    if (err) console.error(err);
    setHistory((data as Payment[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.rpc('submit_bkash_payment', { p_amount_bdt: bdt, p_trx: trx, p_sender: sender });
    setLoading(false);
    if (err) return setError(friendlyError(err, 'Could not submit your payment.'));
    toast('Payment submitted. Your balance will be updated after verification.');
    setAmount('');
    setTrx('');
    setSender('');
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Add Balance" subtitle="Top up your account to start ordering." />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="card p-5 sm:p-6 lg:col-span-3">
          <div className="mb-5 flex gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl bg-[#e2136e] px-4 py-2 text-sm font-bold text-white"><Smartphone className="h-4 w-4" /> bKash</span>
            <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-muted" title="Coming soon"><CreditCard className="h-4 w-4" /> Card (soon)</span>
          </div>
          {!settings?.bkash_number ? (
            <EmptyState icon={Wallet} title="Payments are being set up" text="Please contact support to add funds for now." />
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label" htmlFor="amt">Amount (BDT)</label>
                <input id="amt" type="number" min="0" step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                <p className="mt-1.5 text-xs text-muted">
                  You will receive <span className="font-bold text-ink">${(bdt / rate).toFixed(4)}</span> · Rate: 1 USD = ৳{rate} · Minimum ${settings.min_deposit_usd}
                </p>
              </div>
              <div>
                <label className="label" htmlFor="sender">Your bKash number</label>
                <input id="sender" className="input" placeholder="01XXXXXXXXX" value={sender} onChange={(e) => setSender(e.target.value)} required />
              </div>
              <div>
                <label className="label" htmlFor="trx">Transaction ID</label>
                <input id="trx" className="input uppercase" placeholder="e.g. 9A7B6C5D4E" value={trx} onChange={(e) => setTrx(e.target.value)} required />
              </div>
              <ErrorNote message={error} />
              <Button type="submit" loading={loading} icon={Wallet} size="lg" className="w-full">Submit payment</Button>
            </form>
          )}
        </div>

        <div className="card h-fit space-y-4 p-5 sm:p-6 lg:col-span-2">
          <p className="font-bold">How to pay with bKash</p>
          {settings?.bkash_number && (
            <div className="rounded-xl bg-[#e2136e]/10 p-4">
              <p className="text-xs font-semibold uppercase text-[#e2136e]">{settings.bkash_account_type} number</p>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-xl font-extrabold tracking-wide">{settings.bkash_number}</p>
                <button onClick={() => { navigator.clipboard.writeText(settings.bkash_number); toast('Number copied'); }} className="rounded-lg p-2 text-muted hover:bg-white/50" aria-label="Copy number">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          <ol className="space-y-2.5 text-sm text-muted">
            {[
              `Open your bKash app and choose "${settings?.bkash_account_type === 'Merchant' ? 'Payment' : 'Send Money'}".`,
              'Enter the number above and the amount you want to add.',
              'Complete the payment and copy the Transaction ID.',
              'Fill in the form with the amount, your number and the Transaction ID.',
              'Your balance is added as soon as we verify the payment.',
            ].map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-xs font-bold text-brand-700 dark:text-brand-400">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4 font-bold"><History className="h-4 w-4 text-brand-600" /> Payment history</div>
        {history === null ? <LoadingBlock /> : history.length === 0 ? (
          <EmptyState icon={History} title="No payments yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr className="border-b border-line bg-soft/50">{['Date', 'Method', 'Amount', 'Transaction', 'Status', 'Note'].map((h) => <th key={h} className="table-head">{h}</th>)}</tr></thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id} className="border-b border-line/60 last:border-0">
                    <td className="table-cell whitespace-nowrap text-muted">{formatDate(p.created_at)}</td>
                    <td className="table-cell">{METHOD_LABEL[p.method]}</td>
                    <td className="table-cell font-semibold">{money(p.amount_usd)}{p.amount_bdt ? <span className="ml-1 text-xs text-muted">(৳{p.amount_bdt})</span> : null}</td>
                    <td className="table-cell font-mono text-xs">{p.trx_id ?? '-'}</td>
                    <td className="table-cell"><Badge tone={PAY_STATUS[p.status]}>{p.status}</Badge></td>
                    <td className="table-cell text-muted">{p.note || '-'}</td>
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
