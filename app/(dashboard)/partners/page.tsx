import { Users, Shield, AlertTriangle } from 'lucide-react';

export default function PartnersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Partners</h1>
        <p className="mt-1 text-gray-600">
          View partner records and capability grants from the registry
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Active Partners
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">24</p>
            </div>
            <div className="rounded-full bg-green-100 p-3">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Professional Licenses
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">18</p>
            </div>
            <div className="rounded-full bg-blue-100 p-3">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Pending Review
              </p>
              <p className="mt-2 text-3xl font-bold text-yellow-600">2</p>
            </div>
            <div className="rounded-full bg-yellow-100 p-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Partner List */}
      <div className="rounded-lg border bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold">Partner Records</h2>
        </div>
        <div className="divide-y">
          {[
            {
              id: 'p_abc123',
              name: 'Acme Healthcare',
              license: 'PROFESSIONAL_MEDICAL',
              capabilities: [
                'domain:medical:triage',
                'domain:medical:diagnosis_support',
              ],
              autonomy: 'A3',
              expires: '2027-01-15',
            },
            {
              id: 'p_def456',
              name: 'Legal Partners LLP',
              license: 'PROFESSIONAL_LEGAL',
              capabilities: [
                'domain:legal:research',
                'domain:legal:document_review',
              ],
              autonomy: 'A2',
              expires: '2026-12-01',
            },
          ].map((partner) => (
            <div key={partner.id} className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{partner.name}</h3>
                  <p className="text-sm text-gray-500">ID: {partner.id}</p>
                </div>
                <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                  Active
                </span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs font-medium text-gray-500">
                    License Type
                  </p>
                  <p className="mt-1 text-sm text-gray-900">
                    {partner.license}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">
                    Max Autonomy
                  </p>
                  <p className="mt-1 text-sm text-gray-900">
                    {partner.autonomy}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Expires</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {partner.expires}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500">
                  Capabilities Granted
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {partner.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
