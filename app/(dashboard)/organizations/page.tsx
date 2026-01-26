import { Building2, Plus, Search } from 'lucide-react';

export default function OrganizationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
          <p className="mt-1 text-gray-600">
            Manage partner organizations and their licenses
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700">
          <Plus className="h-5 w-5" />
          New Organization
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search organizations..."
            className="w-full rounded-lg border py-2 pl-10 pr-4"
          />
        </div>
        <select className="rounded-lg border px-3 py-2">
          <option>All Statuses</option>
          <option>Active</option>
          <option>Suspended</option>
          <option>Revoked</option>
        </select>
      </div>

      {/* Organizations Table */}
      <div className="rounded-lg border bg-white">
        <table className="w-full">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                Organization
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                License Type
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                Users
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                Created
              </th>
              <th className="px-6 py-3 text-right text-sm font-medium text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {[
              {
                name: 'Acme Healthcare',
                license: 'PROFESSIONAL_MEDICAL',
                status: 'active',
                users: 12,
                created: '2025-11-15',
              },
              {
                name: 'Legal Partners LLP',
                license: 'PROFESSIONAL_LEGAL',
                status: 'active',
                users: 5,
                created: '2025-12-01',
              },
              {
                name: 'Community Clinic',
                license: 'COMMUNITY_PLUS',
                status: 'active',
                users: 3,
                created: '2026-01-10',
              },
            ].map((org, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                      <Building2 className="h-5 w-5 text-emerald-600" />
                    </div>
                    <span className="font-medium text-gray-900">
                      {org.name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                    {org.license}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                    {org.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">{org.users}</td>
                <td className="px-6 py-4 text-gray-600">{org.created}</td>
                <td className="px-6 py-4 text-right">
                  <button className="text-sm text-emerald-600 hover:text-emerald-700">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
