'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Search, X, Loader2, RefreshCw } from 'lucide-react';

interface Organization {
  orgId: string;
  name: string;
  legalName?: string;
  primaryEmail: string;
  oauthDomain?: string;
  active: boolean;
  createdAt?: string;
  metadata?: Record<string, string>;
}

interface ListOrganizationsResponse {
  organizations: Organization[];
  nextPageToken?: string;
  totalCount?: number;
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
  oauthDomain: string;
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
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [oauthDomain, setOauthDomain] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createOrganization,
    onSuccess: () => {
      onSuccess();
      onClose();
      setName('');
      setPrimaryEmail('');
      setOauthDomain('');
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
    mutation.mutate({ name, primaryEmail, oauthDomain });
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
              OAuth Domain
            </label>
            <input
              type="text"
              value={oauthDomain}
              onChange={(e) => setOauthDomain(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="acme.com"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Users with this email domain can log in to this organization
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
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
  });

  const organizations = data?.organizations || [];

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

    return matchesSearch && matchesStatus;
  });

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

      {/* Search and Filters */}
      <div className="flex gap-4">
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
            {searchQuery
              ? 'Try adjusting your search criteria'
              : 'Get started by creating your first organization'}
          </p>
          {!searchQuery && (
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
                  Domain
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                  Primary Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                  Status
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
                        <div className="font-mono text-sm text-gray-500">
                          {org.orgId}
                        </div>
                      </div>
                    </div>
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
                  <td className="px-6 py-4 text-gray-600">
                    {org.createdAt
                      ? new Date(org.createdAt).toLocaleDateString()
                      : '-'}
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
      />
    </div>
  );
}
