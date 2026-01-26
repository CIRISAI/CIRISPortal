import { Building2, Users, Key, Shield, ScrollText } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-gray-600">CIRIS Partner Portal overview</p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Organizations</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">12</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-3">
              <Building2 className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-600">3 pending onboarding</p>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Active Partners
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">24</p>
            </div>
            <div className="rounded-full bg-blue-100 p-3">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-green-600">All licenses valid</p>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Custodied Keys
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">18</p>
            </div>
            <div className="rounded-full bg-purple-100 p-3">
              <Key className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-600">2 pending rotation</p>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Registry Status
              </p>
              <p className="mt-2 text-3xl font-bold text-green-600">Healthy</p>
            </div>
            <div className="rounded-full bg-green-100 p-3">
              <Shield className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-600">All sources in sync</p>
        </div>
      </div>

      {/* Recent Activity and Status */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Recent Activity</h2>
            <div className="space-y-4">
              {[
                {
                  type: 'Organization Created',
                  description:
                    'Acme Healthcare onboarded as PROFESSIONAL_MEDICAL',
                  time: '2 hours ago',
                  status: 'completed',
                },
                {
                  type: 'Key Rotation',
                  description: 'Legal Partners LLP rotated signing keys',
                  time: '5 hours ago',
                  status: 'completed',
                },
                {
                  type: 'User Invited',
                  description:
                    'jane@community-clinic.org invited to Community Clinic',
                  time: '1 day ago',
                  status: 'pending',
                },
                {
                  type: 'License Updated',
                  description: 'FinServ Inc upgraded to PROFESSIONAL_FINANCIAL',
                  time: '2 days ago',
                  status: 'completed',
                },
              ].map((activity, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 border-b pb-4 last:border-0"
                >
                  <div className="mt-1 h-2 w-2 rounded-full bg-emerald-600" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{activity.type}</p>
                    <p className="text-sm text-gray-600">
                      {activity.description}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {activity.time}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      activity.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {activity.status === 'completed' ? 'Completed' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Registry Status</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">API (HTTPS)</span>
                <span className="text-sm font-medium text-green-600">
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">DNS US</span>
                <span className="text-sm font-medium text-green-600">
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">DNS EU</span>
                <span className="text-sm font-medium text-green-600">
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Key Vault</span>
                <span className="text-sm font-medium text-green-600">
                  Connected
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6">
            <div className="mb-3 flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-gray-500" />
              <h2 className="font-semibold">Quick Links</h2>
            </div>
            <div className="space-y-2">
              <a
                href="/organizations"
                className="block text-sm text-emerald-600 hover:text-emerald-700"
              >
                → New Organization
              </a>
              <a
                href="/keys"
                className="block text-sm text-emerald-600 hover:text-emerald-700"
              >
                → Manage Keys
              </a>
              <a
                href="/audit"
                className="block text-sm text-emerald-600 hover:text-emerald-700"
              >
                → View Audit Log
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
