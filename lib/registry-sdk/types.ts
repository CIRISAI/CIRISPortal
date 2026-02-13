/**
 * Registry SDK Types
 *
 * TypeScript interfaces for the CIRIS Registry API v1.1.0
 * Generated from ciris_registry.proto
 */

// ============================================================================
// Enums - Error Handling
// ============================================================================

/**
 * Machine-parseable error codes with HTTP status mapping
 */
export enum RegistryErrorCode {
  UNSPECIFIED = 0,

  // Standard HTTP/gRPC status codes
  INVALID_ARGUMENT = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  RATE_LIMITED = 429,
  INTERNAL = 500,
  SERVICE_UNAVAILABLE = 503,

  // Agent-specific errors (1000-1999)
  AGENT_NOT_REGISTERED = 1001,
  AGENT_REVOKED = 1002,
  AGENT_DEPRECATED = 1003,
  AGENT_HASH_INVALID = 1004,

  // Partner-specific errors (2000-2999)
  PARTNER_NOT_LICENSED = 2001,
  PARTNER_SUSPENDED = 2002,
  PARTNER_EXPIRED = 2003,
  LICENSE_REVOKED = 2004,
  CAPABILITY_DENIED = 2005,
  AUTONOMY_TIER_EXCEEDED = 2006,

  // Cryptographic/signature errors (3000-3999)
  INVALID_SIGNATURE = 3001,
  SIGNATURE_EXPIRED = 3002,
  KEY_NOT_FOUND = 3003,
  KEY_REVOKED = 3004,
  KEY_PENDING = 3005,
  NO_ACTIVE_KEY = 3006,

  // Organization/user errors (4000-4999)
  ORG_NOT_FOUND = 4001,
  ORG_INACTIVE = 4002,
  USER_NOT_FOUND = 4003,
  USER_INACTIVE = 4004,
  INSUFFICIENT_ROLE = 4005,

  // Infrastructure errors (5000-5999)
  DATABASE_ERROR = 5001,
  MERKLE_PROOF_INVALID = 5002,
  SNAPSHOT_STALE = 5003,
  HSM_UNAVAILABLE = 5004,
  WEBHOOK_DELIVERY_FAILED = 5005,
}

/**
 * Retry guidance for clients
 */
export enum Retryable {
  UNSPECIFIED = 0,
  NO = 1,
  IMMEDIATE = 2,
  BACKOFF = 3,
  AFTER = 4,
}

/**
 * Health status for registry components
 */
export enum HealthStatus {
  UNSPECIFIED = 0,
  SERVING = 1,
  DEGRADED = 2,
  NOT_SERVING = 3,
}

/**
 * Readiness status for K8s probes
 */
export enum ReadinessStatus {
  UNSPECIFIED = 0,
  STARTUP = 1,
  LIVE = 2,
  SHUTDOWN = 3,
}

/**
 * Registry environment
 */
export enum RegistryEnvironment {
  UNSPECIFIED = 0,
  PRODUCTION = 1,
  STAGING = 2,
  CANARY = 3,
  DEVELOPMENT = 4,
}

// ============================================================================
// Enums - Organization & Users
// ============================================================================

/**
 * Role within an organization
 */
export enum OrgRole {
  UNSPECIFIED = 0,
  ORG_ADMIN = 1,
  ORG_KEY_MANAGER = 2,
  ORG_OPERATOR = 3,
  ORG_VIEWER = 4,
}

/** Display names for roles */
export const OrgRoleDisplay: Record<OrgRole, string> = {
  [OrgRole.UNSPECIFIED]: 'Unknown',
  [OrgRole.ORG_ADMIN]: 'Administrator',
  [OrgRole.ORG_KEY_MANAGER]: 'Key Manager',
  [OrgRole.ORG_OPERATOR]: 'Operator',
  [OrgRole.ORG_VIEWER]: 'Viewer',
};

// ============================================================================
// Enums - Key Management
// ============================================================================

/**
 * Status of a key pair
 */
export enum KeyStatus {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  ROTATED = 2,
  REVOKED = 3,
  PENDING = 4,
  ESCROWED = 5,
}

/**
 * Custody model for keys
 */
export enum KeyCustodyModel {
  UNSPECIFIED = 0,
  CUSTODIED = 1,
  SELF_SOVEREIGN = 2,
}

/**
 * Key rotation mode
 */
