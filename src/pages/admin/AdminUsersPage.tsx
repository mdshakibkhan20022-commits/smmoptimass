import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Search, Users, Wallet, Ban, ShieldCheck, UserCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorNote, LoadingBlock, Modal, PageHeader } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { formatDate, tierFor } from '@/lib/format';
import type { Profile } from '@/lib/types';

const PAGE = 50;

export function AdminUsersPage() {
  const { money } = useApp();
  const { profile: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    let query = supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    const s = search.trim().replace(/[,%()]/g, '');
    if (s) query = query.or(`username.ilike.%${s}%,email.ilike.%${s}%,whatsapp.ilike.%${s}%`);
    const { data, count, error } = await query.range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) console.error(error);
    setUsers((data as Profile[]) ?? []);
    setTotal(count ?? 0);
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const updateUser = async (u: Profile, status: string, role: string) => {
    const { error } = await supabase.rpc('admin_update_user', { p_user: u.id, p_status: status, p_role: role });
    if (error) return toast(friendlyError(error), 'error');
    toast('User updated');
    setSelected({ ...u, status: status as Profile['status'], role: role as Profile['role'] });
    load();
  };

  return (
    <div>
      <PageHeader title="Users" subtitle={`${total.toLocaleString()} registered accounts`} />
      <form onSubmit={(e) => { e.preventDefault(); setPage(0); setSearch(q); }} className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input className="input pl-10" placeholder="Search username, email or WhatsApp, then press Enter" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <div className="card overflow-hidden">
        {users === null ? <LoadingBlock /> : users.length === 0 ? <EmptyState icon={Users} title="No users found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead><tr className="border-b border-line bg-soft/50">{['User', 'Balance', 'Spent', 'Tier', 'Status', 'Joined'].map((h) => <th key={h} className="table-head">{h}</th>)}</tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} onClick={() => setSelected(u)} className="cursor-pointer border-b border-line/60 transition last:border-0 hover:bg-soft/40">
                    <td className="table-cell">
                      <p className="font-semibold">{u.username} {u.role === 'admin' && <Badge tone="bg-ink text-canvas">admin</Badge>}</p>
                      <p className="text-xs text-muted">{u.email}</p>
                    </td>
                    <td className="table-cell font-semibold">{money(u.balance)}</td>
                    <td className="table-cell">{money(u.total_spent)}</td>
                    <td className="table-cell">{tierFor(u.total_spent).tier.name}</td>
                    <td className="table-cell"><Badge tone={u.status === 'active' ? 'bg-brand-500/10 text-brand-700 dark:text-brand-400' : 'bg-red-500/10 text-red-600'}>{u.status}</Badge></td>
                    <td className="table-cell whitespace-nowrap text-muted">{formatDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {total > PAGE && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
          <span className="text-muted">Page {page + 1} of {Math.ceil(total / PAGE)}</span>
          <Button size="sm" variant="secondary" icon={ChevronRight} disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `User: ${selected.username}` : ''}>
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Email', selected.email],
                ['WhatsApp', selected.whatsapp || '-'],
                ['Balance', money(selected.balance)],
                ['Total spent', money(selected.total_spent)],
                ['Affiliate earnings', money(selected.affiliate_earnings)],
                ['Joined', formatDate(selected.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-soft/60 p-3">
                  <p className="text-xs text-muted">{k}</p>
                  <p className="truncate font-semibold">{v}</p>
                </div>
              ))}
            </div>
            <BalanceForm user={selected} onDone={(amount) => { setSelected({ ...selected, balance: selected.balance + amount }); load(); }} />
            {selected.id !== me?.id && (
              <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                {selected.status === 'active'
                  ? <Button variant="danger" icon={Ban} onClick={() => updateUser(selected, 'banned', selected.role)}>Ban user</Button>
                  : <Button variant="secondary" icon={UserCheck} onClick={() => updateUser(selected, 'active', selected.role)}>Unban user</Button>}
                {selected.role === 'user'
                  ? <Button variant="secondary" icon={ShieldCheck} onClick={() => confirm('Give this user full admin access?') && updateUser(selected, selected.status, 'admin')}>Make admin</Button>
                  : <Button variant="secondary" icon={Users} onClick={() => updateUser(selected, selected.status, 'user')}>Remove admin</Button>}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function BalanceForm({ user, onDone }: { user: Profile; onDone: (amount: number) => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!value) return setError('Enter a positive amount to add or a negative amount to remove.');
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.rpc('admin_adjust_balance', { p_user: user.id, p_amount: value, p_note: note.trim() });
    setBusy(false);
    if (err) return setError(friendlyError(err));
    toast('Balance updated');
    setAmount('');
    setNote('');
    onDone(value);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm font-bold">Adjust balance (USD)</p>
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <input type="number" step="0.0001" className="input" placeholder="e.g. 10 or -5" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className="input" placeholder="Reason (shown to the user)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <ErrorNote message={error} />
      <Button type="submit" loading={busy} icon={Wallet} size="sm">Apply</Button>
    </form>
  );
}
