import { useMemo, useState } from 'react';
import { Calculator, Check, TrendingUp } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { roundTo } from '@/lib/format';
import type { AdminCatalog } from '@/hooks/useAdminCatalog';

type Scope = 'all' | 'provider' | 'category' | 'selected';
type Base = 'cost' | 'current';

export function BulkPricingModal({ open, onClose, catalog, selected, onDone }: {
  open: boolean; onClose: () => void; catalog: AdminCatalog; selected: Set<number>; onDone: () => void;
}) {
  const toast = useToast();
  const [scope, setScope] = useState<Scope>(selected.size ? 'selected' : 'all');
  const [providerId, setProviderId] = useState(catalog.providers[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(catalog.categories[0]?.id ?? '');
  const [base, setBase] = useState<Base>('cost');
  const [percent, setPercent] = useState('30');
  const [fixed, setFixed] = useState('0');
  const [minProfit, setMinProfit] = useState('0');
  const [decimals, setDecimals] = useState(4);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const pct = parseFloat(percent) || 0;
    const add = parseFloat(fixed) || 0;
    const floor = parseFloat(minProfit) || 0;
    return catalog.services
      .filter((s) => {
        if (scope === 'selected') return selected.has(s.id);
        if (scope === 'provider') return catalog.sources[s.id]?.provider_id === providerId;
        if (scope === 'category') return s.category_id === categoryId;
        return true;
      })
      .map((s) => {
        const cost = catalog.sources[s.id] ? Number(catalog.sources[s.id].provider_rate) : null;
        const from = base === 'cost' ? cost : Number(s.rate);
        if (from == null) return null;
        let next = from * (1 + pct / 100) + add;
        if (cost != null && next < cost + floor) next = cost + floor;
        next = Math.max(0, roundTo(next, decimals));
        return { id: s.id, name: s.name, cost, current: Number(s.rate), next };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [catalog, scope, selected, providerId, categoryId, base, percent, fixed, minProfit, decimals]);

  const changed = rows.filter((r) => r.next !== r.current);

  const apply = async () => {
    if (!changed.length) return;
    setBusy(true);
    try {
      for (let i = 0; i < changed.length; i += 500) {
        const chunk = changed.slice(i, i + 500).map((r) => ({ id: r.id, rate: r.next }));
        const { error } = await supabase.rpc('admin_bulk_set_rates', { p_items: chunk });
        if (error) throw error;
      }
      toast(`Updated prices for ${changed.length} services`);
      onDone();
      onClose();
    } catch (e) {
      toast(friendlyError(e, 'Could not update prices.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n: number | null) => (n == null ? '-' : `$${n.toFixed(4)}`);

  return (
    <Modal open={open} onClose={onClose} title="Bulk price update" wide>
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="label">Which services</label>
            <div className="grid grid-cols-2 gap-2">
              {([['all', 'All services'], ['provider', 'By provider'], ['category', 'By category'], ['selected', `Selected (${selected.size})`]] as const).map(([v, l]) => (
                <button key={v} type="button" disabled={v === 'selected' && !selected.size} onClick={() => setScope(v)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-40 ${scope === v ? 'border-brand-600 bg-brand-500/10 text-brand-700 dark:text-brand-400' : 'border-line text-muted hover:text-ink'}`}>{l}</button>
              ))}
            </div>
            {scope === 'provider' && (
              <select className="input" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                {catalog.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {scope === 'category' && (
              <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {catalog.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <label className="label pt-1">Start from</label>
            <div className="grid grid-cols-2 gap-2">
              {([['cost', 'Provider cost'], ['current', 'Current price']] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setBase(v)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${base === v ? 'border-brand-600 bg-brand-500/10 text-brand-700 dark:text-brand-400' : 'border-line text-muted hover:text-ink'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Increase by %</label><input type="number" step="0.1" className="input" value={percent} onChange={(e) => setPercent(e.target.value)} /></div>
            <div><label className="label">Plus fixed ($ / 1000)</label><input type="number" step="0.0001" className="input" value={fixed} onChange={(e) => setFixed(e.target.value)} /></div>
            <div><label className="label">Minimum profit ($ / 1000)</label><input type="number" step="0.0001" min="0" className="input" value={minProfit} onChange={(e) => setMinProfit(e.target.value)} /></div>
            <div>
              <label className="label">Round to</label>
              <select className="input" value={decimals} onChange={(e) => setDecimals(Number(e.target.value))}>
                <option value={2}>2 decimals ($0.01)</option>
                <option value={3}>3 decimals</option>
                <option value={4}>4 decimals</option>
              </select>
            </div>
            <p className="col-span-2 text-xs leading-relaxed text-muted">
              New price = {base === 'cost' ? 'provider cost' : 'current price'} + {percent || 0}% + ${fixed || 0}. Use a negative number to lower prices. Services without a provider are skipped when starting from cost.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-line">
          <div className="flex items-center justify-between bg-soft/60 px-4 py-2.5 text-sm">
            <span className="flex items-center gap-2 font-semibold"><Calculator className="h-4 w-4 text-brand-600" /> Preview</span>
            <span className="text-muted">{changed.length} of {rows.length} prices will change</span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface"><tr className="border-b border-line">{['ID', 'Service', 'Cost', 'Current', 'New', 'Profit'].map((h) => <th key={h} className="table-head">{h}</th>)}</tr></thead>
              <tbody>
                {rows.slice(0, 300).map((r) => {
                  const profit = r.cost == null ? null : r.next - r.cost;
                  return (
                    <tr key={r.id} className="border-b border-line/60 last:border-0">
                      <td className="table-cell">{r.id}</td>
                      <td className="table-cell max-w-[260px] truncate">{r.name}</td>
                      <td className="table-cell text-muted">{fmt(r.cost)}</td>
                      <td className="table-cell">{fmt(r.current)}</td>
                      <td className={`table-cell font-bold ${r.next > r.current ? 'text-brand-600' : r.next < r.current ? 'text-red-600' : ''}`}>{fmt(r.next)}</td>
                      <td className={`table-cell ${profit != null && profit < 0 ? 'font-semibold text-red-600' : 'text-muted'}`}>{fmt(profit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">No services match.</p>}
            {rows.length > 300 && <p className="px-4 py-3 text-center text-xs text-muted">Showing the first 300 of {rows.length}.</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button icon={changed.length ? TrendingUp : Check} loading={busy} disabled={!changed.length} onClick={apply}>Apply to {changed.length} services</Button>
        </div>
      </div>
    </Modal>
  );
}
