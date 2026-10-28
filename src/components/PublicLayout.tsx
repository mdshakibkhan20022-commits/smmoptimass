import { useState, type ReactNode } from 'react';
import { Menu, Moon, Sun, X, MessageCircle, Send } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Link } from '@/lib/router';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/api', label: 'API' },
  { to: '/terms', label: 'Terms' },
];

export function ContactButtons() {
  const { settings } = useApp();
  const wa = settings?.whatsapp?.replace(/[^0-9]/g, '');
  const tg = settings?.telegram?.replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');
  if (!wa && !tg) return null;
  return (
    <div className="fixed bottom-5 left-5 z-40 flex flex-col gap-3">
      {wa && (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-110">
          <MessageCircle className="h-6 w-6" />
        </a>
      )}
      {tg && (
        <a href={`https://t.me/${tg}`} target="_blank" rel="noopener noreferrer" aria-label="Telegram"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#229ED9] text-white shadow-lg transition hover:scale-110">
          <Send className="h-5 w-5" />
        </a>
      )}
    </div>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useApp();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:bg-soft hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="rounded-lg p-2 text-muted transition hover:bg-soft hover:text-ink" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            {session ? (
              <Link to="/new-order" className="hidden rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 sm:inline-flex">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-ink transition hover:bg-soft sm:inline-flex">
                  Sign in
                </Link>
                <Link to="/signup" className="hidden rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 hover:shadow-lift sm:inline-flex">
                  Sign up
                </Link>
              </>
            )}
            <button onClick={() => setOpen(!open)} className="rounded-lg p-2 text-muted hover:bg-soft md:hidden" aria-label="Menu">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="animate-fade-up border-t border-line bg-surface px-4 py-3 md:hidden">
            {[...NAV, ...(session ? [{ to: '/new-order', label: 'Dashboard' }] : [{ to: '/login', label: 'Sign in' }, { to: '/signup', label: 'Sign up' }])].map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-soft">
                {n.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-muted">
              Smart social media growth. Fast, reliable and affordable services for creators, brands and resellers.
            </p>
          </div>
          <div>
            <p className="mb-3 text-sm font-bold">Platform</p>
            <div className="space-y-2 text-sm text-muted">
              <Link to="/services" className="block hover:text-ink">Services</Link>
              <Link to="/api" className="block hover:text-ink">API</Link>
              <Link to="/signup" className="block hover:text-ink">Create account</Link>
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm font-bold">Legal</p>
            <div className="space-y-2 text-sm text-muted">
              <Link to="/terms" className="block hover:text-ink">Terms of Service</Link>
              <Link to="/privacy" className="block hover:text-ink">Privacy Policy</Link>
              <Link to="/refund-policy" className="block hover:text-ink">Refund Policy</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-line py-5 text-center text-xs text-muted">
          &copy; {new Date().getFullYear()} SMM OPTIMA. All rights reserved.
        </div>
      </footer>
      <ContactButtons />
    </div>
  );
}
