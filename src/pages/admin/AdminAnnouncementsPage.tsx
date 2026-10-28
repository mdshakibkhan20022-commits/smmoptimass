import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Megaphone, Plus, Pencil, Trash2, Save } from 'lucide-react';
import { Badge, Button, EmptyState, LoadingBlock, Modal, PageHeader, Toggle } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { Announcement } from '@/lib/types';
import { KIND_META } from '@/pages/panel/DashboardPage';

export function AdminAnnouncementsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [editing, setEditing] = useState<Announcement | null | undefined>(undefined);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (error) console.error(error);
    setItems((data as Announcement[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (a: Announcement) => {
    if (!confirm(`Delete "${a.title}"?`)) return;
    const { error } = await supabase.from('announcements').delete().eq('id', a.id);
    if (error) return toast(friendlyError(error), 'error');
    toast('Announcement deleted');
    load();
  };

  return (
    <div>
      <PageHeader title="Announcements" subtitle="Posts appear on the customer Updates page." action={<Button icon={Plus} onClick={() => setEditing(null)}>New post</Button>} />
      {items === null ? <LoadingBlock /> : items.length === 0 ? (
        <div className="card"><EmptyState icon={Megaphone} title="No posts yet" text="Tell customers about new services, price changes and news." /></div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const meta = KIND_META[a.kind];
            const Icon = meta.icon;
            return (
              <div key={a.id} className="card flex items-start gap-4 p-5">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}><Icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">{a.title}</h2>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {!a.published && <Badge>Draft</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{formatDate(a.created_at)}</p>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted">{a.body}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => setEditing(a)} className="rounded-lg p-2 text-muted transition hover:bg-soft hover:text-brand-600" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(a)} className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing !== undefined && <AnnouncementEditor item={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />}
    </div>
  );
}

function AnnouncementEditor({ item, onClose, onSaved }: { item: Announcement | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(item?.title ?? '');
  const [body, setBody] = useState(item?.body ?? '');
  const [kind, setKind] = useState<Announcement['kind']>(item?.kind ?? 'update');
  const [published, setPublished] = useState(item?.published ?? true);
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const row = { title: title.trim(), body: body.trim(), kind, published };
    const { error } = item
      ? await supabase.from('announcements').update(row).eq('id', item.id)
      : await supabase.from('announcements').insert(row);
    setBusy(false);
    if (error) return toast(friendlyError(error), 'error');
    toast(published ? 'Post published' : 'Draft saved');
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={item ? 'Edit post' : 'New post'}>
      <form onSubmit={save} className="space-y-4">
        <div><label className="label">Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
        <div>
          <label className="label">Type</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(KIND_META) as Announcement['kind'][]).map((k) => (
              <button type="button" key={k} onClick={() => setKind(k)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${kind === k ? 'border-brand-600 bg-brand-500/10 text-brand-700 dark:text-brand-400' : 'border-line text-muted hover:text-ink'}`}>
                {KIND_META[k].label}
              </button>
            ))}
          </div>
        </div>
        <div><label className="label">Message</label><textarea rows={6} className="input" value={body} onChange={(e) => setBody(e.target.value)} required /></div>
        <Toggle checked={published} onChange={setPublished} label="Visible to customers" />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} icon={Save}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}
