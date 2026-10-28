import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard, Users, ListOrdered, List, Server, Wallet, LifeBuoy, Megaphone, Mail, Settings,
  ArrowLeft, LogOut, Menu, X, Moon, Sun, ShieldAlert,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { LoginForm } from '@/components/LoginForm';
import { LoadingBlock } from '@/components/ui';
import { Link, navigate, usePath } from '@/lib/router';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/orders', label: 'Orders', icon: ListOrdered },
  { to: '/admin/services', label: 'Services', icon: List },
  { to: '/admin/providers', label: 'Providers', icon: Server },
  { to: '/admin/payments', label: 'Payments', icon: Wallet },
  { to: '/admin/tickets', label: 'Tickets', icon: LifeBuoy },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/admin/email', label: 'Email', icon: Mail },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminGate({ children }: { children: ReactNode }) {
  const { session, profile, loading, signOut } = useAuth();
  if (loading || (session && !profile)) return <div className="flex min-h-screen items-center justify-center"><LoadingBlock /></div>;
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-soft/40 p-4">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center"><Logo /></div>
          <div className="card p-6 sm:p-8"><LoginForm redirect="/admin" title="Admin sign in" showSignup={false} /></div>
        </div>
      </div>
    );
  }
  if (profile?.role !== 'admin' || profile.status !== 'active') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-md p-8 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-4 text-xl font-extrabold">Access denied</h1>
          <p className="mt-2 text-sm text-muted">This area is for administrators only.</p>
          <div className="mt-6 flex justify-center gap-4 text-sm font-semibold">
            <Link to="/new-order" className="text-brand-600 hover:underline">Go to my panel</Link>
            <button onClick={() => signOut().then(() => navigate('/admin'))} className="text-muted hover:text-ink">Switch account</button>
          </div>
        </div>
      </div>
    );
  }
  return <AdminLayout>{children}</AdminLayout>;
}

function AdminLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme, currency, setCurrency } = useApp();
  const path = usePath();
  const [mobile, setMobile] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <Logo to="/admin" />
          <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-canvas">Admin</span>
        </div>
        <button className="rounded-lg p-1.5 text-muted lg:hidden" onClick={() => setMobile(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV.map((n) => {
          const active = n.to === '/admin' ? path === '/admin' : path.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} onClick={() => setMobile(false)}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? 'bg-brand-600 text-white shadow-sm' : 'text-muted hover:bg-soft hover:text-ink'}`}>
              <n.icon className={`h-[18px] w-[18px] ${active ? '' : 'group-hover:text-brand-600'}`} />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-line p-3">
        <Link to="/new-order" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-soft hover:text-ink">
          <ArrowLeft className="h-[18px] w-[18px]" /> Customer panel
        </Link>
        <button onClick={() => signOut().then(() => navigate('/admin'))} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-red-500/10 hover:text-red-600">
          <LogOut className="h-[18px] w-[18px]" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-surface lg:block">{sidebar}</aside>
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobile(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 animate-fade-up border-r border-line bg-surface">{sidebar}</aside>
        </div>
      )}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-surface/85 px-4 backdrop-blur-lg sm:px-6">
        <button className="rounded-lg p-2 text-muted hover:bg-soft lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        <div className="hidden text-sm text-muted lg:block">Signed in as <span className="font-semibold text-ink">{profile?.username}</span></div>
        <div className="flex items-center gap-2">
          <select value={currency} onChange={(e) => setCurrency(e.target.value as 'USD' | 'BDT')} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-semibold outline-none" aria-label="Currency">
            <option value="USD">USD</option>
            <option value="BDT">BDT</option>
          </select>
          <button onClick={toggleTheme} className="rounded-lg p-2 text-muted transition hover:bg-soft hover:text-ink" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl animate-fade-up px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
