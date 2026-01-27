/**
 * Registry SDK React Query Hooks
 *
 * React Query hooks for interacting with the CIRIS Registry API v1.1.0
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
  // Core types
  Organization,
  OrgUser,
  PartnerKeyRecord,
  AuditEntry,
  PartnerRecord,
  KeyEscrow,
  WebhookConfig,
  ComplianceReport,
  HealthCheckResponse,
  MetricsResponse,
  PartnerActivityResponse,
  EmergencyStatusResponse,
  // Request types
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  CreateOrgUserRequest,
  UpdateOrgUserRequest,
  GenerateKeyPairRequest,
  RotateKeyRequest,
  RevokeKeyRequest,
  RequestKeyEscrowRequest,
  RequestKeyRecoveryRequest,
  AuditLogFilters,
  ExportAuditLogRequest,
  GenerateComplianceReportRequest,
  RegisterWebhookRequest,
  ListKeysRequest,
  ListOrgUsersRequest,
  ListOrganizationsRequest,
  ListExpiringLicensesRequest,
  // Response types
  PaginatedResponse,
  AdminResponse,
  RotateKeyResponse,
  KeyEscrowResponse,
  KeyRecoveryResponse,
  ExportAuditLogResponse,
  ListWebhooksResponse,
  ListExpiringLicensesResponse,
} from './types';

import {
  OrgRole,
  KeyRotationMode,
  KeyEscrowType,
  ComplianceFramework,
  AuditExportFormat,
} from './types';

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Query key factory for consistent cache key management
 */
export const registryKeys = {
  all: ['registry'] as const,

  // Health & Monitoring
  health: () => [...registryKeys.all, 'health'] as const,
  healthCheck: (includeDiagnostics?: boolean) =>
    [...registryKeys.health(), { includeDiagnostics }] as const,
  metrics: (timeRangeMinutes?: number) =>
    [...registryKeys.health(), 'metrics', { timeRangeMinutes }] as const,
  emergency: () => [...registryKeys.all, 'emergency'] as const,

  // Organizations
  organizations: () => [...registryKeys.all, 'organizations'] as const,
  organizationsList: (params?: ListOrganizationsRequest) =>
    [...registryKeys.organizations(), 'list', params] as const,
  organization: (orgId: string) =>
    [...registryKeys.organizations(), orgId] as const,

  // Users
  users: () => [...registryKeys.all, 'users'] as const,
  orgUsers: (orgId: string, params?: Omit<ListOrgUsersRequest, 'orgId'>) =>
    [...registryKeys.users(), 'org', orgId, params] as const,
  user: (userId: string) => [...registryKeys.users(), userId] as const,
  userByEmail: (email: string) =>
    [...registryKeys.users(), 'email', email] as const,

  // Keys
  keys: () => [...registryKeys.all, 'keys'] as const,
  orgKeys: (orgId: string, params?: Omit<ListKeysRequest, 'orgId'>) =>
    [...registryKeys.keys(), 'org', orgId, params] as const,
  key: (orgId: string, keyId: string) =>
    [...registryKeys.keys(), orgId, keyId] as const,

  // Key Escrows
  escrows: () => [...registryKeys.all, 'escrows'] as const,
  orgEscrows: (orgId: string) =>
    [...registryKeys.escrows(), 'org', orgId] as const,

  // Partners
  partners: () => [...registryKeys.all, 'partners'] as const,
  partner: (partnerId: string) =>
    [...registryKeys.partners(), partnerId] as const,
  partnerActivity: (partnerId: string) =>
    [...registryKeys.partners(), partnerId, 'activity'] as const,

  // Licenses
  licenses: () => [...registryKeys.all, 'licenses'] as const,
  expiringLicenses: (params?: ListExpiringLicensesRequest) =>
    [...registryKeys.licenses(), 'expiring', params] as const,

  // Audit
  audit: () => [...registryKeys.all, 'audit'] as const,
  auditLog: (filters?: AuditLogFilters) =>
    [...registryKeys.audit(), 'log', filters] as const,

  // Compliance
  compliance: () => [...registryKeys.all, 'compliance'] as const,
  complianceReport: (params: GenerateComplianceReportRequest) =>
    [...registryKeys.compliance(), 'report', params] as const,

  // Webhooks
  webhooks: () => [...registryKeys.all, 'webhooks'] as const,
};

