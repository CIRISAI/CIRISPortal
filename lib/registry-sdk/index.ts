/**
 * CIRIS Registry SDK
 *
 * TypeScript SDK for interacting with the CIRIS Registry API
 *
 * @example
 * ```typescript
 * import { RegistryClient, useOrganizations, useCreatePartner } from '@/lib/registry-sdk';
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
 *   const createPartner = useCreatePartner();
 *
 *   // ...
 * }
 * ```
 */

// Types
export type {
  // Enums/unions
  OrgRole,
  PartnerStatus,
  CustodyModel,
  // Core entities
  Organization,
  Partner,
  OrgUser,
  AuditEntry,
  PublicKeys,
  PartnerCapabilities,
  // Request types
  CreateOrganizationRequest,
  CreatePartnerRequest,
  InviteUserRequest,
  AuditLogFilters,
  // Response types
  PaginatedResponse,
  ApiErrorResponse,
} from './types';

// Client
export {
  RegistryClient,
  RegistryApiError,
  RegistryNetworkError,
  getRegistryClient,
  resetRegistryClient,
  type RegistryClientConfig,
} from './client';

// Hooks
export {
  // Query keys for manual cache management
  registryKeys,
  // Client hook
  useRegistryClient,
  // Organization hooks
  useOrganizations,
  useOrganization,
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
  // Partner hooks
  usePartners,
  usePartner,
  useCreatePartner,
  useUpdatePartner,
  useSuspendPartner,
  useReactivatePartner,
  // User hooks
  useOrgUsers,
  useInviteUser,
  useUpdateUserRole,
  useRemoveUser,
  // Audit hooks
  useAuditLog,
  useAuditEntry,
  useVerifyAuditEntry,
} from './hooks';
