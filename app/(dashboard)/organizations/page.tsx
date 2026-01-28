'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Search,
  X,
  Loader2,
  RefreshCw,
  ChevronRight,
  Users,
} from 'lucide-react';

// Organization types from proto
const ORG_TYPES = {
  ORG_TYPE_UNSPECIFIED: 'Unknown',
  ORG_INTERNAL: 'Internal',
  ORG_PARTNER: 'Partner',
  ORG_LICENSEE: 'Licensee',
  ORG_COMMUNITY: 'Community',
} as const;

// Badge colors per the UI/UX guide
const ORG_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  ORG_INTERNAL: { bg: 'bg-purple-100', text: 'text-purple-700' },
  ORG_PARTNER: { bg: 'bg-blue-100', text: 'text-blue-700' },
  ORG_LICENSEE: { bg: 'bg-teal-100', text: 'text-teal-700' },
  ORG_COMMUNITY: { bg: 'bg-gray-100', text: 'text-gray-700' },
  ORG_TYPE_UNSPECIFIED: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

interface Organization {
  orgId: string;
  name: string;
  legalName?: string;
  primaryEmail: string;
  oauthDomain?: string;
  orgType?: string;
  parentOrgId?: string;
  active: boolean;
  createdAt?: string;
  createdAtIso?: string;
  metadata?: Record<string, string>;
}

interface ListOrganizationsResponse {
  organizations: Organization[];
  nextPageToken?: string;
  totalCount?: number;
}

function OrgTypeBadge({ orgType }: { orgType?: string }) {
  const type = orgType || 'ORG_TYPE_UNSPECIFIED';
  const colors = ORG_TYPE_COLORS[type] || ORG_TYPE_COLORS.ORG_TYPE_UNSPECIFIED;
  const label = ORG_TYPES[type as keyof typeof ORG_TYPES] || 'Unknown';

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      {label}
    </span>
  );
}

async function fetchOrganizations(): Promise<ListOrganizationsResponse> {
  const res = await fetch('/api/registry/organizations');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch organizations');
  }
  return res.json();
}

async function createOrganization(data: {
  name: string;
  primaryEmail: string;
  oauthDomain?: string;
  orgType?: string;
  parentOrgId?: string;
}): Promise<Organization> {
  const res = await fetch('/api/registry/organizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create organization');
  }
  return res.json();
}