export enum KeyRotationMode {
  UNSPECIFIED = 0,
  IMMEDIATE = 1,
  STAGED = 2,
  DUAL_SIGN = 3,
}

/**
 * Key escrow type
 */
export enum KeyEscrowType {
  UNSPECIFIED = 0,
  STEWARD = 1,
  ATTORNEY = 2,
  DUAL_CUSTODY = 3,
}

// ============================================================================
// Enums - Partner & License
// ============================================================================

/**
 * Partner status
 */
export enum PartnerStatus {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  SUSPENDED = 2,
  REVOKED = 3,
}

/**
 * License type
 */
export enum LicenseType {
  UNSPECIFIED = 0,
  COMMUNITY = 1,
  COMMUNITY_PLUS = 2,
  PROFESSIONAL_MEDICAL = 10,
  PROFESSIONAL_LEGAL = 11,
  PROFESSIONAL_FINANCIAL = 12,
  PROFESSIONAL_FULL = 20,
}

/**
 * Autonomy tier levels
 */
export enum AutonomyTier {
  UNSPECIFIED = 0,
  A0_ADVISORY = 1,
  A1_LIMITED = 2,
  A2_MODERATE = 3,
  A3_HIGH = 4,
  A4_CRITICAL = 5,
}

// ============================================================================
// Enums - Audit & Compliance
// ============================================================================

/**
 * Audit action types
 */
export enum AuditActionType {
  UNSPECIFIED = 0,
  // Organization actions
  ORG_CREATED = 1,
  ORG_UPDATED = 2,
  ORG_DEACTIVATED = 3,
  // User actions
  USER_CREATED = 10,
  USER_UPDATED = 11,
  USER_DEACTIVATED = 12,
  USER_LOGIN = 13,
  USER_LOGOUT = 14,
  // Key actions
  KEY_GENERATED = 20,
  KEY_ACTIVATED = 21,
  KEY_ROTATED = 22,
  KEY_REVOKED = 23,
  KEY_USED_FOR_SIGNING = 24,
  KEY_ESCROWED = 25,
  KEY_RECOVERED = 26,
  // Partner actions
  PARTNER_REGISTERED = 30,
  PARTNER_UPDATED = 31,
  PARTNER_SUSPENDED = 32,
  PARTNER_REVOKED = 33,
  PARTNER_LICENSE_RENEWED = 34,
  // Agent actions
  AGENT_REGISTERED = 40,
  AGENT_DEPRECATED = 41,
  AGENT_REVOKED = 42,
  // Incident response
  MASS_REVOCATION = 50,
  EMERGENCY_SHUTDOWN_ENABLED = 51,
  EMERGENCY_SHUTDOWN_CLEARED = 52,
  // Registry key actions
  SIGNING_KEY_ROTATED = 60,
  SIGNING_KEY_ACTIVATED = 61,
}

/**
 * Compliance framework types
 */
export enum ComplianceFramework {
  UNSPECIFIED = 0,
  SOC2 = 1,
  HIPAA = 2,
  GDPR = 3,
  ISO27001 = 4,
  PCI_DSS = 5,
}

/**
 * Audit export format
 */
export enum AuditExportFormat {
  UNSPECIFIED = 0,
  JSON = 1,
  CSV = 2,
  JSONL = 3,
  SPLUNK_HEC = 4,
}

/**
 * Incident severity
 */
export enum IncidentSeverity {
  UNSPECIFIED = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * Batch error handling strategy
 */
export enum BatchErrorHandling {
  UNSPECIFIED = 0,
  FAIL_FAST = 1,
  BEST_EFFORT = 2,
  TRANSACTIONAL = 3,
}

// ============================================================================
// Core Interfaces - Request/Response Context
// ============================================================================

/**
 * Request context for tracing
 */
export interface RequestContext {
  requestId: string;
  clientVersion: string;
  userAgent: string;
  requestTimestamp: number;
}

/**
 * Response context for correlation
 */
export interface ResponseContext {
  requestId: string;
  serverTimestamp: number;
  processingTimeMs: number;
  serverVersion: string;
  environment: RegistryEnvironment;
}

/**
 * Structured error detail
 */
export interface ErrorDetail {
  code: RegistryErrorCode;
  message: string;
  retryStatus: Retryable;
  retryAfterSeconds?: number;
  metadata?: Record<string, string>;
  cause?: ErrorDetail;
}

// ============================================================================
// Core Interfaces - Health & Monitoring
// ============================================================================

/**
 * Component health status
 */
export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  metrics?: Record<string, string>;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: HealthStatus;
  readiness: ReadinessStatus;
  components?: ComponentHealth[];
  version?: string;
  buildCommit?: string;
  uptimeSeconds?: number;
  activeConnections?: number;
  cpuUsagePercent?: number;
  memoryUsagePercent?: number;
  databaseHealthy?: boolean;
  replicationLagMs?: number;
  context?: ResponseContext;
}

