/**
 * Registry SDK Types
 *
 * TypeScript interfaces for the CIRIS Registry API
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Organization role types
 */
export type OrgRole =
  | 'admin'
  | 'wise_authority'
  | 'partner_admin'
  | 'partner_user';

/**
 * Partner status types
 */
export type PartnerStatus = 'active' | 'suspended' | 'pending' | 'revoked';

/**
 * Key custody model - whether keys are self-managed or custodied by CIRIS
 */
export type CustodyModel = 'self' | 'custodied';

// ============================================================================
// Core Entities
// ============================================================================

/**
 * Organization entity - represents a partner organization in the registry
 */
export interface Organization {
  /** Unique identifier for the organization */
  id: string;
  /** Display name of the organization */
  name: string;
  /** ISO 8601 timestamp of when the organization was created */
  createdAt: string;
  /** List of email addresses for organization administrators */
  adminEmails: string[];
  /** Whether keys are self-custodied or managed by CIRIS */
  custodyModel: CustodyModel;
}

/**
 * Public key information for a partner
 */
export interface PublicKeys {
  /** Ed25519 public key (base64 encoded) */
  ed25519?: string;
  /** ML-DSA-65 public key (base64 encoded) */
  mlDsa65?: string;
  /** Key ID for reference */
  keyId?: string;
  /** ISO 8601 timestamp of when the keys were created */
  createdAt?: string;
}

/**
 * Partner capabilities/permissions
 */
export interface PartnerCapabilities {
  /** Can create and manage agents */
  agentManagement: boolean;
  /** Can access audit logs */
  auditAccess: boolean;
  /** Can manage organization users */
  userManagement: boolean;
  /** Maximum number of agents allowed */
  maxAgents?: number;
}

/**
 * Partner entity - represents a registered partner in the system
 */
export interface Partner {
  /** Unique identifier for the partner */
  id: string;
  /** Organization ID this partner belongs to */
  orgId: string;
  /** Display name of the partner */
  name: string;
  /** Current status of the partner */
  status: PartnerStatus;
  /** Public keys registered for this partner */
  publicKeys: PublicKeys;
  /** Capabilities granted to this partner */
  capabilities: PartnerCapabilities;
  /** ISO 8601 timestamp of when the license expires */
  licenseExpiry: string;
}

/**
 * Organization user entity - a user within an organization
 */
export interface OrgUser {
  /** Unique identifier for the user */
  id: string;
  /** User's email address */
  email: string;
  /** User's role within the organization */
  role: OrgRole;
  /** Organization ID this user belongs to */
  orgId: string;
  /** ISO 8601 timestamp of when the user was added */
  createdAt?: string;
  /** ISO 8601 timestamp of last login */
  lastLoginAt?: string;
}

/**
 * Audit entry - cryptographically signed record of an operation
 */
export interface AuditEntry {
  /** Unique identifier for the audit entry */
  id: string;
  /** ISO 8601 timestamp of when the action occurred */
  timestamp: string;
  /** User or system that performed the action */
  actor: string;
  /** Type of action performed */
  action: string;
  /** Target of the action (e.g., organization ID, partner ID) */
  target: string;
  /** Cryptographic signature of the entry */
  signature: string;
  /** Hash of the previous audit entry for chain integrity */
  previousHash: string;
  /** Additional metadata about the action */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request to create a new organization
 */
export interface CreateOrganizationRequest {
  name: string;
  adminEmails: string[];
  custodyModel: CustodyModel;
}

/**
 * Request to create a new partner
 */
export interface CreatePartnerRequest {
  orgId: string;
  name: string;
  capabilities?: Partial<PartnerCapabilities>;
  licenseExpiry?: string;
}

/**
 * Request to invite a user to an organization
 */
export interface InviteUserRequest {
  orgId: string;
  email: string;
  role: OrgRole;
}

/**
 * Filters for querying audit logs
 */
export interface AuditLogFilters {
  /** Filter by actor */
  actor?: string;
  /** Filter by action type */
  action?: string;
  /** Filter by target */
  target?: string;
  /** Filter entries after this timestamp */
  startDate?: string;
  /** Filter entries before this timestamp */
  endDate?: string;
  /** Maximum number of entries to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}