function CreateOrgDialog({
  open,
  onClose,
  onSuccess,
  organizations,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organizations: Organization[];
}) {
  const [name, setName] = useState('');
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [oauthDomain, setOauthDomain] = useState('');
  const [orgType, setOrgType] = useState('ORG_COMMUNITY');
  const [parentOrgId, setParentOrgId] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Get available parent orgs (PARTNER type only)
  const partnerOrgs = organizations.filter(
    (org) => org.orgType === 'ORG_PARTNER'
  );

  const mutation = useMutation({
    mutationFn: createOrganization,
    onSuccess: () => {
      onSuccess();
      onClose();
      setName('');
      setPrimaryEmail('');
      setOauthDomain('');
      setOrgType('ORG_COMMUNITY');
      setParentOrgId('');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Auto-fill domain from email
  const handleEmailChange = (email: string) => {
    setPrimaryEmail(email);
    const domain = email.split('@')[1];
    if (domain && !oauthDomain) {
      setOauthDomain(domain);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (orgType === 'ORG_LICENSEE' && !parentOrgId) {
      setError('Licensee organizations require a parent partner organization');
      return;
    }

    mutation.mutate({
      name,
      primaryEmail,
      ...(oauthDomain && { oauthDomain }),
      orgType,
      ...(orgType === 'ORG_LICENSEE' && { parentOrgId }),
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create Organization</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Organization Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="Acme Corporation"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Organization Type
            </label>
            <select
              value={orgType}
              onChange={(e) => {
                setOrgType(e.target.value);
                if (e.target.value !== 'ORG_LICENSEE') {
                  setParentOrgId('');
                }
              }}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            >
              <option value="ORG_COMMUNITY">Community</option>
              <option value="ORG_PARTNER">Partner</option>
              <option value="ORG_LICENSEE">Licensee</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {orgType === 'ORG_COMMUNITY' &&
                'Default type for new organizations'}
              {orgType === 'ORG_PARTNER' &&
                'Licensed partner with delegated authority'}
              {orgType === 'ORG_LICENSEE' &&
                'Under a partner organization (requires parent)'}
            </p>
          </div>

          {orgType === 'ORG_LICENSEE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Parent Organization
              </label>
              <select
                value={parentOrgId}
                onChange={(e) => setParentOrgId(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                required
              >
                <option value="">Select a partner organization...</option>
                {partnerOrgs.map((org) => (
                  <option key={org.orgId} value={org.orgId}>
                    {org.name}
                  </option>
                ))}
              </select>
              {partnerOrgs.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  No partner organizations available. Create a partner first.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Primary Contact Email
            </label>
            <input
              type="email"
              value={primaryEmail}
              onChange={(e) => handleEmailChange(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="admin@acme.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              OAuth Domain (optional)
            </label>
            <input
              type="text"
              value={oauthDomain}
              onChange={(e) => setOauthDomain(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="acme.com"
            />
            <p className="mt-1 text-xs text-gray-500">
              If set, users with this domain auto-join. For personal emails
              (Gmail, etc.), leave blank and add users individually.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Create Organization
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function OrganizationsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
  });

  const organizations = data?.organizations || [];

  // Build a map of org IDs to names for parent display
  const orgNameMap = new Map(organizations.map((o) => [o.orgId, o.name]));

  // Filter organizations
  const filteredOrgs = organizations.filter((org) => {
    const matchesSearch =
      !searchQuery ||
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.orgId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.primaryEmail?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && org.active) ||
      (statusFilter === 'inactive' && !org.active);

    const matchesType = typeFilter === 'all' || org.orgType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Count by type for stats
  const typeCounts = organizations.reduce(
    (acc, org) => {
      const type = org.orgType || 'ORG_TYPE_UNSPECIFIED';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
          <p className="mt-1 text-gray-600">
            Manage partner organizations and their access
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
        >
          <Plus className="h-5 w-5" />
          New Organization
        </button>
      </div>

      {/* Stats by Type */}
      {!isLoading && !error && organizations.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          {(
            [
              'ORG_PARTNER',
              'ORG_LICENSEE',
              'ORG_COMMUNITY',
              'ORG_INTERNAL',
            ] as const
          ).map((type) => {
            const colors = ORG_TYPE_COLORS[type];
            const label = ORG_TYPES[type];
            const count = typeCounts[type] || 0;
            return (
              <button
                key={type}
                onClick={() =>
                  setTypeFilter(typeFilter === type ? 'all' : type)
                }
                className={`rounded-lg border p-4 text-left transition-colors ${
                  typeFilter === type
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${colors.text}`}>
                    {label}
                  </span>
                  <Users className={`h-4 w-4 ${colors.text}`} />
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">{count}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border py-2 pl-10 pr-4"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border px-3 py-2"
        >
          <option value="all">All Types</option>
          <option value="ORG_INTERNAL">Internal</option>
          <option value="ORG_PARTNER">Partner</option>
          <option value="ORG_LICENSEE">Licensee</option>
          <option value="ORG_COMMUNITY">Community</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border px-3 py-2"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
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
            Error loading organizations: {(error as Error).message}
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
      {!isLoading && !error && filteredOrgs.length === 0 && (
        <div className="rounded-lg border bg-white p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No organizations found
          </h3>
          <p className="mt-2 text-gray-500">
            {searchQuery || typeFilter !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'Get started by creating your first organization'}
          </p>
          {!searchQuery && typeFilter === 'all' && (
            <button
              onClick={() => setShowCreateDialog(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
            >
              <Plus className="h-5 w-5" />
              New Organization
            </button>
          )}
        </div>
      )}

      {/* Organizations Table */}
      {!isLoading && !error && filteredOrgs.length > 0 && (
        <div className="rounded-lg border bg-white">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                  Domain
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                  Primary Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredOrgs.map((org) => (
                <tr key={org.orgId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                        <Building2 className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {org.name}
                        </div>
                        {org.parentOrgId && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <ChevronRight className="h-3 w-3" />
                            <span>
                              {orgNameMap.get(org.parentOrgId) ||
                                org.parentOrgId}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <OrgTypeBadge orgType={org.orgType} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded bg-gray-100 px-2 py-1 font-mono text-sm">
                      {org.oauthDomain || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {org.primaryEmail || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        org.active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {org.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
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
      )}

      {/* Create Dialog */}
      <CreateOrgDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['organizations'] });
        }}
        organizations={organizations}
      />
    </div>
  );
}
