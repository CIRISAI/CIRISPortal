import { Key, RefreshCw, Download, Copy, Shield } from 'lucide-react';

export default function KeysPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Key Management</h1>
        <p className="mt-1 text-gray-600">
          Manage cryptographic signing keys for your organization
        </p>
      </div>

      {/* Active Key Pair */}
      <div className="rounded-lg border bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2">
              <Key className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Active Key Pair</h2>
              <p className="text-sm text-gray-500">
                Created: 2026-01-15 | Key ID: k_abc123
              </p>
            </div>
          </div>
          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
            Active
          </span>
        </div>

        <div className="space-y-4">
          {/* Ed25519 Public Key */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Public Key (Ed25519 - Classical)
              </label>
              <button className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700">
                <Copy className="h-4 w-4" />
                Copy
              </button>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 font-mono text-sm text-gray-700">
              ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKx...truncated...
            </div>
          </div>

          {/* ML-DSA-65 Public Key */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Public Key (ML-DSA-65 - Post-Quantum)
              </label>
              <button className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700">
                <Copy className="h-4 w-4" />
                Copy
              </button>
            </div>
            <div className="max-h-24 overflow-hidden rounded-lg bg-gray-50 p-3 font-mono text-sm text-gray-700">
              -----BEGIN PUBLIC KEY-----
              MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...truncated...
              -----END PUBLIC KEY-----
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button className="flex items-center gap-2 rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50">
            <Download className="h-5 w-5" />
            Download Public Keys
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 text-yellow-700 hover:bg-yellow-100">
            <RefreshCw className="h-5 w-5" />
            Rotate Keys
          </button>
        </div>
      </div>

      {/* Custody Info */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-3">
          <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
          <div>
            <h3 className="font-medium text-blue-900">Custodied Keys</h3>
            <p className="mt-1 text-sm text-blue-700">
              Your private keys are securely stored and managed by CIRIS. All
              signing operations are authenticated and logged. You can download
              your public keys at any time to register with external systems.
            </p>
          </div>
        </div>
      </div>

      {/* Key History */}
      <div className="rounded-lg border bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold">Key History</h2>
        </div>
        <table className="w-full">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                Key ID
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                Created
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                Rotated
              </th>
              <th className="px-6 py-3 text-right text-sm font-medium text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr>
              <td className="px-6 py-4 font-mono text-sm">k_abc123</td>
              <td className="px-6 py-4">
                <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                  Active
                </span>
              </td>
              <td className="px-6 py-4 text-gray-600">2026-01-15</td>
              <td className="px-6 py-4 text-gray-600">-</td>
              <td className="px-6 py-4 text-right">
                <button className="text-sm text-emerald-600 hover:text-emerald-700">
                  Details
                </button>
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 font-mono text-sm">k_xyz789</td>
              <td className="px-6 py-4">
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                  Rotated
                </span>
              </td>
              <td className="px-6 py-4 text-gray-600">2025-06-01</td>
              <td className="px-6 py-4 text-gray-600">2026-01-15</td>
              <td className="px-6 py-4 text-right">
                <button className="text-sm text-emerald-600 hover:text-emerald-700">
                  Details
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
