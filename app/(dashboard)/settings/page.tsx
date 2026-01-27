'use client';

import { useSession } from 'next-auth/react';
import { Save, Shield, Bell, Key, Building2 } from 'lucide-react';

export default function SettingsPage() {
  const { data: session } = useSession();
  // @ts-expect-error - extended session type
  const userRole = session?.user?.role || 'user';
  // @ts-expect-error - extended session type
  const userOrgId = session?.user?.orgId || 'unknown';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-gray-600">
          Configure your account and organization preferences
        </p>
      </div>

      <div className="grid gap-6">
        {/* Account Information */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2">
              <Shield className="h-5 w-5 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold">Account Information</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                className="mt-1 w-full max-w-md rounded-lg border bg-gray-50 px-3 py-2"
                value={session?.user?.email || ''}
                disabled
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Display Name
              </label>
              <input
                type="text"
                className="mt-1 w-full max-w-md rounded-lg border px-3 py-2"
                defaultValue={session?.user?.name || ''}
              />
            </div>

            <div className="flex gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Role
                </label>
                <span className="mt-1 inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                  {userRole}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Organization
                </label>
                <span className="mt-1 inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                  {userOrgId}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Organization Settings (Partner/Admin only) */}
        {(userRole === 'admin' || userRole === 'partner') && (
          <div className="rounded-lg border bg-white p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold">Organization Settings</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Organization Name
                </label>
                <input
                  type="text"
                  className="mt-1 w-full max-w-md rounded-lg border px-3 py-2"
                  placeholder="Your Organization"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Primary Contact Email
                </label>
                <input
                  type="email"
                  className="mt-1 w-full max-w-md rounded-lg border px-3 py-2"
                  placeholder="contact@organization.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Key Custody Model
                </label>
                <select className="mt-1 w-full max-w-xs rounded-lg border px-3 py-2">
                  <option value="custodied">
                    Custodied (CIRIS manages keys)
                  </option>
                  <option value="self">Self-custody (you manage keys)</option>
                </select>
                <p className="mt-1 text-sm text-gray-600">
                  Determines how signing keys are managed for your organization
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Key Settings */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <Key className="h-5 w-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold">Key Management</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Key Rotation Policy
              </label>
              <select className="mt-1 w-full max-w-xs rounded-lg border px-3 py-2">
                <option>90 days (recommended)</option>
                <option>180 days</option>
                <option>365 days</option>
                <option>Manual only</option>
              </select>
              <p className="mt-1 text-sm text-gray-600">
                Automatic key rotation interval for compliance
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rotation-notify"
                className="h-4 w-4 rounded border-gray-300"
                defaultChecked
              />
              <label
                htmlFor="rotation-notify"
                className="text-sm text-gray-700"
              >
                Notify before key rotation (7 days advance notice)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="grace-period"
                className="h-4 w-4 rounded border-gray-300"
                defaultChecked
              />
              <label htmlFor="grace-period" className="text-sm text-gray-700">
                Enable grace period for key transitions (24 hours)
              </label>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-yellow-100 p-2">
              <Bell className="h-5 w-5 text-yellow-600" />
            </div>
            <h2 className="text-lg font-semibold">Notifications</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="notify-key-events"
                className="h-4 w-4 rounded border-gray-300"
                defaultChecked
              />
              <label
                htmlFor="notify-key-events"
                className="text-sm text-gray-700"
              >
                Key management events (rotation, revocation)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="notify-license"
                className="h-4 w-4 rounded border-gray-300"
                defaultChecked
              />
              <label htmlFor="notify-license" className="text-sm text-gray-700">
                License expiry warnings (30 days before)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="notify-security"
                className="h-4 w-4 rounded border-gray-300"
                defaultChecked
              />
              <label
                htmlFor="notify-security"
                className="text-sm text-gray-700"
              >
                Security alerts (emergency shutdown, mass revocation)
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Webhook URL (optional)
              </label>
              <input
                type="url"
                className="mt-1 w-full max-w-md rounded-lg border px-3 py-2"
                placeholder="https://your-webhook.com/endpoint"
              />
              <p className="mt-1 text-sm text-gray-600">
                Receive real-time event notifications via webhook
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700">
            <Save className="h-5 w-5" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
