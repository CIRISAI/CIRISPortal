'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

// Test users for devtest environment
const TEST_USERS = [
  {
    email: 'admin@qa-primary.test',
    name: 'QA Admin User',
    role: 'Admin',
    org: 'Primary Org',
  },
  {
    email: 'user@qa-primary.test',
    name: 'QA Regular User',
    role: 'User',
    org: 'Primary Org',
  },
  {
    email: 'admin@qa-secondary.test',
    name: 'QA Secondary Admin',
    role: 'Admin',
    org: 'Secondary Org',
  },
];

// Test password should be set server-side only (e.g., via environment variable)
const TEST_PASSWORD = '';

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Check if we're in devtest mode
  const isDevTest = process.env.NEXT_PUBLIC_APP_ENV === 'devtest';

  const handleTestLogin = async (testEmail: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signIn('test-credentials', {
        email: testEmail,
        password: TEST_PASSWORD,
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        setError('Login failed. Check credentials.');
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const result = await signIn('test-credentials', {
        email,
        password,
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        setError('Invalid email or password.');
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-white">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            CIRIS<span className="text-emerald-600">Portal</span>
          </h1>
          <p className="text-gray-600">
            Sign in to manage your agent identities
          </p>
          {isDevTest && (
            <span
              data-testid="devtest-badge"
              className="mt-2 inline-block rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800"
            >
              Development Mode
            </span>
          )}
        </div>

        {error && (
          <div
            data-testid="login-error"
            className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* Google OAuth - always shown */}
        <button
          data-testid="btn-google-signin"
          onClick={() => signIn('google', { callbackUrl })}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        {/* Community tier info */}
        {!isDevTest && (
          <div
            data-testid="community-info"
            className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/50 p-4"
          >
            <p className="text-center text-sm font-medium text-emerald-800">
              Get started with a Community identity
            </p>
            <ul className="mt-2 space-y-1 text-xs text-emerald-700">
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">&#10003;</span>
                Hardware-bound agent identity
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">&#10003;</span>
                Basic registry verification
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">&#10003;</span>
                Echo &amp; Default templates
              </li>
            </ul>
            <p className="mt-3 text-center text-xs text-gray-500">
              $1.50 per agent identity ($0.50 fee + $1.00 bond)
            </p>
          </div>
        )}

        {/* DevTest: Test User Options */}
        {isDevTest && (
          <>
            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-sm text-gray-500">or use test account</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            {/* Quick login buttons */}
            <div className="mb-4 space-y-2">
              {TEST_USERS.map((user) => (
                <button
                  key={user.email}
                  onClick={() => handleTestLogin(user.email)}
                  disabled={isLoading}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left transition-all hover:bg-gray-100 disabled:opacity-50"
                >
                  <div>
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      {user.role}
                    </span>
                    <div className="mt-1 text-xs text-gray-400">{user.org}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Manual credential form */}
            <details className="group">
              <summary className="cursor-pointer text-center text-sm text-gray-500 hover:text-gray-700">
                Or enter credentials manually
              </summary>
              <form onSubmit={handleCredentialLogin} className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="admin@qa-primary.test"
                  />
                </div>
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Enter password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </details>
          </>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          Operated under the CIRIS Accord
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
