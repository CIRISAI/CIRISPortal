/**
 * gRPC Client for CIRISRegistry Portal Service
 *
 * This client wraps the gRPC connection to the registry server
 * and provides typed methods for Portal operations.
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

// Load proto definition
const PROTO_PATH = path.join(process.cwd(), 'lib/grpc/ciris_registry.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false, // Convert to camelCase
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const PortalService = protoDescriptor.ciris.registry.v1.PortalService;

// Singleton client instance
let portalClient: any = null;

/**
 * Get or create the Portal Service gRPC client
 */
export function getPortalClient(): any {
  if (!portalClient) {
    const registryUrl = process.env.REGISTRY_GRPC_URL || 'localhost:50052';
    console.log(`[gRPC] Connecting to ${registryUrl}`);

    portalClient = new PortalService(
      registryUrl,
      grpc.credentials.createInsecure()
    );
  }
  return portalClient;
}

/**
 * Promisify a gRPC unary call
 */
function promisifyUnary<TReq, TRes>(
  client: any,
  method: string,
  request: TReq
): Promise<TRes> {
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 30);

    client[method](
      request,
      { deadline },
      (err: Error | null, response: TRes) => {
        if (err) {
          console.error(`[gRPC] ${method} error:`, err.message);
          reject(err);
        } else {
          console.log(`[gRPC] ${method} success`);
          resolve(response);
        }
      }
    );
  });
}

// ============================================================================
// Request Context Builder
// ============================================================================

