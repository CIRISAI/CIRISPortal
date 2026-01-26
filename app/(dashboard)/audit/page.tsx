import {
  ScrollText,
  Filter,
  Download,
  CheckCircle,
  AlertCircle,
  Key,
  User,
} from 'lucide-react';

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Log</h1>
          <p className="mt-1 text-gray-600">
            Cryptographically signed record of all operations
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50">
          <Download className="h-5 w-5" />
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <Filter className="h-5 w-5 text-gray-400" />
          <select className="border-none bg-transparent text-sm focus:outline-none">
            <option>All Operations</option>
            <option>Key Operations</option>
            <option>User Management</option>
            <option>License Changes</option>
          </select>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <select className="border-none bg-transparent text-sm focus:outline-none">
            <option>Last 24 hours</option>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>All time</option>
          </select>
        </div>
      </div>

      {/* Audit Entries */}
      <div className="rounded-lg border bg-white">
        <div className="divide-y">
          {[
            {
              id: 'audit_001',
              operation: 'key.rotate',
              actor: 'jane@acme.com',
              target: 'k_abc123',
              status: 'success',
              timestamp: '2026-01-26 09:45:12 UTC',
              icon: Key,
            },
            {
              id: 'audit_002',
              operation: 'user.invite',
              actor: 'admin@ciris.ai',
              target: 'john@acme.com',
              status: 'success',
              timestamp: '2026-01-26 08:30:00 UTC',
              icon: User,
            },
            {
              id: 'audit_003',
              operation: 'key.sign',
              actor: 'system',
              target: 'PartnerRecord:p_abc123',
              status: 'success',
              timestamp: '2026-01-26 08:15:33 UTC',
              icon: Key,
            },
            {
              id: 'audit_004',
              operation: 'auth.login',
              actor: 'jane@acme.com',
              target: '-',
              status: 'success',
              timestamp: '2026-01-26 08:00:12 UTC',
              icon: User,
            },
          ].map((entry) => {
            const Icon = entry.icon;
            return (
              <div key={entry.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-gray-100 p-2">
                    <Icon className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {entry.operation}
                      </span>
                      {entry.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      <span className="font-medium">{entry.actor}</span>
                      {' → '}
                      <span className="font-mono">{entry.target}</span>
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {entry.timestamp}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs text-gray-400">
                      {entry.id}
                    </p>
                    <button className="mt-1 text-xs text-emerald-600 hover:text-emerald-700">
                      View signature
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Signature Verification Info */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex gap-3">
          <ScrollText className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-500" />
          <div>
            <h3 className="font-medium text-gray-700">
              Cryptographic Audit Trail
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              All entries are signed with Ed25519 and hash-chained to previous
              entries. Click &quot;View signature&quot; on any entry to verify
              its authenticity and chain integrity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
