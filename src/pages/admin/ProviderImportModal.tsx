import { useEffect, useMemo, useState } from 'react';
import { Search, Download, AlertTriangle } from 'lucide-react';
import { Badge, Button, ErrorNote, LoadingBlock, Modal } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { callFunction, supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { guessPlatform, roundTo } from '@/lib/format';
import type { AdminCatalog } from '@/hooks/useAdminCatalog';
import type { Provider } from '@/lib/types';

type RemoteService = {
  service: string; name: string; category: string; type: string; rate: number;
  min: number; max: number; refill: boolean; cancel: boolean; description: string;
};

const SHOWN = 300;
const CHUNK = 200;

export function ProviderImportModal({ provider, catalog, onClose, onDone }: {
  provider: Provider; catalog: AdminCatalog; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [list, setList] = useState<RemoteService[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [remoteCat, setRemoteCat] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [markup, setMarkup] = useState('30');
  const [decimals, setDecimals] = useState(4);
  const [target, setTarget] = useState('auto');
  const [updateExisting, setUpdateExisting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    callFunction<{ services: RemoteService[] }>('provider', { action: 'services', provider_id: provider.id })
      .then((r) => {
        if (!Array.isArray(r?.services)) throw new Error('bad response');
        setList(r.services);
      })
      .catch((e) => setLoadError(friendlyError(e, 'Could not load services from this provider. Check the API URL and key.')));
  }, [provider.id]);

  const existing = useMemo(() => {
    const m = new Map<string, number>();
    Object.values(catalog.sources).forEach((s) => { if (s.provider_id === provider.id) m.set(s.provider_service_id, s.service_id); });
    return m;
  }, [catalog.sources, provider.id]);

  const remoteCats = useMemo(() => [...new Set((list ?? []).map((s) => s.category))].sort(), [list]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list ?? []).filter((r) => (!remoteCat || r.category === remoteCat) && (!s || r.name.toLowerCase().includes(s) || r.service === s));
  }, [list, q, remoteCat]);

  const pct = parseFloat(markup) || 0;
  const priceFor = (cost: number) => (cost > 0 ? Math.max(roundTo(cost * (1 + pct / 100), decimals), 10 ** -decimals) : 0);

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.service));
  const toggleAll = () => {
    const next = new Set(selected);
    filtered.forEach((r) => (allSelected ? next.delete(r.service) : next.add(r.service)));
    setSelected(next);
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const picks = (list ?? []).filter((r) => selected.has(r.service));
  const newCount = picks.filter((r) => !existing.has(r.service)).length;
  const oldCount = picks.length - newCount;

  const run = async () => {
    setBusy(true);
    try {
      const fresh = picks.filter((r) => !existing.has(r.service));
      const old = picks.filter((r) => existing.has(r.service));

      if (updateExisting && old.length) {
        setProgress('Updating costs...');
        for (let i = 0; i < old.length; i += CHUNK) {
          const rows = old.slice(i, i + CHUNK).map((r) => ({
            service_id: existing.get(r.service)!, provider_id: provider.id, provider_service_id: r.service, provider_rate: r.rate,
          }));
          const { error } = await supabase.from('service_sources').upsert(rows);
          if (error) throw error;
        }
      }

      const catIds = new Map<string, string>();
      if (target === 'auto') {
        catalog.categories.forEach((c) => catIds.set(c.name.trim().toLowerCase(), c.id));
        const missing = [...new Set(fresh.map((r) => r.category.trim()))].filter((n) => !catIds.has(n.toLowerCase()));
        if (missing.length) {
          setProgress('Creating categories...');
          let order = Math.max(0, ...catalog.categories.map((c) => c.sort_order));
          const { data, error } = await supabase.from('categories')
            .insert(missing.map((name) => ({ name, platform: guessPlatform(` ${name} `), sort_order: ++order, active: true })))
            .select('id, name');
          if (error || !data) throw error;
          data.forEach((c) => catIds.set(String(c.name).trim().toLowerCase(), c.id as string));
        }
      }

      for (let i = 0; i < fresh.length; i += CHUNK) {
        setProgress(`Importing ${Math.min(i + CHUNK, fresh.length)} of ${fresh.length}...`);
        const chunk = fresh.slice(i, i + CHUNK);
        const { data, error } = await supabase.from('services').insert(chunk.map((r) => ({
          name: r.name.slice(0, 500), description: (r.description ?? '').slice(0, 5000), type: r.type || 'Default',
          category_id: target === 'auto' ? catIds.get(r.category.trim().toLowerCase())! : target,
          rate: priceFor(r.rate), min_qty: Math.max(1, r.min), max_qty: Math.max(r.min, r.max),
          refill: r.refill, cancel: r.cancel, active: true,
        }))).select('id');
        if (error || !data || data.length !== chunk.length) throw error ?? new Error('Import mismatch');
        const { error: srcErr } = await supabase.from('service_sources').insert(data.map((d, idx) => ({
          service_id: d.id as number, provider_id: provider.id, provider_service_id: chunk[idx].service, provider_rate: chunk[idx].rate,
        })));
        if (srcErr) throw srcErr;
      }

      toast(`Imported ${fresh.length} new service(s)${updateExisting && old.length ? `, updated ${old.length}` : ''}`);
      onDone();
    } catch (e) {
      toast(friendlyError(e, 'Import stopped part way. Anything already imported has been kept.'), 'error');
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <Modal open onClose={busy ? () => undefined : onClose} title={`Import from ${provider.name}`} wide>
      {loadError ? <ErrorNote message={loadError} /> : !list ? <LoadingBlock /> : (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className="input pl-10" placeholder={`Search ${list.length.toLocaleString()} services`} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="input" value={remoteCat} onChange={(e) => setRemoteCat(e.target.value)}>
              <option value="">All provider categories ({remoteCats.length})</option>
              {remoteCats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="max-h-[42vh] overflow-auto rounded-xl border border-line">
            <table className="w-full min-w-[720px]">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-line">
                  <th className="table-head w-10"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={allSelected} onChange={toggleAll} aria-label="Select all shown" /></th>
                  {['ID', 'Service', 'Cost', 'Your price', 'Min / Max', ''].map((h) => <th key={h} className="table-head">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, SHOWN).map((r) => (
                  <tr key={r.service} onClick={() => toggle(r.service)} className={`cursor-pointer border-b border-line/60 transition last:border-0 hover:bg-soft/40 ${selected.has(r.service) ? 'bg-brand-500/5' : ''}`}>
                    <td className="table-cell"><input type="checkbox" readOnly className="pointer-events-none h-4 w-4 accent-brand-600" checked={selected.has(r.service)} /></td>
                    <td className="table-cell font-semibold">{r.service}</td>
                    <td className="table-cell max-w-[300px]"><span className="line-clamp-2">{r.name}</span><span className="text-xs text-muted">{r.category}</span></td>
                    <td className="table-cell text-muted">{r.rate}</td>
                    <td className="table-cell font-semibold text-brand-600">{priceFor(r.rate)}</td>
                    <td className="table-cell whitespace-nowrap text-muted">{r.min.toLocaleString()} / {r.max.toLocaleString()}</td>
                    <td className="table-cell">{existing.has(r.service) && <Badge>Imported</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > SHOWN && <p className="p-3 text-center text-xs text-muted">Showing {SHOWN} of {filtered.length.toLocaleString()}. Use search to narrow, or the top checkbox to select all {filtered.length.toLocaleString()} matches.</p>}
            {filtered.length === 0 && <p className="p-6 text-center text-sm text-muted">No services match.</p>}
          </div>

          <div className="grid gap-4 rounded-xl border border-line p-4 sm:grid-cols-3">
            <div>
              <label className="label">Markup (%)</label>
              <input type="number" step="0.1" className="input" value={markup} onChange={(e) => setMarkup(e.target.value)} />
            </div>
            <div>
              <label className="label">Round to</label>
              <select className="input" value={decimals} onChange={(e) => setDecimals(Number(e.target.value))}>
                {[2, 3, 4].map((d) => <option key={d} value={d}>{d} decimals</option>)}
              </select>
            </div>
            <div>
              <label className="label">Put new services in</label>
              <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="auto">Matching category (create if needed)</option>
                {catalog.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-3">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
              Update the cost of services I already imported (their selling price stays the same)
            </label>
          </div>

          {provider.currency && provider.currency !== 'USD' && (
            <p className="flex items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" /> This provider bills in {provider.currency}. Prices here are in {provider.currency}, so adjust the markup to cover the exchange rate.
            </p>
          )}

          <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {picks.length === 0 ? 'Select the services you want to sell.' : <><span className="font-semibold text-ink">{newCount}</span> new{oldCount > 0 && <>, <span className="font-semibold text-ink">{oldCount}</span> already imported</>}</>}
              {progress && <span className="ml-2 font-semibold text-brand-600">{progress}</span>}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button icon={Download} loading={busy} disabled={newCount === 0 && !(updateExisting && oldCount > 0)} onClick={run}>Import selected</Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
