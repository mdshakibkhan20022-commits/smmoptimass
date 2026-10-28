import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { Button, ErrorNote } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { friendlyError } from '@/lib/errors';
import { Link, navigate } from '@/lib/router';

export function LoginForm({ redirect = '/new-order', title = 'Sign in to your account', showSignup = true }: { redirect?: string; title?: string; showSignup?: boolean }) {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(identifier.trim(), password);
      navigate(redirect);
    } catch (err) {
      setError(friendlyError(err, 'Incorrect username or password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-extrabold">{title}</h2>
      <div>
        <label className="label" htmlFor="identifier">Username or email</label>
        <input id="identifier" className="input" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="password">Password</label>
          <Link to="/forgot-password" className="mb-1.5 text-xs font-semibold text-brand-600 hover:underline">Forgot password?</Link>
        </div>
        <div className="relative">
          <input id="password" type={show ? 'text' : 'password'} className="input pr-10" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink" aria-label="Show password">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <ErrorNote message={error} />
      <Button type="submit" loading={loading} icon={LogIn} className="w-full" size="lg">Sign in</Button>
      {showSignup && (
        <p className="text-center text-sm text-muted">
          Don't have an account?{' '}
          <Link to="/signup" className="font-semibold text-brand-600 hover:underline">Sign up</Link>
        </p>
      )}
    </form>
  );
}
