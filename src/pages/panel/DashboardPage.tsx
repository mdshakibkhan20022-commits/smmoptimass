import { useEffect, useState } from 'react';
import { Wallet, TrendingUp, ListOrdered, Award, Check, Megaphone, Sparkles, Tag, Newspaper } from 'lucide-react';
import { Badge, EmptyState, LoadingBlock, PageHeader, StatCard } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { TIERS, formatDate, tierFor } from '@/lib/format';
import type { Announcement } from '@/lib/types';

export function DashboardPage() {
  const { profile } = useAuth();
  const { money } = useApp();
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [activeCount, setActiveCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.from('orders').select('id', { count: 'exact', head: true }).then(({ count }) => setOrderCount(count ?? 0));
    supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['pending', 'processing', 'in_progress'])
      .then(({ count }) => setActiveCount(count ?? 0));
  }, []);

  if (!profile) return <LoadingBlock />;
  const { tier, next, index } = tierFor(profile.total_spent);
  const progress = next ? Math.min(100, ((profile.total_spent - tier.min) / (next.min - tier.min)) * 100) : 100;

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome back, ${profile.full_name || profile.username}`} subtitle="Here is an overview of your account." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Balance" value={money(profile.balance)} />
        <StatCard icon={TrendingUp} label="Total spent" value={money(profile.total_spent)} tone="text-sky-600 bg-sky-500/10" />
        <StatCard icon={ListOrdered} label="Orders" value={orderCount ?? '...'} tone="text-amber-600 bg-amber-500/10" />
        <StatCard icon={Award} label="Active orders" value={activeCount ?? '...'} tone="text-rose-600 bg-rose-500/10" />
      </div>

      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-muted">Your reward tier</p>
            <p className="mt-1 text-2xl font-extrabold">{tier.name} <span className="text-base font-semibold text-brand-600">{tier.discount}% off every order</span></p>
          </div>
          {next && <p className="text-sm text-muted">Spend <span className="font-bold text-ink">{money(next.min - profile.total_spent)}</span> more to reach {next.name}</p>}
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-soft">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {TIERS.map((t, i) => (
            <div key={t.name} className={`rounded-xl border p-3 text-center transition ${i === index ? 'border-brand-500 bg-brand-500/10' : i < index ? 'border-line bg-soft/50' : 'border-line'}`}>
              <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full ${i <= index ? 'bg-brand-600 text-white' : 'bg-soft text-muted'}`}>
                {i < index ? <Check className="h-4 w-4" /> : <Award className="h-4 w-4" />}
              </div>
              <p className="mt-2 text-sm font-bold">{t.name}</p>
              <p className="text-xs text-muted">{money(t.min, 0)}+</p>
              <p className="text-xs font-semibold text-brand-600">{t.discount}% off</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
        {[
          ['Username', profile.username],
          ['Email', profile.email],
          ['Member since', formatDate(profile.created_at)],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-xs font-semibold uppercase text-muted">{k}</p>
            <p className="mt-1 truncate font-semibold">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const KIND_META: Record<Announcement['kind'], { label: string; icon: typeof Megaphone; tone: string }> = {
  update: { label: 'Update', icon: Megaphone, tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  new_service: { label: 'New service', icon: Sparkles, tone: 'bg-brand-500/10 text-brand-700 dark:text-brand-400' },
  price: { label: 'Price change', icon: Tag, tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  news: { label: 'News', icon: Newspaper, tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
};

export function UpdatesPage() {
  const [items, setItems] = useState<Announcement[] | null>(null);

  useEffect(() => {
    supabase.from('announcements').select('*').eq('published', true).order('created_at', { ascending: false }).limit(100)
      .then(({ data, error }) => {
        if (error) console.error(error);
        setItems((data as Announcement[]) ?? []);
      });
  }, []);

  return (
    <div>
      <PageHeader title="Updates" subtitle="New services, price changes and news from our team." />
      {items === null ? <LoadingBlock /> : items.length === 0 ? (
        <div className="card"><EmptyState icon={Megaphone} title="No updates yet" text="Check back soon for news and new services." /></div>
      ) : (
        <div className="space-y-4">
          {items.map((a) => {
            const meta = KIND_META[a.kind];
            const Icon = meta.icon;
            return (
              <article key={a.id} className="card flex gap-4 p-5 transition hover:border-brand-500/40">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}><Icon className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">{a.title}</h2>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{formatDate(a.created_at)}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{a.body}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