// ============================================================================
// Client Context
// ============================================================================

let clientInstance: RegistryClient | null = null;

/**
 * Get or create a Registry client
 */
export function useRegistryClient(
  config?: RegistryClientConfig
): RegistryClient {
  if (!clientInstance || config) {
    clientInstance = getRegistryClient(config);
  }
  return clientInstance;
}

// ============================================================================
// Error Type
// ============================================================================

type RegistryError = RegistryApiError | RegistryNetworkError;

// ============================================================================
// Health & Monitoring Hooks
// ============================================================================

/**
 * Hook to check registry health
 */
export function useHealthCheck(
  includeDiagnostics = false,
  options?: Omit<
    UseQueryOptions<HealthCheckResponse, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<HealthCheckResponse, RegistryError>({
    queryKey: registryKeys.healthCheck(includeDiagnostics),
    queryFn: () => client.healthCheck(includeDiagnostics),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30s
    ...options,
  });
}

/**
 * Hook to get registry metrics
 */
export function useMetrics(
  timeRangeMinutes = 60,
  options?: Omit<
    UseQueryOptions<MetricsResponse, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<MetricsResponse, RegistryError>({
    queryKey: registryKeys.metrics(timeRangeMinutes),
    queryFn: () => client.getMetrics(timeRangeMinutes),
    staleTime: 60 * 1000, // 1 minute
    ...options,
  });
}

/**
 * Hook to get emergency status
 */
export function useEmergencyStatus(
  options?: Omit<
    UseQueryOptions<EmergencyStatusResponse, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<EmergencyStatusResponse, RegistryError>({
    queryKey: registryKeys.emergency(),
    queryFn: () => client.getEmergencyStatus(),
    staleTime: 10 * 1000, // 10 seconds
    ...options,
  });
}

// ============================================================================
// Organization Hooks
// ============================================================================

/**
 * Hook to fetch organizations
 */