/**
 * Metrics response
 */
export interface MetricsResponse {
  queriesTotal: number;
  queriesByType: Record<string, number>;
  queryLatencyP50Ms: number;
  queryLatencyP95Ms: number;
  queryLatencyP99Ms: number;
  errorsTotal: number;
  errorsByCode: Record<string, number>;
  signingOperations: number;
  dbConnectionsActive: number;
  dbConnectionsMax: number;
  timestamp: number;
  context?: ResponseContext;
}

// ============================================================================
// Core Interfaces - Organization
// ============================================================================

/**
 * Organization record
 */
export interface Organization {
  orgId: string;
  name: string;
  legalName?: string;
  taxId?: string;
  partnerId?: string;
  primaryEmail: string;
  billingEmail?: string;
  technicalContactEmail?: string;
  complianceContactEmail?: string;
  oauthProvider?: string;
  oauthDomain?: string;
  active: boolean;
  createdAt: number;
  updatedAt?: number;
  createdBy?: string;
  metadata?: Record<string, string>;
}

/**
 * Organization user record
 */
export interface OrgUser {
  userId: string;
  orgId: string;
  email: string;
  name?: string;
  oauthProvider?: string;
  oauthSubject?: string;
  role: OrgRole;
  active: boolean;
  createdAt: number;
  updatedAt?: number;
  lastLoginAt?: number;
  invitedBy?: string;
  mfaEnabled?: boolean;
  mfaMethod?: string;
}

// ============================================================================
// Core Interfaces - Key Management
// ============================================================================

/**
 * Public keys (both algorithms)
 */
export interface PublicKeys {
  ed25519PublicKey?: string; // Base64 encoded
  mlDsa65PublicKey?: string; // Base64 encoded
}

/**
 * Hybrid cryptographic signature
 */
export interface HybridSignature {
  classicalSignature: string; // Base64 encoded
  postQuantumSignature?: string; // Base64 encoded
  timestamp: number;
  keyId: string;
}

/**
 * Partner key record
 */
export interface PartnerKeyRecord {
  keyId: string;
  orgId: string;
  partnerId?: string;
  publicKeys: PublicKeys;
  ed25519Fingerprint: string;
  mlDsa65Fingerprint?: string;
  custodyModel: KeyCustodyModel;
  kvKeyRef?: string;
  status: KeyStatus;
  revocationReason?: string;
  createdAt: number;
  activatedAt?: number;
  rotatedAt?: number;
  revokedAt?: number;
  gracePeriodExpiresAt?: number;
  createdBy?: string;
  rotatedBy?: string;
  revokedBy?: string;
  registrySignature?: HybridSignature;
  escrowId?: string;
}

/**
 * Key escrow record
 */
export interface KeyEscrow {
  escrowId: string;
  keyId: string;
  orgId: string;
  escrowType: KeyEscrowType;
  custodian: string;
  createdAt: number;
  expiresAt?: number;
  status: string;
}

// ============================================================================
// Core Interfaces - Partner
// ============================================================================

/**
 * Partner record (licensed organization)
 */
export interface PartnerRecord {
  partnerId: string;
  organizationName: string;
  organizationId?: string;
  licenseType: LicenseType;
  licenseId?: string;
  issuedAt: number;
  expiresAt: number;
  capabilitiesGranted: string[];
  capabilitiesDenied?: string[];
  maxAutonomyTier: AutonomyTier;
  requiresSupervisor?: boolean;
  geographicRestrictions?: string[];
  deploymentLimit?: number;
  offlineGraceHours?: number;
  technicalContact?: string;
  complianceContact?: string;
  status: PartnerStatus;
  suspensionReason?: string;
  revocationReason?: string;
  statusChangedAt?: number;
  licenseSignature?: HybridSignature;
  registrySignature?: HybridSignature;
  allowedIdentityTemplates?: string[];
}

// ============================================================================
// Core Interfaces - Audit
// ============================================================================

/**
 * Audit entry record
 */
