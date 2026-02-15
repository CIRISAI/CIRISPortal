/**
 * Device auth code storage with TTL.
 *
 * Implements RFC 8628 device code storage for the "Connect to Node"
 * provisioning flow. Agents initiate a device auth session, users
 * authenticate in the browser, and the provisioned key is delivered
 * back to the agent via polling.
 *
 * TODO: Migrate from in-memory Map to Cloudflare KV for production
 * (currently MVP: in-memory with periodic cleanup).
 */

import crypto from 'crypto';

export interface DeviceAuthAgentInfo {
  agentHash?: string;
  currentPublicKey?: string;
  requestedAdapters?: string[];
}

export interface ProvisionedKey {
  ed25519PrivateKey: string; // base64, one-time delivery
  ed25519PublicKey: string; // base64
  keyId: string;
  orgId: string;
  agentRecordHash?: string;
}

export interface DeviceAuthRecord {
  deviceCode: string; // Opaque secret (agent polls with this)
  userCode: string; // Human-readable code (embedded in verification URL)
  nodeUrl: string; // Node the agent wants to connect to
  nodeManifest: Record<string, unknown>; // From /.well-known/agent.json
  agentInfo: DeviceAuthAgentInfo;
  status: 'pending' | 'authorized' | 'provisioned' | 'expired' | 'denied';
  userId?: string; // Set after OAuth
  orgId?: string; // Set after OAuth
  selectedTemplate?: string;
  selectedAdapters?: string[];
  provisionedKey?: ProvisionedKey;
  agentRecord?: {
    identityTemplate: string;
    stewardshipTier: number;
    permittedActions: string[];
    approvedAdapters: string[];
  };
  packageDownloadUrl?: string; // URL to download licensed module package zip
  createdAt: number;
  expiresAt: number; // createdAt + TTL
}

const DEVICE_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // Cleanup every minute
const USER_CODE_LENGTH = 8; // e.g., "ABCD-1234"

/**
 * Generate a cryptographically random device code (opaque).
 */
function generateDeviceCode(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a human-readable user code (e.g., "ABCD-1234").
 */
function generateUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // No I, O (confusable)
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  code += '-';
  for (let i = 0; i < 4; i++) {
    code += digits[crypto.randomInt(digits.length)];
  }
  return code;
}

// TODO: Replace with Cloudflare KV for production persistence
// across worker instances and restarts. MVP: in-memory Map.
const store = new Map<string, DeviceAuthRecord>();
const userCodeIndex = new Map<string, string>(); // userCode → deviceCode

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now >= record.expiresAt) {
        store.delete(key);
        userCodeIndex.delete(record.userCode);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Create a new device auth session.
 */
export function createDeviceAuth(
  nodeUrl: string,
  nodeManifest: Record<string, unknown>,
  agentInfo: DeviceAuthAgentInfo
): DeviceAuthRecord {
  startCleanup();

  const now = Date.now();
  const record: DeviceAuthRecord = {
    deviceCode: generateDeviceCode(),
    userCode: generateUserCode(),
    nodeUrl,
    nodeManifest,
    agentInfo,
    status: 'pending',
    createdAt: now,
    expiresAt: now + DEVICE_CODE_TTL_MS,
  };

  store.set(record.deviceCode, record);
  userCodeIndex.set(record.userCode, record.deviceCode);

  return record;
}

/**
 * Look up a record by device code (agent polling).
 */
export function getByDeviceCode(
  deviceCode: string
): DeviceAuthRecord | undefined {
  const record = store.get(deviceCode);
  if (!record) return undefined;
  if (Date.now() >= record.expiresAt) {
    store.delete(deviceCode);
    userCodeIndex.delete(record.userCode);
    return undefined;
  }
  return record;
}

/**
 * Look up a record by user code (Portal UI).
 */
export function getByUserCode(userCode: string): DeviceAuthRecord | undefined {
  const deviceCode = userCodeIndex.get(userCode.toUpperCase());
  if (!deviceCode) return undefined;
  return getByDeviceCode(deviceCode);
}

/**
 * Update a record (e.g., set user info after OAuth, or provision key).
 */
export function updateRecord(
  deviceCode: string,
  updates: Partial<DeviceAuthRecord>
): DeviceAuthRecord | undefined {
  const record = getByDeviceCode(deviceCode);
  if (!record) return undefined;

  const updated = { ...record, ...updates };
  store.set(deviceCode, updated);
  return updated;
}

/**
 * Mark a record as provisioned with the signing key and agent metadata.
 * After this, the next agent poll will receive the key (one-time delivery).
 */
export function completeProvisioning(
  deviceCode: string,
  key: ProvisionedKey,
  agentRecord: DeviceAuthRecord['agentRecord']
): DeviceAuthRecord | undefined {
  return updateRecord(deviceCode, {
    status: 'provisioned',
    provisionedKey: key,
    agentRecord,
  });
}

/**
 * Consume the provisioned key (agent retrieves it, then it's cleared
 * from the record to prevent re-retrieval).
 */
export function consumeProvisionedKey(deviceCode: string):
  | {
      key: ProvisionedKey;
      agentRecord: DeviceAuthRecord['agentRecord'];
      nodeUrl: string;
      packageDownloadUrl?: string;
    }
  | undefined {
  const record = getByDeviceCode(deviceCode);
  if (!record || record.status !== 'provisioned' || !record.provisionedKey) {
    return undefined;
  }

  const result = {
    key: record.provisionedKey,
    agentRecord: record.agentRecord,
    nodeUrl: record.nodeUrl,
    packageDownloadUrl: record.packageDownloadUrl,
  };

  // Clear the private key from the store after delivery
  store.delete(deviceCode);
  userCodeIndex.delete(record.userCode);

  return result;
}

export const DEVICE_CODE_TTL_SECONDS = DEVICE_CODE_TTL_MS / 1000;
export const POLL_INTERVAL_SECONDS = 5;