export function useOrganizations(
  params?: ListOrganizationsRequest,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<Organization>, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<PaginatedResponse<Organization>, RegistryError>({
    queryKey: registryKeys.organizationsList(params),
    queryFn: () => client.getOrganizations(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook to fetch a single organization
 */
export function useOrganization(
  orgId: string,
  options?: Omit<
    UseQueryOptions<Organization, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<Organization, RegistryError>({
    queryKey: registryKeys.organization(orgId),
    queryFn: () => client.getOrganization(orgId),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook to create an organization
 */
export function useCreateOrganization(
  options?: Omit<
    UseMutationOptions<AdminResponse, RegistryError, CreateOrganizationRequest>,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<AdminResponse, RegistryError, CreateOrganizationRequest>({
    mutationFn: (data) => client.createOrganization(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.organizations(),
      });
    },
    ...options,
  });
}

/**
 * Hook to update an organization
 */
export function useUpdateOrganization(
  options?: Omit<
    UseMutationOptions<AdminResponse, RegistryError, UpdateOrganizationRequest>,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<AdminResponse, RegistryError, UpdateOrganizationRequest>({
    mutationFn: (data) => client.updateOrganization(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.organizations(),
      });
      queryClient.invalidateQueries({
        queryKey: registryKeys.organization(variables.organization.orgId),
      });
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
  params: ListOrgUsersRequest,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<OrgUser>, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();
  const { orgId, ...restParams } = params;

  return useQuery<PaginatedResponse<OrgUser>, RegistryError>({
    queryKey: registryKeys.orgUsers(orgId, restParams),
    queryFn: () => client.getOrgUsers(params),
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
}

/**
 * Hook to fetch a single user
 */
export function useOrgUser(
  userId: string,
  options?: Omit<
    UseQueryOptions<OrgUser, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<OrgUser, RegistryError>({
    queryKey: registryKeys.user(userId),
    queryFn: () => client.getOrgUser(userId),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
}

/**
 * Hook to fetch a user by email
 */
export function useOrgUserByEmail(
  email: string,
  options?: Omit<
    UseQueryOptions<OrgUser | null, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<OrgUser | null, RegistryError>({
    queryKey: registryKeys.userByEmail(email),
    queryFn: () => client.getOrgUserByEmail(email),
    enabled: !!email,
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
}

/**
 * Hook to create a user
 */
export function useCreateOrgUser(
  options?: Omit<
    UseMutationOptions<AdminResponse, RegistryError, CreateOrgUserRequest>,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<AdminResponse, RegistryError, CreateOrgUserRequest>({
    mutationFn: (data) => client.createOrgUser(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.orgUsers(variables.user.orgId),
      });
    },
    ...options,
  });
}

/**
 * Hook to update a user
 */
export function useUpdateOrgUser(
  options?: Omit<
    UseMutationOptions<AdminResponse, RegistryError, UpdateOrgUserRequest>,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<AdminResponse, RegistryError, UpdateOrgUserRequest>({
    mutationFn: (data) => client.updateOrgUser(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.users(),
      });
      if (variables.user.userId) {
        queryClient.invalidateQueries({
          queryKey: registryKeys.user(variables.user.userId),
        });
      }
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
      AdminResponse,
      RegistryError,
      { orgId: string; userId: string; role: OrgRole }
    >,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<
    AdminResponse,
    RegistryError,
    { orgId: string; userId: string; role: OrgRole }
  >({
    mutationFn: ({ orgId, userId, role }) =>
      client.updateUserRole(orgId, userId, role),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.orgUsers(variables.orgId),
      });
      queryClient.invalidateQueries({
        queryKey: registryKeys.user(variables.userId),
      });
    },
    ...options,
  });
}

/**
 * Hook to deactivate a user
 */
export function useDeactivateUser(
  options?: Omit<
    UseMutationOptions<AdminResponse, RegistryError, string>,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<AdminResponse, RegistryError, string>({
    mutationFn: (userId) => client.deactivateUser(userId),
    onSuccess: (_data, userId) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.users(),
      });
      queryClient.invalidateQueries({
        queryKey: registryKeys.user(userId),
      });
    },
    ...options,
  });
}

// ============================================================================
// Key Management Hooks
// ============================================================================

/**
 * Hook to list keys for an organization
 */
export function useOrgKeys(
  params: ListKeysRequest,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<PartnerKeyRecord>, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();
  const { orgId, ...restParams } = params;

  return useQuery<PaginatedResponse<PartnerKeyRecord>, RegistryError>({
    queryKey: registryKeys.orgKeys(orgId, restParams),
    queryFn: () => client.listKeys(params),
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
}

/**
 * Hook to get a specific key
 */
export function useKey(
  orgId: string,
  keyId: string,
  options?: Omit<
    UseQueryOptions<PartnerKeyRecord, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<PartnerKeyRecord, RegistryError>({
    queryKey: registryKeys.key(orgId, keyId),
    queryFn: () => client.getKey(orgId, keyId),
    enabled: !!orgId && !!keyId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
}

/**
 * Hook to generate a new key pair
 */
export function useGenerateKeyPair(
  options?: Omit<
    UseMutationOptions<PartnerKeyRecord, RegistryError, GenerateKeyPairRequest>,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<PartnerKeyRecord, RegistryError, GenerateKeyPairRequest>({
    mutationFn: (data) => client.generateKeyPair(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.orgKeys(variables.orgId),
      });
    },
    ...options,
  });
}

/**
 * Hook to activate a pending key
 */
export function useActivateKey(
  options?: Omit<
    UseMutationOptions<
      AdminResponse,
      RegistryError,
      { orgId: string; keyId: string; requesterUserId: string }
    >,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<
    AdminResponse,
    RegistryError,
    { orgId: string; keyId: string; requesterUserId: string }
  >({
    mutationFn: ({ orgId, keyId, requesterUserId }) =>
      client.activateKey(orgId, keyId, requesterUserId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.orgKeys(variables.orgId),
      });
      queryClient.invalidateQueries({
        queryKey: registryKeys.key(variables.orgId, variables.keyId),
      });
    },
    ...options,
  });
}

/**
 * Hook to rotate a key
 */
export function useRotateKey(
  options?: Omit<
    UseMutationOptions<RotateKeyResponse, RegistryError, RotateKeyRequest>,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<RotateKeyResponse, RegistryError, RotateKeyRequest>({
    mutationFn: (data) => client.rotateKey(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.orgKeys(variables.orgId),
      });
    },
    ...options,
  });
}

/**
 * Hook to revoke a key
 */
export function useRevokeKey(
  options?: Omit<
    UseMutationOptions<AdminResponse, RegistryError, RevokeKeyRequest>,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<AdminResponse, RegistryError, RevokeKeyRequest>({
    mutationFn: (data) => client.revokeKey(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.orgKeys(variables.orgId),
      });
      queryClient.invalidateQueries({
        queryKey: registryKeys.key(variables.orgId, variables.keyId),
      });
    },
    ...options,
  });
}

// ============================================================================
// Key Escrow Hooks
// ============================================================================

/**
 * Hook to list key escrows for an organization
 */
export function useKeyEscrows(
  orgId: string,
  options?: Omit<
    UseQueryOptions<{ escrows: KeyEscrow[] }, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<{ escrows: KeyEscrow[] }, RegistryError>({
    queryKey: registryKeys.orgEscrows(orgId),
    queryFn: () => client.listKeyEscrows(orgId),
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
}

/**
 * Hook to request key escrow
 */
export function useRequestKeyEscrow(
  options?: Omit<
    UseMutationOptions<
      KeyEscrowResponse,
      RegistryError,
      RequestKeyEscrowRequest
    >,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<KeyEscrowResponse, RegistryError, RequestKeyEscrowRequest>(
    {
      mutationFn: (data) => client.requestKeyEscrow(data),
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: registryKeys.orgEscrows(variables.orgId),
        });
        queryClient.invalidateQueries({
          queryKey: registryKeys.orgKeys(variables.orgId),
        });
      },
      ...options,
    }
  );
}

