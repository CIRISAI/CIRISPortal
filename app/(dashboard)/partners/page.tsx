'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Shield,
  AlertTriangle,
  Search,
  RefreshCw,
  Loader2,
  Building2,
} from 'lucide-react';

interface PartnerLicense {
  partnerId: string;
  organizationName: string;
  licenseType: string;
  expiresAt: string;
  capabilities: string[];
  maxAutonomyTier: string;
  status: string;
}

interface ListPartnersResponse {
  licenses: PartnerLicense[];
  countExpiringSoon?: number;
  countAlreadyExpired?: number;
}

async function fetchPartners(): Promise<ListPartnersResponse> {
  // Use expiring licenses endpoint with long window to get all partners
  const res = await fetch('/api/admin/partners?within_days=3650');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch partners');
  }
  return res.json();
}

function getStatusBadge(expiresAt: string) {
  const now = new Date();
  const expires = new Date(expiresAt);
  const daysUntil = Math.ceil(
    (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntil < 0) {
    return (
      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
        Expired
      </span>
    );
  }
  if (daysUntil <= 30) {
    return (
      <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
        Expiring Soon
      </span>
    );
  }
  return (
    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
      Active
    </span>
  );
}

export default function PartnersPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['partners-licensees'],
    queryFn: fetchPartners,
  });

  const partners = data?.licenses || [];

  // Calculate stats
  const now = new Date();
  const activeCount = partners.filter(
    (p) => new Date(p.expiresAt) > now
  ).length;
  const expiredCount = partners.filter(
    (p) => new Date(p.expiresAt) <= now
  ).length;
  const expiringSoonCount = partners.filter((p) => {
    const expires = new Date(p.expiresAt);
    const daysUntil = Math.ceil(
      (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntil > 0 && daysUntil <= 30;
  }).length;

  // Filter partners
  const filteredPartners = partners.filter((partner) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      partner.organizationName?.toLowerCase().includes(query) ||
      partner.partnerId?.toLowerCase().includes(query) ||
      partner.licenseType?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Licensees</h1>
          <p className="mt-1 text-gray-600">
            View partner records and capability grants from the registry
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Active Partners
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {isLoading ? '-' : activeCount}
              </p>
            </div>
            <div className="rounded-full bg-green-100 p-3">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Expiring Soon</p>
              <p className="mt-2 text-3xl font-bold text-yellow-600">
                {isLoading ? '-' : expiringSoonCount}
              </p>
            </div>
            <div className="rounded-full bg-yellow-100 p-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Expired</p>
              <p className="mt-2 text-3xl font-bold text-red-600">
                {isLoading ? '-' : expiredCount}
              </p>
            </div>
            <div className="rounded-full bg-red-100 p-3">
              <Shield className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search partners..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border py-2 pl-10 pr-4"
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-700">
            Error loading partners: {(error as Error).message}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm text-red-600 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredPartners.length === 0 && (
        <div className="rounded-lg border bg-white p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No partners found
          </h3>
          <p className="mt-2 text-gray-500">
            {searchQuery
              ? 'Try adjusting your search criteria'
              : 'No partner licenses registered yet'}
          </p>
        </div>
      )}

      {/* Partner List */}
      {!isLoading && !error && filteredPartners.length > 0 && (
        <div className="rounded-lg border bg-white">
          <div className="border-b px-6 py-4">
            <h2 className="font-semibold">
              Partner Records ({filteredPartners.length})
            </h2>
          </div>
          <div className="divide-y">
            {filteredPartners.map((partner) => (
              <div key={partner.partnerId} className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {partner.organizationName || partner.partnerId}
                    </h3>
                    <p className="font-mono text-sm text-gray-500">
                      {partner.partnerId}
                    </p>
                  </div>
                  {getStatusBadge(partner.expiresAt)}
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      License Type
                    </p>
                    <p className="mt-1 text-sm text-gray-900">
                      {partner.licenseType || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      Max Autonomy
                    </p>
                    <p className="mt-1 text-sm text-gray-900">
                      {partner.maxAutonomyTier || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Expires</p>
                    <p className="mt-1 text-sm text-gray-900">
                      {partner.expiresAt
                        ? new Date(partner.expiresAt).toLocaleDateString()
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Status</p>
                    <p className="mt-1 text-sm text-gray-900">
                      {partner.status || '-'}
                    </p>
                  </div>
                </div>

                {partner.capabilities && partner.capabilities.length > 0 && (
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
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