function buildContext(requestId?: string) {
  return {
    requestId:
      requestId ||
      `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    clientVersion: 'portal-v0.1.0',
    userAgent: 'CIRISPortal/0.1.0',
  };
}

// ============================================================================
// Health & Monitoring
// ============================================================================

export async function healthCheck(includeDiagnostics = false): Promise<any> {
  // Health is on the Registry service, not Portal
  const RegistryService = protoDescriptor.ciris.registry.v1.RegistryService;
  const registryUrl = process.env.REGISTRY_GRPC_URL || 'localhost:50052';
  const registryClient = new RegistryService(
    registryUrl,
    grpc.credentials.createInsecure()
  );

  return promisifyUnary(registryClient, 'healthCheck', {
    context: buildContext(),
    includeDiagnostics,
  });
}

// ============================================================================
// Organization Methods
// ============================================================================

export async function getOrganization(orgId: string): Promise<any> {
  return promisifyUnary(getPortalClient(), 'getOrganization', {
    context: buildContext(),
    orgId,
  });
}

export async function listOrganizations(params?: {
  pageSize?: number;
  pageToken?: string;
  includeInactive?: boolean;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'listOrganizations', {
    context: buildContext(),
    pageSize: params?.pageSize,
    pageToken: params?.pageToken,
    includeInactive: params?.includeInactive,
  });
}

export async function createOrganization(params: {
  organization: {
    orgId?: string;
    name: string;
    legalName?: string;
    primaryEmail: string;
    oauthProvider?: string;
    oauthDomain?: string;
    orgType?: string; // v1.2.0: ORG_INTERNAL, ORG_PARTNER, ORG_LICENSEE, ORG_COMMUNITY
    parentOrgId?: string; // v1.2.0: Required if orgType is ORG_LICENSEE
    active?: boolean;
    metadata?: Record<string, string>;
  };
  initialAdmin?: {
    email: string;
    name?: string;
    role?: number;
    active?: boolean;
  };
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'createOrganization', {
    context: buildContext(),
    organization: {
      ...params.organization,
      active: params.organization.active ?? true,
    },
    // Atomic creation: include initial admin in same transaction
    initialAdmin: params.initialAdmin,
  });
}

// ============================================================================
// User Methods
// ============================================================================

export async function listOrgUsers(params: {
  orgId: string;
  pageSize?: number;
  pageToken?: string;
  includeInactive?: boolean;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'listOrgUsers', {
    context: buildContext(),
    ...params,
  });
}

// ============================================================================
// Key Methods
// ============================================================================

export async function listKeys(params: {
  orgId: string;
  includeRevoked?: boolean;
  pageSize?: number;
  pageToken?: string;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'listKeys', {
    context: buildContext(),
    ...params,
  });
}

export async function generateKeyPair(params: {
  orgId: string;
  requesterUserId: string;
  activateImmediately?: boolean;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'generateKeyPair', {
    context: buildContext(),
    ...params,
  });
}

export async function activateKey(params: {
  orgId: string;
  keyId: string;
  requesterUserId: string;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'activateKey', {
    context: buildContext(),
    ...params,
  });
}

export async function rotateKey(params: {
  orgId: string;
  requesterUserId: string;
  reason?: string;
  mode?: number;
  gracePeriodHours?: number;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'rotateKey', {
    context: buildContext(),
    ...params,
  });
}

export async function revokeKey(params: {
  orgId: string;
  keyId: string;
  requesterUserId: string;
  reason?: string;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'revokeKey', {
    context: buildContext(),
    ...params,
  });
}

// ============================================================================
// Audit Methods
// ============================================================================

export async function getAuditLog(params: {
  orgId: string;
  filters?: {
    startTime?: string;
    endTime?: string;
    actionTypes?: number[];
    actorUserId?: string;
    targetId?: string;
  };
  pageSize?: number;
  pageToken?: string;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'getAuditLog', {
    context: buildContext(),
    ...params,
  });
}

export async function exportAuditLog(params: {
  orgId: string;
  filters?: {
    startTime?: string;
    endTime?: string;
    actionTypes?: number[];
  };
  format?: number;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'exportAuditLog', {
    context: buildContext(),
    ...params,
  });
}

// ============================================================================
// User CRUD Methods
// ============================================================================

export async function createOrgUser(params: {
  user: {
    orgId: string;
    email: string;
    displayName?: string;
    role: string;
  };
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'createOrgUser', {
    context: buildContext(),
    user: params.user,
  });
}

export async function getOrgUser(params: {
  orgId: string;
  userId: string;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'getOrgUser', {
    context: buildContext(),
    ...params,
  });
}

export async function getOrgUserByEmail(params: {
  orgId: string;
  email: string;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'getOrgUserByEmail', {
    context: buildContext(),
    ...params,
  });
}

export async function updateOrgUser(params: {
  user: {
    orgId: string;
    userId: string;
    displayName?: string;
    role?: string;
    active?: boolean;
  };
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'updateOrgUser', {
    context: buildContext(),
    user: params.user,
  });
}

export async function batchCreateOrgUsers(params: {
  orgId: string;
  users: Array<{
    email: string;
    displayName?: string;
    role: string;
  }>;
  mode?: string;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'batchCreateOrgUsers', {
    context: buildContext(),
    ...params,
  });
}

// ============================================================================
// Key Escrow Methods
// ============================================================================

export async function requestKeyEscrow(params: {
  orgId: string;
  keyId: string;
  escrowType: string;
  requesterUserId: string;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'requestKeyEscrow', {
    context: buildContext(),
    ...params,
  });
}

export async function listKeyEscrows(params: {
  orgId: string;
  pageSize?: number;
  pageToken?: string;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'listKeyEscrows', {
    context: buildContext(),
    ...params,
  });
}

export async function requestKeyRecovery(params: {
  orgId: string;
  keyId: string;
  reason: string;
  requesterUserId: string;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'requestKeyRecovery', {
    context: buildContext(),
    ...params,
  });
}

// ============================================================================
// Compliance Methods
// ============================================================================

export async function generateComplianceReport(params: {
  orgId: string;
  framework?: string;
  periodStart?: string;
  periodEnd?: string;
  sections?: string[];
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'generateComplianceReport', {
    context: buildContext(),
    ...params,
  });
}

// ============================================================================
// Registry Service (Public) Methods
// ============================================================================

let registryClient: any = null;

function getRegistryClient(): any {
  if (!registryClient) {
    const RegistryService = protoDescriptor.ciris.registry.v1.RegistryService;
    const registryUrl = process.env.REGISTRY_GRPC_URL || 'localhost:50052';
    registryClient = new RegistryService(
      registryUrl,
      grpc.credentials.createInsecure()
    );
  }
  return registryClient;
}

export async function getEmergencyStatus(): Promise<any> {
  return promisifyUnary(getRegistryClient(), 'getEmergencyStatus', {
    context: buildContext(),
  });
}

export async function lookupAgent(params: { agentHash: string }): Promise<any> {
  return promisifyUnary(getRegistryClient(), 'lookupAgent', {
    context: buildContext(),
    ...params,
  });
}

export async function lookupPartner(params: { orgId: string }): Promise<any> {
  return promisifyUnary(getRegistryClient(), 'lookupPartner', {
    context: buildContext(),
    ...params,
  });
}

export async function getPublicKeys(params: { orgId: string }): Promise<any> {
  return promisifyUnary(getRegistryClient(), 'getPublicKeys', {
    context: buildContext(),
    ...params,
  });
}

export async function getRevocationList(params?: {
  since?: string;
}): Promise<any> {
  return promisifyUnary(getRegistryClient(), 'getRevocationList', {
    context: buildContext(),
    ...params,
  });
}

export async function getCapabilities(): Promise<any> {
  return promisifyUnary(getRegistryClient(), 'getCapabilities', {
    context: buildContext(),
  });
}

export async function getMetrics(): Promise<any> {
  return promisifyUnary(getRegistryClient(), 'getMetrics', {
    context: buildContext(),
  });
}

// ============================================================================
// Registry Admin Service Methods
// ============================================================================

let adminClient: any = null;

function getAdminClient(): any {
  if (!adminClient) {
    const RegistryAdminService =
      protoDescriptor.ciris.registry.v1.RegistryAdminService;
    const registryUrl = process.env.REGISTRY_GRPC_URL || 'localhost:50052';
    adminClient = new RegistryAdminService(
      registryUrl,
      grpc.credentials.createInsecure()
    );
  }
  return adminClient;
}

// Agent Management
export async function registerAgent(params: {
  agentHash: string;
  agentType: string;
  version: { major: number; minor: number; patch: number };
  capabilities: string[];
  maxAutonomyTier?: string;
}): Promise<any> {
  return promisifyUnary(getAdminClient(), 'registerAgent', {
    context: buildContext(),
    agent: {
      agentHash: params.agentHash,
      agentType: params.agentType,
      version: params.version,
      capabilities: params.capabilities,
      maxAutonomyTier: params.maxAutonomyTier,
    },
  });
}

export async function batchRegisterAgents(params: {
  agents: Array<{
    agentHash: string;
    agentType: string;
    version: { major: number; minor: number; patch: number };
    capabilities: string[];
    maxAutonomyTier?: string;
  }>;
}): Promise<any> {
  return promisifyUnary(getAdminClient(), 'batchRegisterAgents', {
    context: buildContext(),
    ...params,
  });
}

// Emergency Response
export async function setEmergencyShutdown(params: {
  severity: string;
  reason: string;
  durationSeconds?: number;
  allowedOperations?: string[];
}): Promise<any> {
  return promisifyUnary(getAdminClient(), 'setEmergencyShutdown', {
    context: buildContext(),
    ...params,
  });
}

export async function clearEmergencyShutdown(): Promise<any> {
  return promisifyUnary(getAdminClient(), 'clearEmergencyShutdown', {
    context: buildContext(),
  });
}

export async function massRevoke(params: {
  agentHashes?: string[];
  partnerIds?: string[];
  versionPattern?: string;
  agentType?: string;
  reason: string;
  reasonCode: string;
  severity: string;
  isDryRun?: boolean;
}): Promise<any> {
  return promisifyUnary(getAdminClient(), 'massRevoke', {
    context: buildContext(),
    ...params,
  });
}

// Webhook Management
export async function registerWebhook(params: {
  orgId: string;
  url: string;
  events: string[];
  secret?: string;
}): Promise<any> {
  return promisifyUnary(getAdminClient(), 'registerWebhook', {
    context: buildContext(),
    ...params,
  });
}

export async function listWebhooks(params: {
  orgId: string;
  pageSize?: number;
  pageToken?: string;
}): Promise<any> {
  return promisifyUnary(getAdminClient(), 'listWebhooks', {
    context: buildContext(),
    ...params,
  });
}

export async function deleteWebhook(params: {
  orgId: string;
  webhookId: string;
}): Promise<any> {
  return promisifyUnary(getAdminClient(), 'deleteWebhook', {
    context: buildContext(),
    ...params,
  });
}

// License Management
export async function listExpiringLicenses(params: {
  withinDays?: number;
  pageSize?: number;
  pageToken?: string;
}): Promise<any> {
  return promisifyUnary(getAdminClient(), 'listExpiringLicenses', {
    context: buildContext(),
    ...params,
  });
}

// Partner Activity
export async function getPartnerActivity(params: {
  partnerId: string;
}): Promise<any> {
  return promisifyUnary(getAdminClient(), 'getPartnerActivity', {
    context: buildContext(),
    ...params,
  });
}

// Agent Registry
export async function listRegisteredAgents(params: {
  agentType?: string;
  status?: string;
  versionPrefix?: string;
  searchQuery?: string;
  includeTestRecords?: boolean;
  pageSize?: number;
  pageToken?: string;
  orderBy?: string;
  descending?: boolean;
}): Promise<any> {
  return promisifyUnary(getAdminClient(), 'listRegisteredAgents', {
    context: buildContext(),
    ...params,
  });
}

// ============================================================================
// Multi-Org User Management (v1.2.0)
// ============================================================================

/**
 * Create a user identity (without org membership)
 */
export async function createUser(params: {
  email: string;
  name: string;
  oauthProvider?: string;
  oauthSubject?: string;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'createUser', {
    context: buildContext(),
    user: params,
  });
}

/**
 * Create a user and add to an org in one transaction
 */
export async function createUserWithMembership(params: {
  email: string;
  name: string;
  orgId: string;
  role: string; // OrgRole enum value
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'createUserWithMembership', {
    context: buildContext(),
    user: { email: params.email, name: params.name },
    orgId: params.orgId,
    role: params.role,
  });
}

/**
 * Get user by ID (includes all org memberships)
 */
export async function getUser(params: { userId: string }): Promise<any> {
  return promisifyUnary(getPortalClient(), 'getUser', {
    context: buildContext(),
    userId: params.userId,
  });
}

/**
 * Get user by email (includes all org memberships)
 */
export async function getUserByEmail(params: { email: string }): Promise<any> {
  return promisifyUnary(getPortalClient(), 'getUserByEmail', {
    context: buildContext(),
    email: params.email,
  });
}

/**
 * Add an existing user to an organization
 */
export async function addUserToOrg(params: {
  userId: string;
  orgId: string;
  role: string;
  invitedBy?: string;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'addUserToOrg', {
    context: buildContext(),
    ...params,
  });
}

/**
 * Remove a user from an organization
 */
export async function removeUserFromOrg(params: {
  userId: string;
  orgId: string;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'removeUserFromOrg', {
    context: buildContext(),
    ...params,
  });
}

/**
 * Update a user's role in an organization
 */
export async function updateUserOrgRole(params: {
  userId: string;
  orgId: string;
  newRole: string;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'updateUserOrgRole', {
    context: buildContext(),
    ...params,
  });
}

/**
 * List all members of an organization (returns User with single membership)
 */
export async function listOrgMembers(params: {
  orgId: string;
  pageSize?: number;
  pageToken?: string;
  includeInactive?: boolean;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'listOrgMembers', {
    context: buildContext(),
    ...params,
  });
}

// ============================================================================
// System User Management (v1.2.0)
// ============================================================================

/**
 * Create a system user (global admin)
 */
export async function createSystemUser(params: {
  email: string;
  name: string;
  role: string; // SystemRole enum value
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'createSystemUser', {
    context: buildContext(),
    user: params,
  });
}

/**
 * Get a system user by ID
 */
export async function getSystemUser(params: { userId: string }): Promise<any> {
  return promisifyUnary(getPortalClient(), 'getSystemUser', {
    context: buildContext(),
    userId: params.userId,
  });
}

/**
 * List all system users
 */
export async function listSystemUsers(params?: {
  pageSize?: number;
  pageToken?: string;
  includeInactive?: boolean;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'listSystemUsers', {
    context: buildContext(),
    ...params,
  });
}

/**
 * Update a system user
 */
export async function updateSystemUser(params: {
  userId: string;
  name?: string;
  role?: string;
  active?: boolean;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'updateSystemUser', {
    context: buildContext(),
    user: params,
  });
}

// ============================================================================
// Organization Hierarchy (v1.2.0)
// ============================================================================

/**
 * List child organizations under a parent (for PARTNER → LICENSEE)
 */
export async function listChildOrganizations(params: {
  parentOrgId: string;
  pageSize?: number;
  pageToken?: string;
  includeInactive?: boolean;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'listChildOrganizations', {
    context: buildContext(),
    ...params,
  });
}

/**
 * Create a licensee organization under a partner
 */
export async function createLicenseeOrganization(params: {
  organization: {
    name: string;
    legalName?: string;
    primaryEmail: string;
    oauthDomain?: string;
  };
  parentOrgId: string;
  initialAdmin?: {
    email: string;
    name?: string;
    role?: number;
    active?: boolean;
  };
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'createLicenseeOrganization', {
    context: buildContext(),
    organization: {
      ...params.organization,
      orgType: 'ORG_LICENSEE',
      active: true,
    },
    parentOrgId: params.parentOrgId,
    initialAdmin: params.initialAdmin,
  });
}

/**
 * Get organization hierarchy (ancestors and children)
 */
export async function getOrganizationHierarchy(params: {
  orgId: string;
  includeAncestors?: boolean;
  includeDescendants?: boolean;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'getOrganizationHierarchy', {
    context: buildContext(),
    ...params,
  });
}

/**
 * Upgrade a COMMUNITY org to PARTNER (SYSTEM_ADMIN only)
 */
export async function upgradeToPartner(params: {
  orgId: string;
  partnerLicenseType?: string;
}): Promise<any> {
  return promisifyUnary(getPortalClient(), 'upgradeToPartner', {
    context: buildContext(),
    ...params,
  });
}
