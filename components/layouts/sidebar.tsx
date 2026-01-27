'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  Key,
  ScrollText,
  FileCheck,
  Settings,
  Webhook,
  Bot,
  ShieldAlert,
  BadgeCheck,
} from 'lucide-react';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Organizations',
    href: '/organizations',
    icon: Building2,
  },
  {
    name: 'Users',
    href: '/users',
    icon: UserCog,
  },
  {
    name: 'Partners',
    href: '/partners',
    icon: Users,
  },
  {
    name: 'Keys',
    href: '/keys',
    icon: Key,
  },
  {
    name: 'Webhooks',
    href: '/webhooks',
    icon: Webhook,
  },
  {
    name: 'Audit Log',
    href: '/audit',
    icon: ScrollText,
  },
  {
    name: 'Compliance',
    href: '/compliance',
    icon: FileCheck,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

const adminNavigation = [
  {
    name: 'Partner Licenses',
    href: '/admin/partners',
    icon: BadgeCheck,
  },
  {
    name: 'Agent Registry',
    href: '/admin/agents',
    icon: Bot,
  },
  {
    name: 'Incident Response',
    href: '/admin/incidents',
    icon: ShieldAlert,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-white">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 font-bold text-white">
            C
          </div>
          <span className="text-xl font-bold">CIRISPortal</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}

        {/* Admin Section */}
        <div className="mt-6 border-t pt-4">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Admin
          </p>
          {adminNavigation.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + '/');
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-red-50 text-red-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t p-4">
        <div className="text-xs text-gray-500">
          Version 0.1.0
          <br />
          portal.ciris.ai
        </div>
      </div>
    </div>
  );
}
