'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  Key,
  ScrollText,
  FileCheck,
  User,
  Webhook,
  Bot,
  ShieldAlert,
  BadgeCheck,
  ShieldCheck,
  Package,
} from 'lucide-react';

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[]; // If undefined, visible to all roles
};

// Navigation items with role restrictions
const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    // All roles can see dashboard
  },
  {
    name: 'Organizations',
    href: '/organizations',
    icon: Building2,
    roles: ['admin'], // Admin only
  },
  {
    name: 'Users',
    href: '/users',
    icon: UserCog,
    roles: ['admin', 'partner'], // Admin and Partner
  },
  {
    name: 'Licensees',
    href: '/partners',
    icon: Users,
    roles: ['admin', 'partner'], // Admin and Partner can manage licensees
  },
  {
    name: 'Keys',
    href: '/keys',
    icon: Key,
    // All roles can view keys (scoped to their org)
  },
  {
    name: 'Webhooks',
    href: '/webhooks',
    icon: Webhook,
    roles: ['admin', 'partner'], // Admin and Partner
  },
  {
    name: 'Audit Log',
    href: '/audit',
    icon: ScrollText,
    // All roles can view audit (scoped to their org)
  },
  {
    name: 'Compliance',
    href: '/compliance',
    icon: FileCheck,
    roles: ['admin', 'partner'], // Admin and Partner
  },
  {
    name: 'Account',
    href: '/settings',
    icon: User,
    // All roles can access their account
  },
];

// Admin-only navigation section
const adminNavigation: NavItem[] = [
  {
    name: 'System Users',
    href: '/admin/system-users',
    icon: ShieldCheck,
    roles: ['admin'],
  },
  {
    name: 'Partner Licenses',
    href: '/admin/partners',
    icon: BadgeCheck,
    roles: ['admin'],
  },
  {
    name: 'Agent Registry',
    href: '/admin/agents',
    icon: Bot,
    roles: ['admin'],
  },
  {
    name: 'Build Registry',
    href: '/admin/builds',
    icon: Package,
    roles: ['admin'],
  },
  {
    name: 'Incident Response',
    href: '/admin/incidents',
    icon: ShieldAlert,
    roles: ['admin'],
  },
];

function getRoleBadge(role: string) {
  switch (role) {
    case 'admin':
      return (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          Admin
        </span>
      );
    case 'partner':
      return (
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          Partner
        </span>
      );
    case 'licensee':
      return (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          Licensee
        </span>
      );
    default:
      return null;
  }
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // @ts-expect-error - extended session type
  const userRole = (session?.user?.role as string) || 'licensee';

  // Filter navigation items based on user role
  const visibleNavigation = navigation.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  const visibleAdminNavigation = adminNavigation.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

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

      {/* Role indicator */}
      <div className="border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Logged in as</span>
          {getRoleBadge(userRole)}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {visibleNavigation.map((item) => {
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

        {/* Admin Section - only visible to admins */}
        {visibleAdminNavigation.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Admin
            </p>
            {visibleAdminNavigation.map((item) => {
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
        )}
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
