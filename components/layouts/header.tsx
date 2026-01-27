'use client';

import { Bell, Github, Globe, LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-gray-900">
          CIRIS Registry Administration
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="https://github.com/CIRISAI/CIRISAgent"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-gray-100"
        >
          <Github className="h-5 w-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">GitHub</span>
        </Link>
        <Link
          href="https://ciris.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-gray-100"
        >
          <Globe className="h-5 w-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">CIRIS.ai</span>
        </Link>
        <button className="rounded-lg p-2 hover:bg-gray-100">
          <Bell className="h-5 w-5 text-gray-600" />
        </button>

        {session?.user && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {session.user.image ? (
                // Using img tag for external Google profile images
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User avatar'}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-medium text-white">
                  {session.user.name?.charAt(0) ||
                    session.user.email?.charAt(0) ||
                    'U'}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-700">
                  {session.user.email}
                </span>
                {/* @ts-expect-error - extended session type */}
                {session.user.orgId && (
                  <span className="text-xs text-gray-500">
                    {/* @ts-expect-error - extended session type */}
                    {session.user.orgId}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-2 rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
