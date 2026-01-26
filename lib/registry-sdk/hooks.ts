/**
 * Registry SDK React Query Hooks
 *
 * React Query hooks for interacting with the CIRIS Registry API
 */

'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import {
  RegistryClient,
  getRegistryClient,
  type RegistryClientConfig,
  RegistryApiError,
  RegistryNetworkError,
} from './client';
import type {
  Organization,
  Partner,
  OrgUser,
  AuditEntry,
  CreateOrganizationRequest,
  CreatePartnerRequest,
  InviteUserRequest,
  AuditLogFilters,
  PaginatedResponse,
  OrgRole,
} from './types';

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Query key factory for consistent cache key management
 */
export const registryKeys = {
  all: ['registry'] as const,

  // Organizations
  organizations: () => [...registryKeys.all, 'organizations'] as const,
  organization: (id: string) => [...registryKeys.organizations(), id] as const,

  // Partners
  partners: () => [...registryKeys.all, 'partners'] as const,
  partnersList: (orgId?: string) =>
    [...registryKeys.partners(), 'list', { orgId }] as const,
  partner: (id: string) => [...registryKeys.partners(), id] as const,

  // Users
  users: () => [...registryKeys.all, 'users'] as const,
  orgUsers: (orgId: string) => [...registryKeys.users(), 'org', orgId] as const,

  // Audit
  audit: () => [...registryKeys.all, 'audit'] as const,
  auditLog: (filters?: AuditLogFilters) =>
    [...registryKeys.audit(), 'log', filters] as const,
  auditEntry: (id: string) => [...registryKeys.audit(), id] as const,
};

// ============================================================================
// Client Context
// ============================================================================

/**
 * Get or create a Registry client
 * In a real app, you might want to use React Context to provide the client
 */
let clientInstance: RegistryClient | null = null;

export function useRegistryClient(
  config?: RegistryClientConfig
): RegistryClient {
  if (!clientInstance || config) {
    clientInstance = getRegistryClient(config);
  }
  return clientInstance;
}

// ============================================================================
// Organization Hooks
// ============================================================================

type RegistryError = RegistryApiError | RegistryNetworkError;

/**
 * Hook to fetch all organizations
 */
export function useOrganizations(
  options?: Omit<
    UseQueryOptions<Organization[], RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<Organization[], RegistryError>({
    queryKey: registryKeys.organizations(),
    queryFn: () => client.getOrganizations(),
    ...options,
  });
}

/**
 * Hook to fetch a single organization by ID
 */
export function useOrganization(
  id: string,
  options?: Omit<
    UseQueryOptions<Organization, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<Organization, RegistryError>({
    queryKey: registryKeys.organization(id),
    queryFn: () => client.getOrganization(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook to create a new organization
 */
export function useCreateOrganization(
  options?: Omit<
    UseMutationOptions<Organization, RegistryError, CreateOrganizationRequest>,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<Organization, RegistryError, CreateOrganizationRequest>({
    mutationFn: (data) => client.createOrganization(data),
    onSuccess: (newOrg) => {
      // Invalidate the organizations list
      queryClient.invalidateQueries({
        queryKey: registryKeys.organizations(),
      });
      // Optionally pre-populate the individual org cache
      queryClient.setQueryData(registryKeys.organization(newOrg.id), newOrg);
    },
    ...options,
  });
}

/**
 * Hook to update an organization
 */
export function useUpdateOrganization(
  options?: Omit<
    UseMutationOptions<
      Organization,
      RegistryError,
      { id: string; data: Partial<CreateOrganizationRequest> }
    >,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<
    Organization,
    RegistryError,
    { id: string; data: Partial<CreateOrganizationRequest> }
  >({
    mutationFn: ({ id, data }) => client.updateOrganization(id, data),
    onSuccess: (updatedOrg) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.organizations(),
      });
      queryClient.setQueryData(
        registryKeys.organization(updatedOrg.id),
        updatedOrg
      );
    },
    ...options,
  });
}

/**
 * Hook to delete an organization
 */
export function useDeleteOrganization(
  options?: Omit<UseMutationOptions<void, RegistryError, string>, 'mutationFn'>
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<void, RegistryError, string>({
    mutationFn: (id) => client.deleteOrganization(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.organizations(),
      });
      queryClient.removeQueries({
        queryKey: registryKeys.organization(id),
      });
    },
    ...options,
  });
}

// ============================================================================
// Partner Hooks
// ============================================================================

/**
 * Hook to fetch partners, optionally filtered by organization
 */
export function usePartners(
  orgId?: string,
  options?: Omit<
    UseQueryOptions<Partner[], RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<Partner[], RegistryError>({
    queryKey: registryKeys.partnersList(orgId),
    queryFn: () => client.getPartners(orgId),
    ...options,
  });
}

/**
 * Hook to fetch a single partner by ID
 */
