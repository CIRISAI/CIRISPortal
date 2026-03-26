/**
 * gRPC Client for CIRISRegistry Portal Service
 *
 * This client wraps the gRPC connection to the registry server
 * and provides typed methods for Portal operations.
 *
 * Authentication: Portal generates short-lived JWTs signed with a shared
 * secret (REGISTRY_JWT_SECRET) and passes them in gRPC metadata as
 * Authorization: Bearer <token>. The Registry validates these JWTs using
 * the same secret.
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { SignJWT } from 'jose';
import path from 'path';

// Load proto definition
const PROTO_PATH = path.join(process.cwd(), 'lib/grpc/ciris_registry.proto');

// Proto enum → integer mappings for reliable serialization.
// Proto-loader's `enums: String` only affects deserialization (incoming);
// for outgoing data, explicitly map to integers to avoid silent defaults to 0.
const AGENT_TYPE_INT: Record<string, number> = {
  AGENT_TYPE_UNSPECIFIED: 0,
  CIRISCARE: 1,
  CIRISMEDICAL: 2,
  CIRISLEGAL: 3,
  CIRISFINANCIAL: 4,
  CUSTOM: 99,
};

const AUTONOMY_TIER_INT: Record<string, number> = {
  AUTONOMY_TIER_UNSPECIFIED: 0,
  A0_ADVISORY: 1,
  A1_LIMITED: 2,
  A2_MODERATE: 3,
  A3_HIGH: 4,
  A4_CRITICAL: 5,
};

/** Convert hex string to Buffer for proto `bytes` fields. */
function hexToBytes(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

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

// ============================================================================
// JWT Authentication for Registry gRPC calls
// ============================================================================

function getRegistryJwtSecret(): string {
  const secret =
    process.env.REGISTRY_JWT_SECRET || process.env.JWT_SECRET || '';
  if (process.env.NODE_ENV === 'production' && !secret) {
    throw new Error(
      'REGISTRY_JWT_SECRET (or JWT_SECRET) must be set in production. ' +
        'Refusing to start without a signing secret for Registry authentication.'
    );
  }
  return secret;
}

const REGISTRY_JWT_ISSUER = process.env.REGISTRY_JWT_ISSUER || 'ciris-registry';

/**
 * Generate a short-lived service JWT for Registry authentication.
 * The Portal acts as a service account with admin role (role=1).
 */
async function generateServiceJWT(): Promise<string> {
  const jwtSecret = getRegistryJwtSecret();
  if (!jwtSecret) {
    console.warn(
      '[gRPC] No REGISTRY_JWT_SECRET configured — requests to protected endpoints will fail'
    );
    return '';
  }

  const secret = new TextEncoder().encode(jwtSecret);
  const token = await new SignJWT({
    sub: 'portal-service',
    org_id: 'ciris-internal',
    role: 1, // SYSTEM_ADMIN — Portal is a trusted service
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(REGISTRY_JWT_ISSUER)
    .setExpirationTime('5m') // Short-lived: 5 minutes
    .sign(secret);

  return token;
}

/**
 * Promisify a gRPC unary call with optional JWT auth metadata
 */
function promisifyUnary<TReq, TRes>(
  client: any,
  method: string,
  request: TReq,
  authToken?: string
): Promise<TRes> {
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 30);

    const metadata = new grpc.Metadata();
    if (authToken) {
      metadata.set('authorization', `Bearer ${authToken}`);
    }

    client[method](
      request,
      metadata,
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

/**
 * Promisify a gRPC unary call with automatic JWT authentication.
 * Use this for PortalService and RegistryAdminService calls.
 */
async function promisifyUnaryAuth<TReq, TRes>(
  client: any,
  method: string,
  request: TReq
): Promise<TRes> {
  const token = await generateServiceJWT();
  return promisifyUnary(client, method, request, token);
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
  return promisifyUnaryAuth(getPortalClient(), 'getOrganization', {
    context: buildContext(),
    orgId,
  });
}

export async function listOrganizations(params?: {
  pageSize?: number;
  pageToken?: string;
  includeInactive?: boolean;
}): Promise<any> {
  return promisifyUnaryAuth(getPortalClient(), 'listOrganizations', {
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
  return promisifyUnaryAuth(getPortalClient(), 'createOrganization', {
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
  return promisifyUnaryAuth(getPortalClient(), 'listOrgUsers', {
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
  return promisifyUnaryAuth(getPortalClient(), 'listKeys', {
    context: buildContext(),
    ...params,
  });
}

export async function generateKeyPair(params: {
  orgId: string;
  requesterUserId: string;
  activateImmediately?: boolean;
}): Promise<any> {
  return promisifyUnaryAuth(getPortalClient(), 'generateKeyPair', {
    context: buildContext(),
    ...params,
  });
}

export async function activateKey(params: {
  orgId: string;
  keyId: string;
  requesterUserId: string;
}): Promise<any> {
  return promisifyUnaryAuth(getPortalClient(), 'activateKey', {
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
  return promisifyUnaryAuth(getPortalClient(), 'rotateKey', {
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
  return promisifyUnaryAuth(getPortalClient(), 'revokeKey', {
    context: buildContext(),
    ...params,
  });
}

// ============================================================================
// Self-Custody Key Methods
// ============================================================================

export async function getRegistrationChallenge(params: {
  orgId: string;
}): Promise<{ challenge: Uint8Array; expiresAt: number }> {
  const response: any = await promisifyUnaryAuth(
    getPortalClient(),
    'getRegistrationChallenge',
    {
      context: buildContext(),
      orgId: params.orgId,
    }
  );
  return {
    challenge: response.challenge,
    expiresAt: response.expiresAt,
  };
}

export async function registerPublicKey(params: {
  orgId: string;
  ed25519PublicKey: Uint8Array;
  mlDsa65PublicKey?: Uint8Array;
  registrationChallenge: Uint8Array;
  ed25519Signature: Uint8Array;
  mlDsa65Signature?: Uint8Array;
  requesterUserId: string;
  keyLabel?: string;
}): Promise<{
  keyRecord: any;
  activationChallenge: Uint8Array;
}> {
  const response: any = await promisifyUnaryAuth(
    getPortalClient(),
    'registerPublicKey',
    {
      context: buildContext(),
      orgId: params.orgId,
      ed25519PublicKey: params.ed25519PublicKey,
      mlDsa65PublicKey: params.mlDsa65PublicKey,
      registrationChallenge: params.registrationChallenge,
      ed25519Signature: params.ed25519Signature,
      mlDsa65Signature: params.mlDsa65Signature,
      requesterUserId: params.requesterUserId,
      keyLabel: params.keyLabel,
    }
  );
  return {
    keyRecord: response.keyRecord,
    activationChallenge: response.activationChallenge,
  };
}

export async function activateSelfCustodyKey(params: {
  orgId: string;
  keyId: string;
  activationChallenge: Uint8Array;
  ed25519Signature: Uint8Array;
  mlDsa65Signature?: Uint8Array;
  agentHash: string;
}): Promise<{ success: boolean; message: string }> {
  const response: any = await promisifyUnaryAuth(
    getPortalClient(),
    'activateSelfCustodyKey',
    {
      context: buildContext(),
      orgId: params.orgId,
      keyId: params.keyId,
      activationChallenge: params.activationChallenge,
      ed25519Signature: params.ed25519Signature,
      mlDsa65Signature: params.mlDsa65Signature,
      agentHash: params.agentHash,
    }
  );
  return {
    success: response.success,
    message: response.message,
  };
}

export async function rotateSelfCustodyKey(params: {
  orgId: string;
  newKeyId: string;
  rotationChallenge: Uint8Array;
  oldKeySignature: Uint8Array;
  newKeySignature: Uint8Array;
  mode?: number;
  gracePeriodHours?: number;
  reason?: string;
}): Promise<any> {
  return promisifyUnaryAuth(getPortalClient(), 'rotateSelfCustodyKey', {
    context: buildContext(),
    orgId: params.orgId,
    newKeyId: params.newKeyId,
    rotationChallenge: params.rotationChallenge,
    oldKeySignature: params.oldKeySignature,
    newKeySignature: params.newKeySignature,
    mode: params.mode,
    gracePeriodHours: params.gracePeriodHours,
    reason: params.reason,
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
  return promisifyUnaryAuth(getPortalClient(), 'getAuditLog', {
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
  return promisifyUnaryAuth(getPortalClient(), 'exportAuditLog', {
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
  return promisifyUnaryAuth(getPortalClient(), 'createOrgUser', {
    context: buildContext(),
    user: params.user,
  });
}

export async function getOrgUser(params: {
  orgId: string;
  userId: string;
}): Promise<any> {
  return promisifyUnaryAuth(getPortalClient(), 'getOrgUser', {
    context: buildContext(),
    ...params,
  });
}

export async function getOrgUserByEmail(params: {
  orgId: string;
  email: string;
}): Promise<any> {
  return promisifyUnaryAuth(getPortalClient(), 'getOrgUserByEmail', {
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
  return promisifyUnaryAuth(getPortalClient(), 'updateOrgUser', {
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
  return promisifyUnaryAuth(getPortalClient(), 'batchCreateOrgUsers', {
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
  return promisifyUnaryAuth(getPortalClient(), 'requestKeyEscrow', {
    context: buildContext(),
    ...params,
  });
}

export async function listKeyEscrows(params: {
  orgId: string;
  pageSize?: number;
  pageToken?: string;
}): Promise<any> {
  return promisifyUnaryAuth(getPortalClient(), 'listKeyEscrows', {
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
  return promisifyUnaryAuth(getPortalClient(), 'requestKeyRecovery', {
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
  return promisifyUnaryAuth(getPortalClient(), 'generateComplianceReport', {
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
  // Use authenticated call to get full (non-redacted) agent record
  return promisifyUnaryAuth(getRegistryClient(), 'lookupAgent', {
    context: buildContext(),
    agentHash: hexToBytes(params.agentHash),
  });
}

export async function getBuildAttestation(params: {
  agentHash: string;
}): Promise<any> {
  return promisifyUnaryAuth(getRegistryClient(), 'getBuildAttestation', {
    context: buildContext(),
    agentHash: hexToBytes(params.agentHash),
  });
}

export async function lookupPartner(params: { orgId: string }): Promise<any> {
  // Use authenticated call to get full partner record
  return promisifyUnaryAuth(getRegistryClient(), 'lookupPartner', {
    context: buildContext(),
    partnerId: params.orgId, // Proto expects partner_id, not org_id
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
  identityTemplate?: string;
  stewardshipTier?: number;
  permittedActions?: string[];
  templateHash?: string;
  approvedAdapters?: string[];
  orgId?: string;
}): Promise<any> {
  return promisifyUnaryAuth(getAdminClient(), 'registerAgent', {
    context: buildContext(),
    agent: {
      agentHash: hexToBytes(params.agentHash),
      agentHashHex: params.agentHash,
      agentType: AGENT_TYPE_INT[params.agentType] ?? params.agentType,
      version: params.version,
      baseCapabilities: params.capabilities,
      maxAutonomyTier: params.maxAutonomyTier
        ? (AUTONOMY_TIER_INT[params.maxAutonomyTier] ?? params.maxAutonomyTier)
        : undefined,
      identityTemplate: params.identityTemplate,
      stewardshipTier: params.stewardshipTier,
      permittedActions: params.permittedActions,
      templateHash: params.templateHash
        ? hexToBytes(params.templateHash)
        : undefined,
      approvedAdapters: params.approvedAdapters,
      orgId: params.orgId,
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
    identityTemplate?: string;
    stewardshipTier?: number;
    permittedActions?: string[];
    templateHash?: string;
  }>;
}): Promise<any> {
  return promisifyUnaryAuth(getAdminClient(), 'batchRegisterAgents', {
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
  return promisifyUnaryAuth(getAdminClient(), 'setEmergencyShutdown', {
    context: buildContext(),
    ...params,
  });
}

export async function clearEmergencyShutdown(): Promise<any> {
  return promisifyUnaryAuth(getAdminClient(), 'clearEmergencyShutdown', {
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
  return promisifyUnaryAuth(getAdminClient(), 'massRevoke', {
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
  return promisifyUnaryAuth(getAdminClient(), 'registerWebhook', {
    context: buildContext(),
    ...params,
  });
}

export async function listWebhooks(params: {
  orgId: string;
  pageSize?: number;
  pageToken?: string;
}): Promise<any> {
  return promisifyUnaryAuth(getAdminClient(), 'listWebhooks', {
    context: buildContext(),
    ...params,
  });
}

export async function deleteWebhook(params: {
  orgId: string;
  webhookId: string;
}): Promise<any> {
  return promisifyUnaryAuth(getAdminClient(), 'deleteWebhook', {
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
  return promisifyUnaryAuth(getAdminClient(), 'listExpiringLicenses', {
    context: buildContext(),
    ...params,
  });
}

// Partner Activity
export async function getPartnerActivity(params: {
  partnerId: string;
}): Promise<any> {
  return promisifyUnaryAuth(getAdminClient(), 'getPartnerActivity', {
    context: buildContext(),
    ...params,
  });
}

// Build Registry
export async function registerBuild(params: {
  version: string;
  buildHash: string;
  fileManifestHash: string;
  fileManifestCount: number;
  fileManifestJson: string; // JSON string of the manifest
  includesModules: string[];
  sourceRepo?: string;
  sourceCommit?: string;
  registeredBy?: string;
  notes?: string;
}): Promise<any> {
  return promisifyUnaryAuth(getAdminClient(), 'registerBuild', {
    context: buildContext(),
    build: {
      version: params.version,
      buildHash: params.buildHash,
      fileManifestHash: params.fileManifestHash,
      fileManifestCount: params.fileManifestCount,
      fileManifestJson: Buffer.from(params.fileManifestJson, 'utf-8'),
      includesModules: params.includesModules,
      sourceRepo: params.sourceRepo || '',
      sourceCommit: params.sourceCommit || '',
      registeredBy: params.registeredBy || '',
      notes: params.notes || '',
    },
  });
}

export async function getBuild(params: {
  version?: string;
  buildHash?: string;
}): Promise<any> {
  return promisifyUnaryAuth(getAdminClient(), 'getBuild', {
    context: buildContext(),
    version: params.version || '',
    buildHash: params.buildHash || '',
  });
}

export async function listBuilds(params?: {
  status?: string;
  pageSize?: number;
  pageToken?: string;
}): Promise<any> {
  return promisifyUnaryAuth(getAdminClient(), 'listBuilds', {
    context: buildContext(),
    status: params?.status || '',
    pageSize: params?.pageSize || 50,
    pageToken: params?.pageToken || '',
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
  return promisifyUnaryAuth(getAdminClient(), 'listRegisteredAgents', {
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
  return promisifyUnaryAuth(getPortalClient(), 'createUser', {
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
  return promisifyUnaryAuth(getPortalClient(), 'createUserWithMembership', {
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
  return promisifyUnaryAuth(getPortalClient(), 'getUser', {
    context: buildContext(),
    userId: params.userId,
  });
}

/**
 * Get user by email (includes all org memberships)
 */
export async function getUserByEmail(params: { email: string }): Promise<any> {
  return promisifyUnaryAuth(getPortalClient(), 'getUserByEmail', {
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
  return promisifyUnaryAuth(getPortalClient(), 'addUserToOrg', {
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
  return promisifyUnaryAuth(getPortalClient(), 'removeUserFromOrg', {
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
  return promisifyUnaryAuth(getPortalClient(), 'updateUserOrgRole', {
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
  return promisifyUnaryAuth(getPortalClient(), 'listOrgMembers', {
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
  return promisifyUnaryAuth(getPortalClient(), 'createSystemUser', {
    context: buildContext(),
    user: params,
  });
}

/**
 * Get a system user by ID
 */
export async function getSystemUser(params: { userId: string }): Promise<any> {
  return promisifyUnaryAuth(getPortalClient(), 'getSystemUser', {
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
  return promisifyUnaryAuth(getPortalClient(), 'listSystemUsers', {
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
  return promisifyUnaryAuth(getPortalClient(), 'updateSystemUser', {
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
  return promisifyUnaryAuth(getPortalClient(), 'listChildOrganizations', {
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
  return promisifyUnaryAuth(getPortalClient(), 'createLicenseeOrganization', {
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
  return promisifyUnaryAuth(getPortalClient(), 'getOrganizationHierarchy', {
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
  return promisifyUnaryAuth(getPortalClient(), 'upgradeToPartner', {
    context: buildContext(),
    ...params,
  });
}

// ============================================================================
// Audit Methods (v1.2.0)
// ============================================================================

/**
 * Create an audit entry (for Portal to record login/logout events)
 */
export async function createAuditEntry(params: {
  action: number; // AuditActionType enum
  actorUserId?: string;
  actorOrgId?: string;
  actorIpAddress?: string;
  actorUserAgent?: string;
  targetType?: string;
  targetId?: string;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<any> {
  return promisifyUnaryAuth(getPortalClient(), 'createAuditEntry', {
    context: buildContext(),
    action: params.action,
    actorUserId: params.actorUserId,
    actorOrgId: params.actorOrgId,
    actorIpAddress: params.actorIpAddress,
    actorUserAgent: params.actorUserAgent,
    targetType: params.targetType,
    targetId: params.targetId,
    description: params.description,
    metadata: params.metadata,
  });
}

// ============================================================================
// OAuth Identity Management (v1.3.0)
// ============================================================================

/**
 * OAuth lookup result type
 */
export interface OAuthLookupResult {
  found: boolean;
  userId?: string;
  lookupMethod?: 'oauth' | 'email';
  shouldLinkOauth?: boolean;
}

/**
 * Look up a user by OAuth provider and subject, with fallback to email.
 * Returns lookup_method to indicate how the user was found.
 */
export async function lookupUserByOAuth(params: {
  oauthProvider: string;
  oauthSubject: string;
  email: string;
}): Promise<OAuthLookupResult> {
  const response = (await promisifyUnaryAuth(
    getPortalClient(),
    'lookupUserByOAuth',
    {
      context: buildContext(),
      oauthProvider: params.oauthProvider,
      oauthSubject: params.oauthSubject,
      email: params.email,
    }
  )) as OAuthLookupResult;
  return {
    found: response.found,
    userId: response.userId,
    lookupMethod: response.lookupMethod,
    shouldLinkOauth: response.shouldLinkOauth,
  };
}

/**
 * Link a new OAuth identity to an existing user.
 */
export async function linkUserOAuth(params: {
  userId: string;
  oauthProvider: string;
  oauthSubject: string;
  email?: string;
}): Promise<{ success: boolean }> {
  return promisifyUnaryAuth(getPortalClient(), 'linkUserOAuth', {
    context: buildContext(),
    userId: params.userId,
    oauthProvider: params.oauthProvider,
    oauthSubject: params.oauthSubject,
    email: params.email,
  });
}

/**
 * List all OAuth identities linked to a user.
 */
export async function listUserOAuthIdentities(params: {
  userId: string;
}): Promise<{
  identities: Array<{
    oauthProvider: string;
    oauthSubject: string;
    emailAtLink?: string;
    createdAt?: string;
  }>;
}> {
  return promisifyUnaryAuth(getPortalClient(), 'listUserOAuthIdentities', {
    context: buildContext(),
    userId: params.userId,
  });
}

/**
 * Look up a system user by OAuth provider and subject, with fallback to email.
 */
export async function lookupSystemUserByOAuth(params: {
  oauthProvider: string;
  oauthSubject: string;
  email: string;
}): Promise<OAuthLookupResult> {
  const response = (await promisifyUnaryAuth(
    getPortalClient(),
    'lookupSystemUserByOAuth',
    {
      context: buildContext(),
      oauthProvider: params.oauthProvider,
      oauthSubject: params.oauthSubject,
      email: params.email,
    }
  )) as OAuthLookupResult;
  return {
    found: response.found,
    userId: response.userId,
    lookupMethod: response.lookupMethod,
    shouldLinkOauth: response.shouldLinkOauth,
  };
}

/**
 * Link a new OAuth identity to an existing system user.
 */
export async function linkSystemUserOAuth(params: {
  userId: string;
  oauthProvider: string;
  oauthSubject: string;
  email?: string;
}): Promise<{ success: boolean }> {
  return promisifyUnaryAuth(getPortalClient(), 'linkSystemUserOAuth', {
    context: buildContext(),
    userId: params.userId,
    oauthProvider: params.oauthProvider,
    oauthSubject: params.oauthSubject,
    email: params.email,
  });
}

/**
 * List all OAuth identities linked to a system user.
 */
export async function listSystemUserOAuthIdentities(params: {
  userId: string;
}): Promise<{
  identities: Array<{
    oauthProvider: string;
    oauthSubject: string;
    emailAtLink?: string;
    createdAt?: string;
  }>;
}> {
  return promisifyUnaryAuth(
    getPortalClient(),
    'listSystemUserOAuthIdentities',
    {
      context: buildContext(),
      userId: params.userId,
    }
  );
}
