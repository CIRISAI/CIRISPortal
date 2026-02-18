'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { User, Building2, Shield, LogOut, CreditCard } from 'lucide-react';
import { TierBadge } from '@/components/ui/tier-badge';
import type { TierName } from '@/lib/stripe/tiers';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [portalLoading, setPortalLoading] = useState(false);
  // @ts-expect-error - extended session type
  const userRole = session?.user?.role || 'unknown';
  // @ts-expect-error - extended session type
  const orgId = session?.user?.orgId || 'unknown';
  // @ts-expect-error - extended session type
  const orgName = session?.user?.orgName || orgId;
  // @ts-expect-error - extended session type
  const userId = session?.user?.userId || 'unknown';

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'partner':
        return 'bg-blue-100 text-blue-800';
      case 'licensee':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Account</h1>
        <p className="mt-1 text-gray-600">Your account information</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Info */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-gray-100 p-2">
              <User className="h-5 w-5 text-gray-600" />
            </div>
            <h2 className="text-lg font-semibold">User</h2>
          </div>

          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Name</dt>
              <dd className="mt-1 text-gray-900">
                {session?.user?.name || '-'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-gray-900">
                {session?.user?.email || '-'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">User ID</dt>
              <dd className="mt-1 font-mono text-sm text-gray-600">{userId}</dd>
            </div>
          </dl>
        </div>

        {/* Organization Info */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold">Organization</h2>
          </div>

          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Name</dt>
              <dd className="mt-1 text-gray-900">{orgName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Organization ID
              </dt>
              <dd className="mt-1 font-mono text-sm text-gray-600">{orgId}</dd>
            </div>
          </dl>
        </div>

        {/* Role & Permissions */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <Shield className="h-5 w-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold">Role & Permissions</h2>
          </div>

          <div className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Role</dt>
              <dd className="mt-1">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getRoleBadgeColor(userRole)}`}
                >
                  {userRole}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Capabilities
              </dt>
              <dd className="mt-1 text-sm text-gray-600">
                {userRole === 'admin' && (
                  <ul className="list-inside list-disc space-y-1">
                    <li>Manage all organizations</li>
                    <li>Register and revoke agents</li>
                    <li>Emergency controls access</li>
                    <li>View all audit logs</li>
                  </ul>
                )}
                {userRole === 'partner' && (
                  <ul className="list-inside list-disc space-y-1">
                    <li>Manage organization users</li>
                    <li>Manage organization keys</li>
                    <li>View organization audit logs</li>
                  </ul>
                )}
                {userRole === 'licensee' && (
                  <ul className="list-inside list-disc space-y-1">
                    <li>View organization status</li>
                    <li>View assigned keys</li>
                  </ul>
                )}
                {userRole === 'community' && (
                  <ul className="list-inside list-disc space-y-1">
                    <li>Agent identity issuance</li>
                    <li>Basic verification</li>
                    <li>Echo &amp; Default templates</li>
                  </ul>
                )}
                {!['admin', 'partner', 'licensee', 'community'].includes(
                  userRole
                ) && <span className="text-gray-400">Unknown role</span>}
              </dd>
            </div>
          </div>
        </div>

        {/* Billing & Tier */}
        <div
          data-testid="billing-section"
          className="rounded-lg border bg-white p-6"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold">Billing & Tier</h2>
          </div>

          <div className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Current Tier
              </dt>
              <dd className="mt-1">
                <TierBadge
                  tier={
                    (userRole === 'community'
                      ? 'community'
                      : 'professional') as TierName
                  }
                  size="md"
                />
              </dd>
            </div>

            <div className="flex gap-2 pt-2">
              {userRole === 'community' && (
                <a
                  data-testid="btn-upgrade-tier"
                  href="/pricing"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Upgrade Tier
                </a>
              )}
              <button
                data-testid="btn-manage-billing"
                onClick={async () => {
                  setPortalLoading(true);
                  try {
                    const res = await fetch('/api/stripe/portal', {
                      method: 'POST',
                    });
                    if (res.ok) {
                      const { url } = await res.json();
                      if (url) window.location.href = url;
                    }
                  } catch {
                    // Stripe not configured or no billing account
                  } finally {
                    setPortalLoading(false);
                  }
                }}
                disabled={portalLoading}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {portalLoading ? 'Loading...' : 'Manage Billing'}
              </button>
            </div>
          </div>
        </div>

        {/* Sign Out */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-2">
              <LogOut className="h-5 w-5 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold">Session</h2>
          </div>

          <p className="mb-4 text-sm text-gray-600">
            Sign out of CIRISPortal. You will need to sign in again to access
            the dashboard.
          </p>

          <button
            data-testid="btn-sign-out"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
