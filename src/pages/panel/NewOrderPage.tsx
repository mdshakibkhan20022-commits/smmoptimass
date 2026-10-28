import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Wallet, TrendingUp, Award, ShoppingCart, Search, Instagram, Youtube, Facebook, Send, Music2, Twitter,
  Globe, Sparkles, RefreshCcw, XCircle, Clock, Info,
} from 'lucide-react';
import { useCatalog } from '@/hooks/useCatalog';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, EmptyState, ErrorNote, LoadingBlock, StatCard } from '@/components/ui';
import { callFunction, supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { tierFor } from '@/lib/format';
import { Link } from '@/lib/router';

const PLATFORM_ICONS: Record<string, typeof Instagram> = {
  Instagram, YouTube: Youtube, Facebook, Telegram: Send, TikTok: Music2, Twitter, 'Website Traffic': Globe,
};

export function NewOrderPage() {
  const { profile, refreshProfile } = useAuth();
  const { money } = useApp();
  const toast = useToast();
  const { categories, services, loading, error } = useCatalog();
  const [platform, setPlatform] = useState('All');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [link, setLink] = useState('');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [orderCount, setOrderCount] = useState(0);

  const { tier } = tierFor(profile?.total_spent ?? 0);

  useEffect(() => {
    supabase.from('orders').select('id', { count: 'exact', head: true }).then(({ count }) => setOrderCount(count ?? 0));
  }, []);

  useEffect(() => {
    if (loading || !services.length) return;
    const pre = Number(new URLSearchParams(window.location.search).get('service'));
    const s = services.find((x) => x.id === pre);
    if (s) {
      setCategoryId(s.category_id);
      setServiceId(s.id);
    }
  }, [loading, services]);

  const platforms = useMemo(() => ['All', ...new Set(categories.map((c) => c.platform))], [categories]);
  const visibleCats = categories.filter((c) => platform === 'All' || c.platform === platform);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return services.filter((s) => s.name.toLowerCase().includes(q) || String(s.id) === q).slice(0, 8);
  }, [search, services]);

  const catServices = services.filter((s) => s.category_id === (categoryId || visibleCats[0]?.id));
  const activeCat = categoryId || visibleCats[0]?.id || '';
  const service = services.find((s) => s.id === serviceId) ?? catServices[0];

  const qty = parseInt(quantity, 10) || 0;
  const charge = service ? (service.rate * qty) / 1000 * (1 - tier.discount / 100) : 0;

  const pickService = (id: number) => {
    const s = services.find((x) => x.id === id);
    if (!s) return;
    setCategoryId(s.category_id);
    setServiceId(s.id);
    setSearch('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!service) return;
    setFormError(null);
    if (qty < service.min_qty || qty > service.max_qty) {
      return setFormError(`Quantity must be between ${service.min_qty.toLocaleString()} and ${service.max_qty.toLocaleString()}.`);
    }
    if (charge > (profile?.balance ?? 0)) return setFormError('Your balance is too low for this order. Please add funds first.');
    setSubmitting(true);
    try {
      const { data, error: err } = await supabase.rpc('place_order', { p_service: service.id, p_link: link, p_quantity: qty });
      if (err) throw err;
      callFunction('provider', { action: 'submit', order_id: data }).catch((x) => console.error('provider submit failed', x));
      toast(`Order #${data} placed successfully!`);
      setLink('');
      setQuantity('');
      setOrderCount((c) => c + 1);
      await refreshProfile();
    } catch (err) {
      setFormError(friendlyError(err, 'Could not place your order. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Balance" value={money(profile?.balance ?? 0)} />
        <StatCard icon={TrendingUp} label="Total spent" value={money(profile?.total_spent ?? 0)} tone="text-sky-600 bg-sky-500/10" />
        <StatCard icon={ShoppingCart} label="Orders" value={orderCount.toLocaleString()} tone="text-amber-600 bg-amber-500/10" />
        <StatCard icon={Award} label="Your tier" value={`${tier.name}${tier.discount ? ` · ${tier.discount}% off` : ''}`} tone="text-rose-600 bg-rose-500/10" />
      </div>

      {loading ? <LoadingBlock /> : error ? <ErrorNote message={error} /> : services.length === 0 ? (
        <div className="card"><EmptyState icon={Sparkles} title="Services coming soon" text="We are adding services right now. Please check back shortly." /></div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-5">
          <form onSubmit={submit} className="card space-y-5 p-5 sm:p-6 xl:col-span-3">
            <div className="flex flex-wrap gap-2">
              {platforms.map((p) => {
                const Icon = PLATFORM_ICONS[p] ?? Sparkles;
                return (
                  <button type="button" key={p} onClick={() => { setPlatform(p); setCategoryId(''); setServiceId(null); }}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${platform === p ? 'bg-brand-600 text-white shadow-sm' : 'border border-line bg-soft/50 text-muted hover:text-ink'}`}>
                    {p !== 'All' && <Icon className="h-4 w-4" />}{p}
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className="input pl-10" placeholder="Search services" value={search} onChange={(e) => setSearch(e.target.value)} />
              {searchResults.length > 0 && (
                <div className="card absolute inset-x-0 top-full z-20 mt-2 max-h-72 animate-scale-in overflow-y-auto p-1.5">
                  {searchResults.map((s) => (
                    <button type="button" key={s.id} onClick={() => pickService(s.id)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-soft">
                      <span><span className="font-semibold text-muted">{s.id}</span> · {s.name}</span>
                      <span className="shrink-0 font-bold text-brand-700 dark:text-brand-400">{money(s.rate, 4)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="label">Category</label>
              <select className="input" value={activeCat} onChange={(e) => { setCategoryId(e.target.value); setServiceId(null); }}>
                {visibleCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Service</label>
              <select className="input" value={service?.id ?? ''} onChange={(e) => setServiceId(Number(e.target.value))}>
                {catServices.map((s) => (
                  <option key={s.id} value={s.id}>{s.id} - {s.name} - {money(s.rate, 4)} per 1000</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="link">Link</label>
              <input id="link" className="input" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="qty">Quantity</label>
              <input id="qty" type="number" inputMode="numeric" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
              {service && <p className="mt-1.5 text-xs text-muted">Min: {service.min_qty.toLocaleString()} - Max: {service.max_qty.toLocaleString()}</p>}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-soft px-4 py-3">
              <span className="text-sm font-semibold text-muted">Charge</span>
              <span className="text-lg font-extrabold">{money(charge, 4)}</span>
            </div>
            <ErrorNote message={formError} />
            <Button type="submit" loading={submitting} icon={ShoppingCart} size="lg" className="w-full" disabled={!service}>Submit order</Button>
            <p className="text-center text-xs text-muted">Need more balance? <Link to="/add-funds" className="font-semibold text-brand-600 hover:underline">Add funds</Link></p>
          </form>

          <div className="card h-fit p-5 sm:p-6 xl:col-span-2">
            <div className="flex items-center gap-2 text-sm font-bold"><Info className="h-4 w-4 text-brand-600" /> Service details</div>
            {service ? (
              <div className="mt-4 space-y-4">
                <p className="font-semibold">{service.name}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="bg-brand-500/10 text-brand-700 dark:text-brand-400">{money(service.rate, 4)} / 1000</Badge>
                  {service.refill && <Badge tone="bg-brand-500/10 text-brand-700 dark:text-brand-400"><RefreshCcw className="h-3 w-3" /> Refill</Badge>}
                  {service.cancel && <Badge tone="bg-sky-500/10 text-sky-600 dark:text-sky-400"><XCircle className="h-3 w-3" /> Cancel</Badge>}
                  {service.avg_time && <Badge><Clock className="h-3 w-3" /> {service.avg_time}</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-soft p-3"><p className="text-xs text-muted">Minimum</p><p className="font-bold">{service.min_qty.toLocaleString()}</p></div>
                  <div className="rounded-xl bg-soft p-3"><p className="text-xs text-muted">Maximum</p><p className="font-bold">{service.max_qty.toLocaleString()}</p></div>
                </div>
                {service.description ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{service.description}</p>
                ) : (
                  <p className="text-sm text-muted">Make sure your account or post is public before ordering. Do not place a second order on the same link until the first completes.</p>
                )}
              </div>
            ) : <p className="mt-4 text-sm text-muted">Pick a service to see details.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
