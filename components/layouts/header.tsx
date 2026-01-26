'use client';

import { Bell, User, Github, Globe } from 'lucide-react';
import Link from 'next/link';

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-gray-900">
          GDPR Compliance Management
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
        <button className="flex items-center gap-2 rounded-lg p-2 hover:bg-gray-100">
          <User className="h-5 w-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Admin</span>
        </button>
      </div>
    </header>
  );
}