/**
 * Hook to request key recovery
 */
export function useRequestKeyRecovery(
  options?: Omit<
    UseMutationOptions<
      KeyRecoveryResponse,
      RegistryError,
      RequestKeyRecoveryRequest
    >,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<
    KeyRecoveryResponse,
    RegistryError,
    RequestKeyRecoveryRequest
  >({
    mutationFn: (data) => client.requestKeyRecovery(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.orgEscrows(variables.orgId),
      });
      queryClient.invalidateQueries({
        queryKey: registryKeys.orgKeys(variables.orgId),
      });
    },
    ...options,
  });
}

// ============================================================================
// Partner Hooks
// ============================================================================

/**
 * Hook to lookup a partner
 */
export function usePartner(
  partnerId: string,
  options?: Omit<
    UseQueryOptions<PartnerRecord | null, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<PartnerRecord | null, RegistryError>({
    queryKey: registryKeys.partner(partnerId),
    queryFn: () => client.lookupPartner(partnerId),
    enabled: !!partnerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook to get partner activity
 */
export function usePartnerActivity(
  partnerId: string,
  options?: Omit<
    UseQueryOptions<PartnerActivityResponse, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<PartnerActivityResponse, RegistryError>({
    queryKey: registryKeys.partnerActivity(partnerId),
    queryFn: () => client.getPartnerActivity(partnerId),
    enabled: !!partnerId,
    staleTime: 15 * 60 * 1000, // 15 minutes
    ...options,
  });
}

/**
 * Hook to list expiring licenses
 */
export function useExpiringLicenses(
  params?: ListExpiringLicensesRequest,
  options?: Omit<
    UseQueryOptions<ListExpiringLicensesResponse, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<ListExpiringLicensesResponse, RegistryError>({
    queryKey: registryKeys.expiringLicenses(params),
    queryFn: () => client.listExpiringLicenses(params),
    staleTime: 60 * 60 * 1000, // 1 hour
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
    staleTime: 0, // Always fetch fresh
    ...options,
  });
}

/**
 * Hook to export audit log
 */
export function useExportAuditLog(
  options?: Omit<
    UseMutationOptions<
      ExportAuditLogResponse,
      RegistryError,
      ExportAuditLogRequest
    >,
    'mutationFn'
  >
) {
  const client = useRegistryClient();

  return useMutation<
    ExportAuditLogResponse,
    RegistryError,
    ExportAuditLogRequest
  >({
    mutationFn: (data) => client.exportAuditLog(data),
    ...options,
  });
}

// ============================================================================
// Compliance Hooks
// ============================================================================

/**
 * Hook to generate compliance report
 */
export function useGenerateComplianceReport(
  options?: Omit<
    UseMutationOptions<
      ComplianceReport,
      RegistryError,
      GenerateComplianceReportRequest
    >,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<
    ComplianceReport,
    RegistryError,
    GenerateComplianceReportRequest
  >({
    mutationFn: (data) => client.generateComplianceReport(data),
    onSuccess: (data, variables) => {
      // Cache the report
      queryClient.setQueryData(registryKeys.complianceReport(variables), data);
    },
    ...options,
  });
}

/**
 * Hook to fetch a cached compliance report
 */
export function useComplianceReport(
  params: GenerateComplianceReportRequest,
  options?: Omit<
    UseQueryOptions<ComplianceReport, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<ComplianceReport, RegistryError>({
    queryKey: registryKeys.complianceReport(params),
    queryFn: () => client.generateComplianceReport(params),
    staleTime: 60 * 60 * 1000, // 1 hour
    ...options,
  });
}

// ============================================================================
// Webhook Hooks
// ============================================================================

/**
 * Hook to list webhooks
 */
export function useWebhooks(
  options?: Omit<
    UseQueryOptions<ListWebhooksResponse, RegistryError>,
    'queryKey' | 'queryFn'
  >
) {
  const client = useRegistryClient();

  return useQuery<ListWebhooksResponse, RegistryError>({
    queryKey: registryKeys.webhooks(),
    queryFn: () => client.listWebhooks(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook to register a webhook
 */
export function useRegisterWebhook(
  options?: Omit<
    UseMutationOptions<AdminResponse, RegistryError, RegisterWebhookRequest>,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<AdminResponse, RegistryError, RegisterWebhookRequest>({
    mutationFn: (data) => client.registerWebhook(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.webhooks(),
      });
    },
    ...options,
  });
}

/**
 * Hook to delete a webhook
 */
export function useDeleteWebhook(
  options?: Omit<
    UseMutationOptions<AdminResponse, RegistryError, string>,
    'mutationFn'
  >
) {
  const client = useRegistryClient();
  const queryClient = useQueryClient();

  return useMutation<AdminResponse, RegistryError, string>({
    mutationFn: (webhookId) => client.deleteWebhook(webhookId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: registryKeys.webhooks(),
      });
    },
    ...options,
  });
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export {
  OrgRole,
  KeyRotationMode,
  KeyEscrowType,
  ComplianceFramework,
  AuditExportFormat,
};