export function usePartner(
  id: string,
  options?: Omit<
    UseQueryOptions<Partner, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<Partner, RegistryError>({
    queryKey: registryKeys.partner(id),
    queryFn: () => client.getPartner(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook to create a new partner
 */
export function useCreatePartner(
  options?: Omit<
    UseMutationOptions<Partner, RegistryError, CreatePartnerRequest>,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<Partner, RegistryError, CreatePartnerRequest>({
    mutationFn: (data) => client.createPartner(data),
    onSuccess: (newPartner) => {
      // Invalidate all partner lists (the new partner could appear in multiple filtered views)
      queryClient.invalidateQueries({
        queryKey: registryKeys.partners(),
      });
      // Pre-populate the individual partner cache
      queryClient.setQueryData(registryKeys.partner(newPartner.id), newPartner);
    },
    ...options,
  });
}

/**
 * Hook to update a partner
 */
export function useUpdatePartner(
  options?: Omit<
    UseMutationOptions<
      Partner,
      RegistryError,
      { id: string; data: Partial<CreatePartnerRequest> }
    >,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<
    Partner,
    RegistryError,
    { id: string; data: Partial<CreatePartnerRequest> }
  >({
    mutationFn: ({ id, data }) => client.updatePartner(id, data),
    onSuccess: (updatedPartner) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.partners(),
      });
      queryClient.setQueryData(
        registryKeys.partner(updatedPartner.id),
        updatedPartner
      );
    },
    ...options,
  });
}

/**
 * Hook to suspend a partner
 */
export function useSuspendPartner(
  options?: Omit<
    UseMutationOptions<Partner, RegistryError, string>,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<Partner, RegistryError, string>({
    mutationFn: (id) => client.suspendPartner(id),
    onSuccess: (updatedPartner) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.partners(),
      });
      queryClient.setQueryData(
        registryKeys.partner(updatedPartner.id),
        updatedPartner
      );
    },
    ...options,
  });
}

/**
 * Hook to reactivate a suspended partner
 */
export function useReactivatePartner(
  options?: Omit<
    UseMutationOptions<Partner, RegistryError, string>,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<Partner, RegistryError, string>({
    mutationFn: (id) => client.reactivatePartner(id),
    onSuccess: (updatedPartner) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.partners(),
      });
      queryClient.setQueryData(
        registryKeys.partner(updatedPartner.id),
        updatedPartner
      );
    },
    ...options,
  });
}

// ============================================================================
// User Hooks
// ============================================================================

/**
 * Hook to fetch users in an organization
 */
export function useOrgUsers(
  orgId: string,
  options?: Omit<
    UseQueryOptions<OrgUser[], RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<OrgUser[], RegistryError>({
    queryKey: registryKeys.orgUsers(orgId),
    queryFn: () => client.getOrgUsers(orgId),
    enabled: !!orgId,
    ...options,
  });
}

/**
 * Hook to invite a user to an organization
 */
export function useInviteUser(
  options?: Omit<
    UseMutationOptions<OrgUser, RegistryError, InviteUserRequest>,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<OrgUser, RegistryError, InviteUserRequest>({
    mutationFn: ({ orgId, email, role }) =>
      client.inviteUser(orgId, email, role),
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.orgUsers(newUser.orgId),
      });
    },
    ...options,
  });
}

/**
 * Hook to update a user's role
 */
export function useUpdateUserRole(
  options?: Omit<
    UseMutationOptions<
      OrgUser,
      RegistryError,
      { orgId: string; userId: string; role: OrgRole }
    >,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<
    OrgUser,
    RegistryError,
    { orgId: string; userId: string; role: OrgRole }
  >({
    mutationFn: ({ orgId, userId, role }) =>
      client.updateUserRole(orgId, userId, role),
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.orgUsers(updatedUser.orgId),
      });
    },
    ...options,
  });
}

/**
 * Hook to remove a user from an organization
 */
export function useRemoveUser(
  options?: Omit<
    UseMutationOptions<void, RegistryError, { orgId: string; userId: string }>,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<void, RegistryError, { orgId: string; userId: string }>({
    mutationFn: ({ orgId, userId }) => client.removeUser(orgId, userId),
    onSuccess: (_data, { orgId }) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.orgUsers(orgId),
      });
    },
    ...options,
  });
}

// ============================================================================
// Audit Hooks
// ============================================================================

/**
 * Hook to fetch audit log entries
 */
export function useAuditLog(
  filters?: AuditLogFilters,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<AuditEntry>, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<PaginatedResponse<AuditEntry>, RegistryError>({
    queryKey: registryKeys.auditLog(filters),
    queryFn: () => client.getAuditLog(filters),
    ...options,
  });
}

/**
 * Hook to fetch a single audit entry by ID
 */
export function useAuditEntry(
  id: string,
  options?: Omit<
    UseQueryOptions<AuditEntry, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<AuditEntry, RegistryError>({
    queryKey: registryKeys.auditEntry(id),
    queryFn: () => client.getAuditEntry(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook to verify an audit entry's integrity
 */
export function useVerifyAuditEntry(
  options?: Omit<
    UseMutationOptions<
      { valid: boolean; errors?: string[] },
      RegistryError,
      string
    >,
    'mutationFn'
  >
) {
  const client = useRegistryClient();

  return useMutation<
    { valid: boolean; errors?: string[] },
    RegistryError,
    string
  >({
    mutationFn: (id) => client.verifyAuditEntry(id),
    ...options,
  });
}
