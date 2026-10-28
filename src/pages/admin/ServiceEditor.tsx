import { useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { Button, ErrorNote, Modal, Toggle } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { PLATFORMS } from '@/lib/format';
import type { AdminCatalog } from '@/hooks/useAdminCatalog';
import type { Category, Service } from '@/lib/types';

const TYPES = ['Default', 'Package', 'Custom Comments', 'Subscriptions'];

export function ServiceEditor({ service, catalog, onClose, onSaved }: {
  service: Service | null; catalog: AdminCatalog; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const src = service ? catalog.sources[service.id] : undefined;
  const [f, setF] = useState({
    name: service?.name ?? '',
    category_id: service?.category_id ?? catalog.categories[0]?.id ?? '',
    description: service?.description ?? '',
    type: service?.type ?? 'Default',
    rate: service?.rate?.toString() ?? '',
    min_qty: service?.min_qty?.toString() ?? '100',
    max_qty: service?.max_qty?.toString() ?? '10000',
    avg_time: service?.avg_time ?? '',
    refill: service?.refill ?? false,
    cancel: service?.cancel ?? false,
    active: service?.active ?? true,
    provider_id: src?.provider_id ?? '',
    provider_service_id: src?.provider_service_id ?? '',
    provider_rate: src?.provider_rate?.toString() ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!f.category_id) return setError('Create a category first.');
    if (Number(f.min_qty) < 1 || Number(f.max_qty) < Number(f.min_qty)) return setError('Max must be at least the min quantity.');
    if (f.provider_id && !f.provider_service_id.trim()) return setError('Enter the provider service ID.');
    setBusy(true);
    const row = {
      name: f.name.trim(), category_id: f.category_id, description: f.description.trim(), type: f.type,
      rate: Number(f.rate), min_qty: Number(f.min_qty), max_qty: Number(f.max_qty), avg_time: f.avg_time.trim(),
      refill: f.refill, cancel: f.cancel, active: f.active,
    };
    try {
      let id = service?.id;
      if (id) {
        const { error: err } = await supabase.from('services').update(row).eq('id', id);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.from('services').insert(row).select('id').single();
        if (err || !data) throw err;
        id = data.id as number;
      }
      if (f.provider_id) {
        const { error: err } = await supabase.from('service_sources').upsert({
          service_id: id, provider_id: f.provider_id, provider_service_id: f.provider_service_id.trim(), provider_rate: Number(f.provider_rate) || 0,
        });
        if (err) throw err;
      } else if (src) {
        const { error: err } = await supabase.from('service_sources').delete().eq('service_id', id);
        if (err) throw err;
      }
      toast(service ? 'Service saved' : 'Service created');
      onSaved();
    } catch (err) {
      setError(friendlyError(err, 'Could not save the service.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={service ? `Edit service #${service.id}` : 'New service'} wide>
      <form onSubmit={save} className="space-y-4">
        <div><label className="label">Name</label><input className="input" value={f.name} onChange={set('name')} required /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Category</label>
            <select className="input" value={f.category_id} onChange={set('category_id')}>
              {catalog.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={f.type} onChange={set('type')}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <div><label className="label">Price / 1000 ($)</label><input type="number" step="0.0001" min="0" className="input" value={f.rate} onChange={set('rate')} required /></div>
          <div><label className="label">Min</label><input type="number" min="1" className="input" value={f.min_qty} onChange={set('min_qty')} required /></div>
          <div><label className="label">Max</label><input type="number" min="1" className="input" value={f.max_qty} onChange={set('max_qty')} required /></div>
          <div><label className="label">Avg. time</label><input className="input" placeholder="e.g. 1 hour" value={f.avg_time} onChange={set('avg_time')} /></div>
        </div>
        <div><label className="label">Description</label><textarea rows={3} className="input" value={f.description} onChange={set('description')} /></div>
        <div className="flex flex-wrap gap-6">
          <Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Active" />
          <Toggle checked={f.refill} onChange={(v) => setF({ ...f, refill: v })} label="Refill" />
          <Toggle checked={f.cancel} onChange={(v) => setF({ ...f, cancel: v })} label="Cancel" />
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="mb-3 text-sm font-bold">Provider (optional)</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Provider</label>
              <select className="input" value={f.provider_id} onChange={set('provider_id')}>
                <option value="">Manual (no provider)</option>
                {catalog.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="label">Provider service ID</label><input className="input" value={f.provider_service_id} onChange={set('provider_service_id')} disabled={!f.provider_id} /></div>
            <div><label className="label">Provider cost / 1000</label><input type="number" step="0.0001" min="0" className="input" value={f.provider_rate} onChange={set('provider_rate')} disabled={!f.provider_id} /></div>
          </div>
        </div>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} icon={Save}>Save service</Button>
        </div>
      </form>
    </Modal>
  );
}

export function CategoryEditor({ category, nextOrder, onClose, onSaved }: {
  category: Category | null; nextOrder: number; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(category?.name ?? '');
  const [platform, setPlatform] = useState(category?.platform ?? 'Instagram');
  const [sort, setSort] = useState(String(category?.sort_order ?? nextOrder));
  const [active, setActive] = useState(category?.active ?? true);
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const row = { name: name.trim(), platform, sort_order: Number(sort) || 0, active };
    const { error } = category
      ? await supabase.from('categories').update(row).eq('id', category.id)
      : await supabase.from('categories').insert(row);
    setBusy(false);
    if (error) return toast(friendlyError(error), 'error');
    toast('Category saved');
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={category ? 'Edit category' : 'New category'}>
      <form onSubmit={save} className="space-y-4">
        <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Platform</label>
            <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value)}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select>
          </div>
          <div><label className="label">Sort order</label><input type="number" className="input" value={sort} onChange={(e) => setSort(e.target.value)} /></div>
        </div>
        <Toggle checked={active} onChange={setActive} label="Visible to customers" />
        <div className="flex justify-end"><Button type="submit" loading={busy} icon={Save}>Save</Button></div>
      </form>
    </Modal>
  );
}
