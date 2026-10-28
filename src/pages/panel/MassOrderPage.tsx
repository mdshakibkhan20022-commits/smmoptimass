import { useState } from 'react';
import { Layers, CheckCircle2, XCircle } from 'lucide-react';
import { Button, PageHeader } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { callFunction, supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';

type Result = { line: number; ok: boolean; text: string };

export function MassOrderPage() {
  const { refreshProfile } = useAuth();
  const toast = useToast();
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  const submit = async () => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 100);
    if (!lines.length) return;
    setRunning(true);
    const out: Result[] = [];
    for (const [i, line] of lines.entries()) {
      const parts = line.split('|').map((p) => p.trim());
      const [sid, link, qty] = parts;
      if (parts.length !== 3 || !Number(sid) || !link || !Number(qty)) {
        out.push({ line: i + 1, ok: false, text: 'Wrong format. Use: service_id | link | quantity' });
        continue;
      }
      const { data, error } = await supabase.rpc('place_order', { p_service: Number(sid), p_link: link, p_quantity: Number(qty) });
      if (error) {
        out.push({ line: i + 1, ok: false, text: friendlyError(error, 'Could not place this order.') });
      } else {
        callFunction('provider', { action: 'submit', order_id: data }).catch((x) => console.error(x));
        out.push({ line: i + 1, ok: true, text: `Order #${data} created` });
      }
      setResults([...out]);
    }
    setRunning(false);
    await refreshProfile();
    const ok = out.filter((r) => r.ok).length;
    toast(`${ok} of ${out.length} orders placed`, ok ? 'success' : 'error');
  };

  return (
    <div>
      <PageHeader title="Mass Order" subtitle="Place up to 100 orders at once. One order per line." />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="card space-y-4 p-5 sm:p-6 lg:col-span-3">
          <label className="label" htmlFor="mass">Orders</label>
          <textarea id="mass" rows={12} className="input font-mono" placeholder={'service_id | link | quantity\n1001 | https://instagram.com/user | 1000'}
            value={text} onChange={(e) => setText(e.target.value)} />
          <Button onClick={submit} loading={running} icon={Layers} size="lg" className="w-full">Submit orders</Button>
        </div>
        <div className="card h-fit p-5 sm:p-6 lg:col-span-2">
          <p className="font-bold">Results</p>
          {results.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Each line follows the format <code className="rounded bg-soft px-1.5 py-0.5">service_id | link | quantity</code>. You can find service IDs on the Services page.</p>
          ) : (
            <ul className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
              {results.map((r) => (
                <li key={r.line} className="flex items-start gap-2 text-sm">
                  {r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
                  <span><span className="font-semibold">Line {r.line}:</span> {r.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
