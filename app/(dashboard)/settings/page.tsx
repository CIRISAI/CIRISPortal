import { Save, Shield, Bell, Database } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-gray-600">
          Configure system preferences and security
        </p>
      </div>

      <div className="grid gap-6">
        {/* GDPR Configuration */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold">GDPR Configuration</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Default Response Window (days)
              </label>
              <input
                type="number"
                className="mt-1 w-full max-w-xs rounded-lg border px-3 py-2"
                defaultValue={30}
              />
              <p className="mt-1 text-sm text-gray-600">
                GDPR requires responses within 30 days
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-delete"
                className="h-4 w-4 rounded border-gray-300"
                defaultChecked
              />
              <label htmlFor="auto-delete" className="text-sm text-gray-700">
                Automatically delete completed DSARs after 90 days
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="email-notifications"
                className="h-4 w-4 rounded border-gray-300"
                defaultChecked
              />
              <label
                htmlFor="email-notifications"
                className="text-sm text-gray-700"
              >
                Send email notifications for DSAR status changes
              </label>
            </div>
          </div>
        </div>

        {/* Identity Resolution */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <Database className="h-5 w-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold">Identity Resolution</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="identity-graph"
                className="h-4 w-4 rounded border-gray-300"
                defaultChecked
              />
              <label htmlFor="identity-graph" className="text-sm text-gray-700">
                Enable identity graph matching
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Matching Confidence Threshold
              </label>
              <input
                type="range"
                className="mt-2 w-full max-w-xs"
                min="50"
                max="100"
                defaultValue={85}
              />
              <p className="mt-1 text-sm text-gray-600">85% (recommended)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Trusted Identifier Types
              </label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="email-id"
                    className="h-4 w-4 rounded border-gray-300"
                    defaultChecked
                  />
                  <label htmlFor="email-id" className="text-sm text-gray-700">
                    Email addresses
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="discord-id"
                    className="h-4 w-4 rounded border-gray-300"
                    defaultChecked
                  />
                  <label htmlFor="discord-id" className="text-sm text-gray-700">
                    Discord IDs
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="user-id"
                    className="h-4 w-4 rounded border-gray-300"
                    defaultChecked
                  />
                  <label htmlFor="user-id" className="text-sm text-gray-700">
                    User IDs
                  </label>
                </div>
              </div>
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
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Alert Email
              </label>
              <input
                type="email"
                className="mt-1 w-full max-w-md rounded-lg border px-3 py-2"
                defaultValue="compliance@company.com"
              />
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
                Receive real-time DSAR status updates
              </p>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-2">
              <Shield className="h-5 w-5 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold">Security</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                API Key
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="password"
                  className="max-w-md flex-1 rounded-lg border px-3 py-2"
                  value="••••••••••••••••"
                  readOnly
                />
                <button className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50">
                  Regenerate
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Data Retention Period
              </label>
              <select className="mt-1 w-full max-w-xs rounded-lg border px-3 py-2">
                <option>7 years (default)</option>
                <option>5 years</option>
                <option>3 years</option>
                <option>1 year</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="encryption"
                className="h-4 w-4 rounded border-gray-300"
                defaultChecked
                disabled
              />
              <label htmlFor="encryption" className="text-sm text-gray-700">
                Encrypt all PII at rest (always enabled)
              </label>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            <Save className="h-5 w-5" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
