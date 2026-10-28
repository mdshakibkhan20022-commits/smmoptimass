import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { MailCheck, UserPlus, KeyRound } from 'lucide-react';
import { PublicLayout } from '@/components/PublicLayout';
import { LoginForm } from '@/components/LoginForm';
import { Button, ErrorNote } from '@/components/ui';
import { callFunction, supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { Link, navigate } from '@/lib/router';
import { useAuth } from '@/context/AuthContext';

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <PublicLayout>
      <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(16_185_112/0.14),transparent_60%)]" />
        <div className="card relative w-full max-w-md animate-scale-in p-6 sm:p-8">{children}</div>
      </div>
    </PublicLayout>
  );
}

export function LoginPage() {
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}

export function SignupPage() {
  const { signIn } = useAuth();
  const ref = new URLSearchParams(window.location.search).get('ref') ?? localStorage.getItem('ref') ?? '';
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '', agree: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ref) localStorage.setItem('ref', ref);
  }, [ref]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[A-Za-z0-9_]{3,20}$/.test(form.username)) return setError('Username must be 3-20 letters, numbers or underscores.');
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    if (!form.agree) return setError('Please accept the Terms of Service.');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { username: form.username, ref } },
      });
      if (err) throw err;
      localStorage.removeItem('ref');
      await signIn(form.username, form.password);
      callFunction('email', { action: 'welcome' }).catch((x) => console.error('welcome email', x));
      navigate('/new-order');
    } catch (err) {
      setError(friendlyError(err, 'Could not create your account. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: k === 'agree' ? e.target.checked : e.target.value });

  return (
    <AuthShell>
      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-xl font-extrabold">Create your account</h2>
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input id="username" className="input" autoComplete="username" value={form.username} onChange={set('username')} required />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" autoComplete="email" value={form.email} onChange={set('email')} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pw">Password</label>
            <input id="pw" type="password" className="input" autoComplete="new-password" value={form.password} onChange={set('password')} required />
          </div>
          <div>
            <label className="label" htmlFor="pw2">Confirm</label>
            <input id="pw2" type="password" className="input" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} required />
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" className="mt-1 accent-brand-600" checked={form.agree} onChange={set('agree')} />
          <span>I agree to the <Link to="/terms" className="font-semibold text-brand-600 hover:underline">Terms of Service</Link></span>
        </label>
        <ErrorNote message={error} />
        <Button type="submit" loading={loading} icon={UserPlus} className="w-full" size="lg">Sign up</Button>
        <p className="text-center text-sm text-muted">
          Already have an account? <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) console.error('reset request failed', error);
    setSent(true);
    setLoading(false);
  };

  return (
    <AuthShell>
      {sent ? (
        <div className="py-4 text-center">
          <MailCheck className="mx-auto h-12 w-12 text-brand-600" />
          <h2 className="mt-4 text-xl font-extrabold">Check your inbox</h2>
          <p className="mt-2 text-sm text-muted">If that email is registered, we have sent a link to reset your password.</p>
          <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-brand-600 hover:underline">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <h2 className="text-xl font-extrabold">Reset your password</h2>
          <p className="text-sm text-muted">Enter your account email and we'll send you a reset link.</p>
          <input type="email" className="input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" loading={loading} className="w-full" size="lg">Send reset link</Button>
          <p className="text-center text-sm"><Link to="/login" className="font-semibold text-brand-600 hover:underline">Back to sign in</Link></p>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const { session } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) return setError(friendlyError(err, 'Could not update password. The link may have expired.'));
    navigate('/new-order');
  };

  return (
    <AuthShell>
      {!session ? (
        <div className="py-4 text-center">
          <KeyRound className="mx-auto h-12 w-12 text-muted" />
          <p className="mt-4 text-sm text-muted">This reset link is invalid or has expired.</p>
          <Link to="/forgot-password" className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:underline">Request a new link</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <h2 className="text-xl font-extrabold">Choose a new password</h2>
          <input type="password" className="input" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <ErrorNote message={error} />
          <Button type="submit" loading={loading} className="w-full" size="lg">Update password</Button>
        </form>
      )}
    </AuthShell>
  );
}