export interface AuditEntry {
  entryId: string;
  timestamp: number;
  actorUserId?: string;
  actorOrgId?: string;
  actorIpAddress?: string;
  actorUserAgent?: string;
  action: AuditActionType;
  targetType?: string;
  targetId?: string;
  description?: string;
  metadata?: Record<string, string>;
  entrySignature?: HybridSignature;
}

// ============================================================================
// Core Interfaces - Compliance
// ============================================================================

/**
 * Key management summary for compliance report
 */
export interface KeyManagementSummary {
  keysGenerated: number;
  keysRotated: number;
  keysRevoked: number;
  oldestActiveKeyAgeDays: number;
  rotationPolicyCompliant: boolean;
}

/**
 * Access control summary for compliance report
 */
export interface AccessControlSummary {
  totalUsers: number;
  adminUsers: number;
  mfaEnabledUsers: number;
  failedLoginAttempts: number;
}

/**
 * Audit summary for compliance report
 */
export interface AuditSummary {
  totalEvents: number;
  auditTrailContinuous: boolean;
  earliestEvent?: number;
  latestEvent?: number;
}

/**
 * Compliance report
 */
export interface ComplianceReport {
  reportId: string;
  framework: ComplianceFramework;
  orgId: string;
  periodStart: number;
  periodEnd: number;
  keyManagement?: KeyManagementSummary;
  accessControl?: AccessControlSummary;
  audit?: AuditSummary;
  attestationStatement?: string;
  reportSignature?: HybridSignature;
  generatedAt: number;
  context?: ResponseContext;
}

/**
 * Expiring license info
 */
export interface ExpiringLicense {
  partnerId: string;
  organizationName: string;
  licenseId: string;
  expiresAt: number;
  daysRemaining: number;
  technicalContact?: string;
  complianceContact?: string;
  renewalStatus?: string;
}

/**
 * Partner activity response
 */
export interface PartnerActivityResponse {
  partnerId: string;
  lastLookupAt?: number;
  lookupsLast30Days?: number;
  lastPortalLogin?: number;
  activeUsers?: number;
  lastKeyRotation?: number;
  daysSinceKeyRotation?: number;
  healthStatus?: string;
  recommendations?: string;
  context?: ResponseContext;
}

// ============================================================================
// Core Interfaces - Webhooks
// ============================================================================

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  webhookId: string;
  url: string;
  subscribedEvents: string[];
  signingSecret?: string;
  active: boolean;
  createdAt: number;
  lastTriggeredAt?: number;
  consecutiveFailures?: number;
}

/**
 * Webhook event
 */
export interface WebhookEvent {
  eventType: string;
  timestamp: number;
  entityType: string;
  entityId: string;
  metadata?: Record<string, string>;
  eventSignature?: HybridSignature;
}

// ============================================================================
// Core Interfaces - Emergency/Incident
// ============================================================================

/**
 * Emergency status response
 */
export interface EmergencyStatusResponse {
  isLocked: boolean;
  lockedAt?: number;
  lockedUntil?: number;
  lockReason?: string;
  severity?: IncidentSeverity;
  allowedOperations?: string[];
  context?: ResponseContext;
}

// ============================================================================
// API Request Types
// ============================================================================

/**
 * Create organization request
 */
export interface CreateOrganizationRequest {
  organization: Omit<Organization, 'orgId' | 'createdAt' | 'updatedAt'>;
}

/**
 * Update organization request
 */
export interface UpdateOrganizationRequest {
  organization: Partial<Organization> & { orgId: string };
}

/**
 * Create org user request
 */
export interface CreateOrgUserRequest {
  user: Omit<OrgUser, 'userId' | 'createdAt' | 'updatedAt'>;
}

/**
 * Update org user request
 */
export interface UpdateOrgUserRequest {
  user: Partial<OrgUser> & { userId: string };
}

/**
 * Generate key pair request
 */
export interface GenerateKeyPairRequest {
  orgId: string;
  requesterUserId: string;
  activateImmediately?: boolean;
}

/**
 * Response from key pair generation, includes one-time private key
 */
export interface GenerateKeyPairResponse {
  keyRecord: PartnerKeyRecord;
  /** Base64-encoded Ed25519 private key (32 bytes). Returned ONCE, never stored. */
  ed25519PrivateKey?: string;
}

/**
 * Rotate key request
 */
export interface RotateKeyRequest {
  orgId: string;
  requesterUserId: string;
  reason?: string;
  mode?: KeyRotationMode;
  gracePeriodHours?: number;
}

