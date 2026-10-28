import { useMemo, useState } from 'react';
import { Search, RefreshCcw, XCircle, Layers } from 'lucide-react';
import { useCatalog } from '@/hooks/useCatalog';
import { useApp } from '@/context/AppContext';
import { Badge, EmptyState, ErrorNote, LoadingBlock } from '@/components/ui';
import { navigate } from '@/lib/router';

export function ServicesTable({ orderable }: { orderable?: boolean }) {
  const { categories, services, loading, error } = useCatalog();
  const { money } = useApp();
  const [q, setQ] = useState('');
  const [platform, setPlatform] = useState('All');

  const platforms = useMemo(() => ['All', ...new Set(categories.map((c) => c.platform))], [categories]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return categories
      .filter((c) => platform === 'All' || c.platform === platform)
      .map((c) => ({
        category: c,
        items: services.filter(
          (s) => s.category_id === c.id && (!needle || s.name.toLowerCase().includes(needle) || String(s.id) === needle),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [categories, services, q, platform]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorNote message={error} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-10" placeholder="Search services by name or ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {platforms.map((p) => (
            <button key={p} onClick={() => setPlatform(p)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${platform === p ? 'bg-brand-600 text-white' : 'bg-surface border border-line text-muted hover:text-ink'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card"><EmptyState icon={Layers} title="No services found" text="Try a different search or platform." /></div>
      ) : (
        groups.map((g) => (
          <div key={g.category.id} className="card overflow-hidden">
            <div className="border-b border-line bg-soft/60 px-4 py-3">
              <p className="font-bold">{g.category.name}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="table-head w-16">ID</th>
                    <th className="table-head">Service</th>
                    <th className="table-head">Rate / 1000</th>
                    <th className="table-head">Min / Max</th>
                    <th className="table-head">Avg. time</th>
                    {orderable && <th className="table-head" />}
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((s) => (
                    <tr key={s.id} className="border-b border-line/60 transition last:border-0 hover:bg-soft/50">
                      <td className="table-cell font-semibold text-muted">{s.id}</td>
                      <td className="table-cell">
                        <p className="font-semibold">{s.name}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {s.refill && <Badge tone="bg-brand-500/10 text-brand-700 dark:text-brand-400"><RefreshCcw className="h-3 w-3" />Refill</Badge>}
                          {s.cancel && <Badge tone="bg-sky-500/10 text-sky-600 dark:text-sky-400"><XCircle className="h-3 w-3" />Cancel</Badge>}
                        </div>
                      </td>
                      <td className="table-cell font-bold text-brand-700 dark:text-brand-400">{money(s.rate, 4)}</td>
                      <td className="table-cell whitespace-nowrap text-muted">{s.min_qty.toLocaleString()} / {s.max_qty.toLocaleString()}</td>
                      <td className="table-cell text-muted">{s.avg_time || 'Not enough data'}</td>
                      {orderable && (
                        <td className="table-cell text-right">
                          <button onClick={() => navigate(`/new-order?service=${s.id}`)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700">
                            Order
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
