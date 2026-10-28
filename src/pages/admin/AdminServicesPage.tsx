import { useMemo, useState } from 'react';
import {
  Plus, Search, Percent, Pencil, Trash2, FolderOpen, List, Eye, EyeOff, FolderInput, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { Badge, Button, EmptyState, ErrorNote, LoadingBlock, Modal, PageHeader, Toggle } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { useAdminCatalog } from '@/hooks/useAdminCatalog';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import type { Category, Service } from '@/lib/types';
import { BulkPricingModal } from './BulkPricingModal';
import { CategoryEditor, ServiceEditor } from './ServiceEditor';

const PAGE = 100;

async function inChunks(ids: number[], run: (chunk: number[]) => PromiseLike<{ error: unknown }>) {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await run(ids.slice(i, i + 200));
    if (error) throw error;
  }
}

export function AdminServicesPage() {
  const { data: catalog, error, reload } = useAdminCatalog();
  const [tab, setTab] = useState<'services' | 'categories'>('services');

  if (error) return <ErrorNote message={error} />;
  if (!catalog) return <LoadingBlock />;

  return (
    <div>
      <PageHeader title="Services" subtitle={`${catalog.services.length.toLocaleString()} services in ${catalog.categories.length} categories`} />
      <div className="mb-5 inline-flex rounded-xl border border-line bg-surface p-1">
        {(['services', 'categories'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${tab === t ? 'bg-brand-600 text-white' : 'text-muted hover:text-ink'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'services' ? <ServicesTab catalog={catalog} reload={reload} /> : <CategoriesTab catalog={catalog} reload={reload} />}
    </div>
  );
}

type TabProps = { catalog: NonNullable<ReturnType<typeof useAdminCatalog>['data']>; reload: () => Promise<void> };

function ServicesTab({ catalog, reload }: TabProps) {
  const { money } = useApp();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [prov, setProv] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Service | null | undefined>(undefined);
  const [bulkPricing, setBulkPricing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);

  const catName = useMemo(() => Object.fromEntries(catalog.categories.map((c) => [c.id, c.name])), [catalog.categories]);
  const provName = useMemo(() => Object.fromEntries(catalog.providers.map((p) => [p.id, p.name])), [catalog.providers]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return catalog.services.filter((sv) => {
      if (cat && sv.category_id !== cat) return false;
      const src = catalog.sources[sv.id];
      if (prov === 'manual' && src) return false;
      if (prov && prov !== 'manual' && src?.provider_id !== prov) return false;
      if (s && !sv.name.toLowerCase().includes(s) && String(sv.id) !== s && src?.provider_service_id !== s) return false;
      return true;
    });
  }, [catalog, q, cat, prov]);

  const visible = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  const toggleOne = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const toggleAll = () => setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((s) => s.id)));

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      toast(label);
      await reload();
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const setActive = (ids: number[], active: boolean) =>
    run(active ? 'Services enabled' : 'Services disabled', () => inChunks(ids, (c) => supabase.from('services').update({ active }).in('id', c)));

  const removeSelected = () => {
    if (!confirm(`Delete ${selected.size} service(s)? Past orders are kept.`)) return;
    run('Services deleted', async () => {
      await inChunks([...selected], (c) => supabase.from('services').delete().in('id', c));
      setSelected(new Set());
    });
  };

  const moveTo = (categoryId: string) =>
    run('Services moved', async () => {
      await inChunks([...selected], (c) => supabase.from('services').update({ category_id: categoryId }).in('id', c));
      setMoving(false);
    });

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid gap-2 sm:grid-cols-3 xl:flex">
          <div className="relative xl:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input pl-10" placeholder="Search name or ID" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          </div>
          <select className="input xl:w-56" value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); }}>
            <option value="">All categories</option>
            {catalog.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input xl:w-48" value={prov} onChange={(e) => { setProv(e.target.value); setPage(0); }}>
            <option value="">All providers</option>
            <option value="manual">Manual only</option>
            {catalog.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={Percent} onClick={() => setBulkPricing(true)}>Bulk pricing</Button>
          <Button icon={Plus} onClick={() => setEditing(null)}>Add service</Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-4 flex animate-fade-up flex-wrap items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3">
          <span className="mr-2 text-sm font-semibold text-brand-700 dark:text-brand-400">{selected.size} selected</span>
          <Button size="sm" variant="secondary" icon={Eye} disabled={busy} onClick={() => setActive([...selected], true)}>Enable</Button>
          <Button size="sm" variant="secondary" icon={EyeOff} disabled={busy} onClick={() => setActive([...selected], false)}>Disable</Button>
          <Button size="sm" variant="secondary" icon={FolderInput} disabled={busy} onClick={() => setMoving(true)}>Move</Button>
          <Button size="sm" variant="secondary" icon={Percent} disabled={busy} onClick={() => setBulkPricing(true)}>Change price</Button>
          <Button size="sm" variant="danger" icon={Trash2} disabled={busy} onClick={removeSelected}>Delete</Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><X className="h-4 w-4" /> Clear</button>
        </div>
      )}

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={List} title="No services found" text="Add a service by hand or import from a provider on the Providers page." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-line bg-soft/50">
                  <th className="table-head w-10"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={allFilteredSelected} onChange={toggleAll} aria-label="Select all" /></th>
                  {['ID', 'Service', 'Category', 'Provider', 'Cost', 'Price', 'Profit', 'Min / Max', 'Active', ''].map((h) => <th key={h} className="table-head">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => {
                  const src = catalog.sources[s.id];
                  const profit = src ? s.rate - src.provider_rate : null;
                  return (
                    <tr key={s.id} className={`border-b border-line/60 transition last:border-0 hover:bg-soft/40 ${selected.has(s.id) ? 'bg-brand-500/5' : ''}`}>
                      <td className="table-cell"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} aria-label={`Select ${s.id}`} /></td>
                      <td className="table-cell font-semibold">{s.id}</td>
                      <td className="table-cell max-w-[280px]">
                        <span className="line-clamp-2">{s.name}</span>
                        <span className="mt-1 flex gap-1">
                          {s.refill && <Badge tone="bg-sky-500/10 text-sky-600 dark:text-sky-400">Refill</Badge>}
                          {s.cancel && <Badge tone="bg-amber-500/10 text-amber-600 dark:text-amber-400">Cancel</Badge>}
                        </span>
                      </td>
                      <td className="table-cell max-w-[160px] truncate text-muted">{catName[s.category_id] ?? '-'}</td>
                      <td className="table-cell text-muted">{src ? <>{provName[src.provider_id] ?? '-'} <span className="text-xs">#{src.provider_service_id}</span></> : 'Manual'}</td>
                      <td className="table-cell text-muted">{src ? money(src.provider_rate, 4) : '-'}</td>
                      <td className="table-cell font-semibold">{money(s.rate, 4)}</td>
                      <td className={`table-cell font-semibold ${profit === null ? 'text-muted' : profit < 0 ? 'text-red-600' : 'text-brand-600'}`}>{profit === null ? '-' : money(profit, 4)}</td>
                      <td className="table-cell whitespace-nowrap text-muted">{s.min_qty.toLocaleString()} / {s.max_qty.toLocaleString()}</td>
                      <td className="table-cell"><Toggle checked={s.active} onChange={(v) => setActive([s.id], v)} /></td>
                      <td className="table-cell">
                        <button onClick={() => setEditing(s)} className="rounded-lg p-2 text-muted transition hover:bg-soft hover:text-brand-600" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {filtered.length > PAGE && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
          <span className="text-muted">Page {page + 1} of {Math.ceil(filtered.length / PAGE)}</span>
          <Button size="sm" variant="secondary" icon={ChevronRight} disabled={(page + 1) * PAGE >= filtered.length} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      {editing !== undefined && <ServiceEditor service={editing} catalog={catalog} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); }} />}
      {bulkPricing && <BulkPricingModal open catalog={catalog} selected={selected} onClose={() => setBulkPricing(false)} onDone={() => { setBulkPricing(false); reload(); }} />}
      <Modal open={moving} onClose={() => setMoving(false)} title={`Move ${selected.size} service(s)`}>
        <div className="max-h-[60vh] space-y-1 overflow-y-auto">
          {catalog.categories.map((c) => (
            <button key={c.id} disabled={busy} onClick={() => moveTo(c.id)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-soft disabled:opacity-50">
              {c.name} <span className="text-xs font-normal text-muted">{c.platform}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function CategoriesTab({ catalog, reload }: TabProps) {
  const toast = useToast();
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    catalog.services.forEach((s) => { m[s.category_id] = (m[s.category_id] ?? 0) + 1; });
    return m;
  }, [catalog.services]);
  const nextOrder = Math.max(0, ...catalog.categories.map((c) => c.sort_order)) + 1;

  const remove = async (c: Category) => {
    const n = counts[c.id] ?? 0;
    if (!confirm(n ? `Delete "${c.name}" and its ${n} service(s)? Past orders are kept.` : `Delete "${c.name}"?`)) return;
    const { error } = await supabase.from('categories').delete().eq('id', c.id);
    if (error) return toast(friendlyError(error), 'error');
    toast('Category deleted');
    reload();
  };

  return (
    <div>
      <div className="mb-4 flex justify-end"><Button icon={Plus} onClick={() => setEditing(null)}>Add category</Button></div>
      <div className="card overflow-hidden">
        {catalog.categories.length === 0 ? (
          <EmptyState icon={FolderOpen} title="No categories yet" text="Categories group your services on the order page." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr className="border-b border-line bg-soft/50">{['Order', 'Name', 'Platform', 'Services', 'Visible', ''].map((h) => <th key={h} className="table-head">{h}</th>)}</tr></thead>
              <tbody>
                {catalog.categories.map((c) => (
                  <tr key={c.id} className="border-b border-line/60 transition last:border-0 hover:bg-soft/40">
                    <td className="table-cell text-muted">{c.sort_order}</td>
                    <td className="table-cell font-semibold">{c.name}</td>
                    <td className="table-cell text-muted">{c.platform}</td>
                    <td className="table-cell">{counts[c.id] ?? 0}</td>
                    <td className="table-cell">{c.active ? <Badge tone="bg-brand-500/10 text-brand-700 dark:text-brand-400">Visible</Badge> : <Badge>Hidden</Badge>}</td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditing(c)} className="rounded-lg p-2 text-muted transition hover:bg-soft hover:text-brand-600" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(c)} className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing !== undefined && <CategoryEditor category={editing} nextOrder={nextOrder} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); }} />}
    </div>
  );
}
