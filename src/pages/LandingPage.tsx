import { useState } from 'react';
import {
  Zap, ShieldCheck, Headphones, Wallet, RefreshCcw, Code2, Star, ChevronDown,
  Instagram, Youtube, Facebook, Send, Music2, Twitter, UserPlus, CreditCard, ShoppingCart, TrendingUp,
} from 'lucide-react';
import { PublicLayout } from '@/components/PublicLayout';
import { LoginForm } from '@/components/LoginForm';
import { Link } from '@/lib/router';
import { useAuth } from '@/context/AuthContext';

const PLATFORMS = [
  { icon: Instagram, name: 'Instagram', tone: 'from-pink-500 to-orange-400' },
  { icon: Music2, name: 'TikTok', tone: 'from-slate-800 to-slate-600' },
  { icon: Youtube, name: 'YouTube', tone: 'from-red-600 to-red-500' },
  { icon: Facebook, name: 'Facebook', tone: 'from-blue-600 to-blue-500' },
  { icon: Send, name: 'Telegram', tone: 'from-sky-500 to-sky-400' },
  { icon: Twitter, name: 'Twitter / X', tone: 'from-slate-900 to-slate-700' },
];

const FEATURES = [
  { icon: Zap, title: 'Instant start', text: 'Most orders begin within minutes, fully automated around the clock.' },
  { icon: Wallet, title: 'Lowest prices', text: 'Wholesale rates for resellers with automatic loyalty discounts.' },
  { icon: RefreshCcw, title: 'Refill guarantee', text: 'Request a refill in one click on services that drop.' },
  { icon: ShieldCheck, title: 'Safe & secure', text: 'We never ask for your passwords. Payments are verified.' },
  { icon: Headphones, title: '24/7 support', text: 'Real people ready on tickets, WhatsApp and Telegram.' },
  { icon: Code2, title: 'Reseller API', text: 'Connect your own panel to ours with a simple standard API.' },
];

const STEPS = [
  { icon: UserPlus, title: 'Create an account', text: 'Sign up in seconds with your email.' },
  { icon: CreditCard, title: 'Add funds', text: 'Top up with bKash or other methods.' },
  { icon: ShoppingCart, title: 'Place your order', text: 'Pick a service, paste your link, done.' },
  { icon: TrendingUp, title: 'Watch it grow', text: 'Track progress live in your orders.' },
];

const REVIEWS = [
  { name: 'Rafiq H.', role: 'Reseller', text: 'Best rates I have found and orders start almost instantly. My clients are happy.' },
  { name: 'Nusrat J.', role: 'Content creator', text: 'Super clean dashboard and support replied within minutes. Highly recommend.' },
  { name: 'Arif K.', role: 'Agency owner', text: 'The API works perfectly with my panel. Refills are processed without any hassle.' },
];

const FAQ = [
  { q: 'What is an SMM panel?', a: 'An SMM panel is an online shop where you can buy social media services such as followers, likes, views and comments at wholesale prices.' },
  { q: 'Do you need my password?', a: 'Never. We only need the public link to your profile or post.' },
  { q: 'How fast do orders start?', a: 'Most services start within 0-30 minutes. Each service shows its average delivery time.' },
  { q: 'How do I add funds?', a: 'Go to Add Funds, send money via bKash and submit your transaction ID. Your balance is updated after verification.' },
  { q: 'What if my order drops?', a: 'Services marked with refill can be refilled for free from your orders page within the refill period.' },
];

export function LandingPage() {
  const { session } = useAuth();
  const [faq, setFaq] = useState<number | null>(0);

  return (
    <PublicLayout>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgb(16_185_112/0.16),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgb(14_165_233/0.10),transparent_50%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" /> Trusted by thousands of resellers
            </span>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Grow your social media <span className="bg-gradient-to-r from-brand-600 to-teal-500 bg-clip-text text-transparent">the smart way</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              SMM OPTIMA delivers followers, likes, views and engagement for every major platform with instant start, real-time tracking and the most competitive prices.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={session ? '/new-order' : '/signup'} className="rounded-xl bg-brand-600 px-6 py-3.5 font-semibold text-white transition hover:bg-brand-700 hover:shadow-lift">
                {session ? 'Go to dashboard' : 'Get started free'}
              </Link>
              <Link to="/services" className="rounded-xl border border-line bg-surface px-6 py-3.5 font-semibold transition hover:bg-soft">
                View services
              </Link>
            </div>
            <div className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {[['2M+', 'Orders completed'], ['3,500+', 'Services'], ['0.001$', 'Starting price']].map(([v, l]) => (
                <div key={l}>
                  <p className="text-2xl font-extrabold">{v}</p>
                  <p className="text-xs text-muted">{l}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card animate-scale-in p-6 sm:p-8 lg:ml-auto lg:w-[440px]">
            {session ? (
              <div className="py-6 text-center">
                <p className="text-lg font-bold">Welcome back!</p>
                <p className="mt-1 text-sm text-muted">You are already signed in.</p>
                <Link to="/new-order" className="mt-6 inline-flex rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700">
                  Open dashboard
                </Link>
              </div>
            ) : (
              <LoginForm />
            )}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-8 sm:grid-cols-3 sm:px-6 lg:grid-cols-6">
          {PLATFORMS.map((p) => (
            <div key={p.name} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-soft">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${p.tone} text-white`}>
                <p.icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold">{p.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Everything you need to grow</h2>
          <p className="mt-3 text-muted">Built for creators, agencies and resellers who want speed, quality and fair prices.</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card group p-6 transition hover:-translate-y-1 hover:border-brand-500/40">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                <f.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-br from-brand-700 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">How it works</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:bg-white/10">
                <div className="flex items-center justify-between">
                  <s.icon className="h-7 w-7 text-brand-300" />
                  <span className="text-3xl font-extrabold text-white/15">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-white/70">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Loved by our customers</h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {REVIEWS.map((r) => (
            <div key={r.name} className="card p-6">
              <div className="flex gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="mt-4 text-sm">"{r.text}"</p>
              <p className="mt-5 text-sm font-bold">{r.name}</p>
              <p className="text-xs text-muted">{r.role}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Frequently asked questions</h2>
        <div className="mt-10 space-y-3">
          {FAQ.map((f, i) => (
            <div key={f.q} className="card overflow-hidden">
              <button onClick={() => setFaq(faq === i ? null : i)} className="flex w-full items-center justify-between px-5 py-4 text-left font-semibold">
                {f.q}
                <ChevronDown className={`h-5 w-5 shrink-0 text-muted transition ${faq === i ? 'rotate-180' : ''}`} />
              </button>
              {faq === i && <p className="animate-fade-up px-5 pb-5 text-sm text-muted">{f.a}</p>}
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
