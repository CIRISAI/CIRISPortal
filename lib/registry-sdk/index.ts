/**
 * CIRIS Registry SDK
 *
 * TypeScript SDK for interacting with the CIRIS Registry API v1.1.0
 *
 * @example
 * ```typescript
 * import { RegistryClient, useOrganizations, useOrgKeys } from '@/lib/registry-sdk';
 *
 * // Using the client directly
 * const client = new RegistryClient({
 *   getAuthToken: () => session?.accessToken,
 * });
 * const orgs = await client.getOrganizations();
 *
 * // Using React Query hooks
 * function OrganizationList() {
 *   const { data: orgs, isLoading } = useOrganizations();
 *   const { data: keys } = useOrgKeys({ orgId: 'org-123' });
 *
 *   // ...
 * }
 * ```
 */

// Export all types
export * from './types';

// Client
export {
  RegistryClient,
  RegistryApiError,
  RegistryNetworkError,
  getRegistryClient,
  resetRegistryClient,
  consoleLogger,
  noopLogger,
  type RegistryClientConfig,
  type Logger,
  type LogEntry,
  type LogLevel,
} from './client';

// Hooks
export {
  // Query keys for manual cache management
  registryKeys,
  // Client hook
  useRegistryClient,
  // Health & Monitoring
  useHealthCheck,
  useMetrics,
  useEmergencyStatus,
  // Organization hooks
  useOrganizations,
  useOrganization,
  useCreateOrganization,
  useUpdateOrganization,
  // User hooks
  useOrgUsers,
  useOrgUser,
  useOrgUserByEmail,
  useCreateOrgUser,
  useUpdateOrgUser,
  useUpdateUserRole,
  useDeactivateUser,
  // Key hooks
  useOrgKeys,
  useKey,
  useGenerateKeyPair,
  useActivateKey,
  useRotateKey,
  useRevokeKey,
  // Key Escrow hooks
  useKeyEscrows,
  useRequestKeyEscrow,
  useRequestKeyRecovery,
  // Partner hooks
  usePartner,
  usePartnerActivity,
  useExpiringLicenses,
  // Audit hooks
  useAuditLog,
  useExportAuditLog,
  // Compliance hooks
  useGenerateComplianceReport,
  useComplianceReport,
  // Webhook hooks
  useWebhooks,
  useRegisterWebhook,
  useDeleteWebhook,
} from './hooks';
