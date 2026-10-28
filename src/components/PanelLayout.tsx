import { useState, type ReactNode } from 'react';
import {
  Megaphone, ShoppingCart, Layers, ListOrdered, Wallet, LifeBuoy, List, LayoutDashboard,
  ChevronDown, Users, Code2, UserCog, LogOut, Menu, X, Moon, Sun, Shield, Ban,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ContactButtons } from '@/components/PublicLayout';
import { Link, navigate, usePath } from '@/lib/router';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { tierFor } from '@/lib/format';

const MAIN = [
  { to: '/updates', label: 'Updates', icon: Megaphone },
  { to: '/new-order', label: 'New Order', icon: ShoppingCart },
  { to: '/mass-order', label: 'Mass Order', icon: Layers },
  { to: '/orders', label: 'My Orders', icon: ListOrdered },
  { to: '/add-funds', label: 'Add Balance', icon: Wallet },
  { to: '/tickets', label: 'Tickets', icon: LifeBuoy },
  { to: '/services', label: 'Services', icon: List },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

const MORE = [
  { to: '/affiliates', label: 'Affiliates', icon: Users },
  { to: '/api', label: 'API', icon: Code2 },
  { to: '/account', label: 'Account', icon: UserCog },
];

export function PanelLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const { money, theme, toggleTheme, currency, setCurrency, settings } = useApp();
  const path = usePath();
  const [mobile, setMobile] = useState(false);
  const [more, setMore] = useState(MORE.some((m) => path.startsWith(m.to)));

  if (profile?.status === 'banned') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-md p-8 text-center">
          <Ban className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-4 text-xl font-extrabold">Account suspended</h1>
          <p className="mt-2 text-sm text-muted">Your account has been suspended. Please contact support for help.</p>
          <button onClick={() => signOut().then(() => navigate('/'))} className="mt-6 text-sm font-semibold text-brand-600 hover:underline">Sign out</button>
        </div>
      </div>
    );
  }

  const tier = tierFor(profile?.total_spent ?? 0).tier;

  const item = (n: (typeof MAIN)[number]) => {
    const active = path === n.to || (n.to !== '/' && path.startsWith(n.to + '/'));
    return (
      <Link key={n.to} to={n.to} onClick={() => setMobile(false)}
        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? 'bg-brand-600 text-white shadow-sm' : 'text-muted hover:bg-soft hover:text-ink'}`}>
        <n.icon className={`h-[18px] w-[18px] ${active ? '' : 'text-muted group-hover:text-brand-600'}`} />
        {n.label}
      </Link>
    );
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo to="/new-order" />
        <button className="rounded-lg p-1.5 text-muted lg:hidden" onClick={() => setMobile(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      <div className="mx-4 mb-4 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-white shadow-lift">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-extrabold uppercase">
            {profile?.username?.[0] ?? '?'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{profile?.username}</p>
            <p className="text-xs text-white/70">{tier.name} member</p>
          </div>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/60">Balance</p>
            <p className="text-lg font-extrabold">{money(profile?.balance ?? 0)}</p>
          </div>
          <Link to="/add-funds" onClick={() => setMobile(false)} className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold transition hover:bg-white/30">+ Add</Link>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {MAIN.map(item)}
        <button onClick={() => setMore(!more)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-soft hover:text-ink">
          <ChevronDown className={`h-[18px] w-[18px] transition ${more ? 'rotate-180' : ''}`} />
          {more ? 'Show less' : 'Show more'}
        </button>
        {more && <div className="animate-fade-up space-y-1">{MORE.map(item)}</div>}
        {profile?.role === 'admin' && (
          <Link to="/admin" className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-brand-500/40 px-3 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-500/10 dark:text-brand-400">
            <Shield className="h-[18px] w-[18px]" /> Admin panel
          </Link>
        )}
      </nav>
      <div className="border-t border-line p-3">
        <button onClick={() => signOut().then(() => navigate('/'))} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-red-500/10 hover:text-red-600">
          <LogOut className="h-[18px] w-[18px]" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-72">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-line bg-surface lg:block">{sidebar}</aside>
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobile(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-fade-up border-r border-line bg-surface">{sidebar}</aside>
        </div>
      )}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-surface/85 px-4 backdrop-blur-lg sm:px-6">
        <button className="rounded-lg p-2 text-muted hover:bg-soft lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        <div className="hidden text-sm text-muted lg:block">Welcome back, <span className="font-semibold text-ink">{profile?.username}</span></div>
        <div className="flex items-center gap-2">
          <select value={currency} onChange={(e) => setCurrency(e.target.value as 'USD' | 'BDT')} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-semibold outline-none" aria-label="Currency">
            <option value="USD">USD</option>
            <option value="BDT">BDT</option>
          </select>
          <button onClick={toggleTheme} className="rounded-lg p-2 text-muted transition hover:bg-soft hover:text-ink" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <Link to="/add-funds" className="rounded-xl bg-brand-500/10 px-3 py-1.5 text-sm font-bold text-brand-700 dark:text-brand-400">{money(profile?.balance ?? 0)}</Link>
        </div>
      </header>
      {settings?.notice && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-center text-sm font-semibold text-amber-700 dark:text-amber-400 sm:px-6">
          {settings.notice}
        </div>
      )}
      <main className="mx-auto max-w-7xl animate-fade-up px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      <ContactButtons />
    </div>
  );
}
