import { useState, type FormEvent } from 'react';
import { Plus, Server, Pencil, Trash2, Plug, Download, Save, KeyRound, Globe } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorNote, LoadingBlock, Modal, PageHeader, Toggle } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAdminCatalog } from '@/hooks/useAdminCatalog';
import { callFunction, supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import type { Provider } from '@/lib/types';
import { ProviderImportModal } from './ProviderImportModal';

const PRESETS = [
  { name: 'SMMFastBoost', api_url: 'https://smmfastboost.com/api/v2' },
  { name: 'SMMFollows', api_url: 'https://smmfollows.com/api/v2' },
  { name: 'Peakerr', api_url: 'https://peakerr.com/api/v2' },
];

export function AdminProvidersPage() {
  const { data: catalog, error, reload } = useAdminCatalog();
  const toast = useToast();
  const [editing, setEditing] = useState<Provider | null | undefined>(undefined);
  const [importing, setImporting] = useState<Provider | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  if (error) return <ErrorNote message={error} />;
  if (!catalog) return <LoadingBlock />;

  const counts: Record<string, number> = {};
  Object.values(catalog.sources).forEach((s) => { counts[s.provider_id] = (counts[s.provider_id] ?? 0) + 1; });

  const test = async (p: Provider) => {
    setTesting(p.id);
    try {
      const r = await callFunction<{ balance: number; currency: string }>('provider', { action: 'test', provider_id: p.id });
      toast(`Connected. Balance: ${r.balance} ${r.currency}`);
      reload();
    } catch (e) {
      toast(friendlyError(e, 'Could not connect to this provider.'), 'error');
    } finally {
      setTesting(null);
    }
  };

  const remove = async (p: Provider) => {
    const n = counts[p.id] ?? 0;
    if (!confirm(n ? `Delete ${p.name}? Its ${n} linked service(s) will become manual services.` : `Delete ${p.name}?`)) return;
    const { error: err } = await supabase.from('providers').delete().eq('id', p.id);
    if (err) return toast(friendlyError(err), 'error');
    toast('Provider deleted');
    reload();
  };

  return (
    <div>
      <PageHeader title="Providers" subtitle="Connect provider panels, check balances and import their services." action={<Button icon={Plus} onClick={() => setEditing(null)}>Add provider</Button>} />
      {catalog.providers.length === 0 ? (
        <div className="card"><EmptyState icon={Server} title="No providers yet" text="Add SMMFastBoost, SMMFollows, Peakerr or any panel that uses API v2." action={<Button icon={Plus} onClick={() => setEditing(null)}>Add provider</Button>} /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalog.providers.map((p) => (
            <div key={p.id} className="card flex flex-col p-5 transition hover:shadow-lift">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600"><Server className="h-5 w-5" /></div>
                  <div>
                    <p className="font-bold">{p.name}</p>
                    <p className="max-w-[200px] truncate text-xs text-muted">{p.api_url}</p>
                  </div>
                </div>
                {p.active ? <Badge tone="bg-brand-500/10 text-brand-700 dark:text-brand-400">Active</Badge> : <Badge>Paused</Badge>}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-soft/60 p-3">
                  <p className="text-xs text-muted">Balance</p>
                  <p className="font-bold">{p.balance == null ? 'Not checked' : `${Number(p.balance).toFixed(2)} ${p.currency}`}</p>
                </div>
                <div className="rounded-xl bg-soft/60 p-3">
                  <p className="text-xs text-muted">Linked services</p>
                  <p className="font-bold">{(counts[p.id] ?? 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                <Button size="sm" icon={Download} onClick={() => setImporting(p)}>Import services</Button>
                <Button size="sm" variant="secondary" icon={Plug} loading={testing === p.id} onClick={() => test(p)}>Test</Button>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => setEditing(p)} className="rounded-lg p-2 text-muted transition hover:bg-soft hover:text-brand-600" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(p)} className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== undefined && <ProviderEditor provider={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); reload(); }} />}
      {importing && <ProviderImportModal provider={importing} catalog={catalog} onClose={() => setImporting(null)} onDone={() => { setImporting(null); reload(); }} />}
    </div>
  );
}

function ProviderEditor({ provider, onClose, onSaved }: { provider: Provider | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(provider?.name ?? '');
  const [url, setUrl] = useState(provider?.api_url ?? '');
  const [key, setKey] = useState(provider?.api_key ?? '');
  const [active, setActive] = useState(provider?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^https:\/\/[^\s]+$/i.test(url.trim())) return setError('The API URL must start with https://');
    setBusy(true);
    const row = { name: name.trim(), api_url: url.trim(), api_key: key.trim(), active };
    const { error: err } = provider
      ? await supabase.from('providers').update(row).eq('id', provider.id)
      : await supabase.from('providers').insert(row);
    setBusy(false);
    if (err) return setError(friendlyError(err, 'Could not save the provider.'));
    toast('Provider saved');
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={provider ? `Edit ${provider.name}` : 'Add provider'}>
      <form onSubmit={save} className="space-y-4">
        {!provider && (
          <div>
            <label className="label">Quick setup</label>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <button type="button" key={p.name} onClick={() => { setName(p.name); setUrl(p.api_url); }}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${url === p.api_url ? 'border-brand-600 bg-brand-500/10 text-brand-700 dark:text-brand-400' : 'border-line hover:border-brand-500/50'}`}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Peakerr" required /></div>
        <div>
          <label className="label">API URL</label>
          <div className="relative">
            <Globe className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input pl-10" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/api/v2" required />
          </div>
        </div>
        <div>
          <label className="label">API key</label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input pl-10 font-mono" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste the key from the provider's API page" required />
          </div>
          <p className="mt-1.5 text-xs text-muted">Find it on the provider's site under Account or API.</p>
        </div>
        <Toggle checked={active} onChange={setActive} label="Send orders to this provider" />
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} icon={Save}>Save provider</Button>
        </div>
      </form>
    </Modal>
  );
}