/**
 * Revoke key request
 */
export interface RevokeKeyRequest {
  orgId: string;
  keyId: string;
  reason: string;
  requesterUserId: string;
}

/**
 * Request key escrow
 */
export interface RequestKeyEscrowRequest {
  orgId: string;
  keyId: string;
  escrowType: KeyEscrowType;
  requesterUserId: string;
}

/**
 * Request key recovery
 */
export interface RequestKeyRecoveryRequest {
  orgId: string;
  keyId: string;
  escrowId: string;
  reason: string;
  requesterUserId: string;
}

/**
 * Audit log filters
 */
export interface AuditLogFilters {
  orgId?: string;
  startTime?: number;
  endTime?: number;
  actionTypes?: AuditActionType[];
  actorUserId?: string;
  targetType?: string;
  targetId?: string;
  pageSize?: number;
  pageToken?: string;
}

/**
 * Export audit log request
 */
export interface ExportAuditLogRequest {
  orgId: string;
  startTime?: number;
  endTime?: number;
  actionTypes?: AuditActionType[];
  actorUserIds?: string[];
  targetTypes?: string[];
  format?: AuditExportFormat;
  includeSignatures?: boolean;
}

/**
 * Generate compliance report request
 */
export interface GenerateComplianceReportRequest {
  orgId: string;
  framework: ComplianceFramework;
  startTime?: number;
  endTime?: number;
  sections?: string[];
}

/**
 * Register webhook request
 */
export interface RegisterWebhookRequest {
  config: Omit<WebhookConfig, 'webhookId' | 'createdAt' | 'lastTriggeredAt'>;
}

/**
 * List keys request
 */
export interface ListKeysRequest {
  orgId: string;
  pageSize?: number;
  pageToken?: string;
  includeRevoked?: boolean;
}

/**
 * List org users request
 */
export interface ListOrgUsersRequest {
  orgId: string;
  pageSize?: number;
  pageToken?: string;
  includeInactive?: boolean;
}

/**
 * List organizations request
 */
export interface ListOrganizationsRequest {
  pageSize?: number;
  pageToken?: string;
  includeInactive?: boolean;
}

/**
 * List expiring licenses request
 */
export interface ListExpiringLicensesRequest {
  expiringWithinDays?: number;
  includeExpired?: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  nextPageToken?: string;
  totalCount?: number;
  context?: ResponseContext;
}

/**
 * Standard API success response
 */
export interface AdminResponse {
  success: boolean;
  message?: string;
  error?: ErrorDetail;
  context?: ResponseContext;
}

/**
 * Rotate key response
 */
export interface RotateKeyResponse {
  oldKey?: PartnerKeyRecord;
  newKey: PartnerKeyRecord;
  gracePeriodExpiresAt?: number;
  rotationId?: string;
  context?: ResponseContext;
}

/**
 * Key escrow response
 */
export interface KeyEscrowResponse {
  escrow: KeyEscrow;
  context?: ResponseContext;
}

/**
 * Key recovery response
 */
export interface KeyRecoveryResponse {
  recoveryRequestId: string;
  status: string;
  expiresAt: number;
  context?: ResponseContext;
}

/**
 * Export audit log response
 */
export interface ExportAuditLogResponse {
  downloadUrl?: string;
  data?: string;
  mediaType?: string;
  entriesCount: number;
  exportId: string;
  sha256Checksum?: string;
  exportSignature?: HybridSignature;
  context?: ResponseContext;
}

/**
 * List webhooks response
 */
export interface ListWebhooksResponse {
  webhooks: WebhookConfig[];
  context?: ResponseContext;
}

/**
 * List expiring licenses response
 */
export interface ListExpiringLicensesResponse {
  licenses: ExpiringLicense[];
  countExpiringSoon: number;
  countAlreadyExpired: number;
  context?: ResponseContext;
}

// ============================================================================
// Legacy type aliases for backwards compatibility
// ============================================================================

/** @deprecated Use OrgRole enum instead */
export type OrgRoleString =
  | 'admin'
  | 'wise_authority'
  | 'partner_admin'
  | 'partner_user';

/** @deprecated Use PartnerStatus enum instead */
export type PartnerStatusString =
  | 'active'
  | 'suspended'
  | 'pending'
  | 'revoked';

/** @deprecated Use KeyCustodyModel enum instead */
export type CustodyModel = 'self' | 'custodied';
