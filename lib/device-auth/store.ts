/**
 * Device auth code storage with PostgreSQL persistence.
 *
 * Implements RFC 8628 device code storage for the "Acquire a License"
 * provisioning flow. Agents initiate a device auth session, users
 * authenticate in the browser, and the provisioned key is delivered
 * back to the agent via polling.
 *
 * Uses PostgreSQL for persistence across restarts and multiple instances.
 */

import crypto from 'crypto';
import {
  query,
  queryOne,
  initializeDatabase,
  cleanupExpiredSessions,
} from '@/lib/db/client';

export interface DeviceAuthAgentInfo {
  agentHash?: string;
  currentPublicKey?: string;
  requestedAdapters?: string[];
}

export interface ProvisionedKey {
  ed25519PrivateKey: string; // base64, one-time delivery (DEPRECATED: custodied flow only)
  ed25519PublicKey: string; // base64
  keyId: string;
  orgId: string;
  agentRecordHash?: string;
}

/**
 * Self-custody key info - stores only public key metadata.
 * Private key NEVER leaves the agent device.
 */
export interface SelfCustodyKeyInfo {
  keyId: string; // Key ID from Registry
  ed25519PublicKeyFingerprint: string; // SHA256 fingerprint of public key
  ed25519PublicKey?: string; // hex-encoded public key (optional, fingerprint is canonical)
  registeredAt: number; // Timestamp when key was registered
  activated: boolean; // True after agent proves possession via activation challenge
}

export interface DeviceAuthRecord {
  deviceCode: string; // Opaque secret (agent polls with this)
  userCode: string; // Human-readable code (embedded in verification URL)
  portalUrl: string; // Portal URL the agent is connecting through
  nodeManifest: Record<string, unknown>; // Additional metadata
  agentInfo: DeviceAuthAgentInfo;
  status: 'pending' | 'authorized' | 'provisioned' | 'expired' | 'denied';
  userId?: string; // Set after OAuth
  orgId?: string; // Set after OAuth
  selectedTemplate?: string;
  selectedAdapters?: string[];
  provisionedKey?: ProvisionedKey; // DEPRECATED: Only for legacy custodied flow
  selfCustodyKey?: SelfCustodyKeyInfo; // Self-custody: public key registered by agent
  agentRecord?: {
    identityTemplate: string;
    stewardshipTier: number;
    permittedActions: string[];
    approvedAdapters: string[];
  };
  agentRecordHash?: string; // Agent identity hash (build hash for CIRIS, random for non-CIRIS)
  agentCategory?: 'ciris' | 'non_ciris'; // CIRIS or third-party agent
  stripeSessionId?: string; // Stripe checkout session for payment tracking
  paymentComplete?: boolean; // Set true after successful Stripe payment
  challengeNonce?: string; // Hex-encoded 32-byte nonce for CIRISVerify attestation
  attestationProof?: Record<string, unknown>; // AttestationProof from CIRISVerify
  attestationVerified?: boolean; // Set true after server-side verification
  hardwareType?: string; // e.g. "TPM_2_0", "IOS_SECURE_ENCLAVE", "SOFTWARE_ONLY"
  packageDownloadUrl?: string; // URL to download licensed module package zip
  keyActivated?: boolean; // Set true after agent proves key possession
  createdAt: number;
  expiresAt: number; // createdAt + TTL
}

const DEVICE_CODE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // Cleanup every minute

let dbInitialized = false;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

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

/**
 * Ensure database is initialized.
 */
async function ensureInitialized(): Promise<void> {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
    startCleanup();
  }
}

/**
 * Start periodic cleanup of expired sessions.
 */
function startCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(async () => {
    try {
      const count = await cleanupExpiredSessions();
      if (count > 0) {
        console.log(`[Device Auth] Cleaned up ${count} expired sessions`);
      }
    } catch (err) {
      console.error('[Device Auth] Cleanup error:', err);
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Convert database row to DeviceAuthRecord.
 */
function rowToRecord(row: {
  device_code: string;
  user_code: string;
  data: DeviceAuthRecord;
  expires_at: Date;
}): DeviceAuthRecord {
  return {
    ...row.data,
    deviceCode: row.device_code,
    userCode: row.user_code,
    expiresAt: row.expires_at.getTime(),
  };
}

/**
 * Create a new device auth session.
 */
export async function createDeviceAuth(
  portalUrl: string,
  nodeManifest: Record<string, unknown>,
  agentInfo: DeviceAuthAgentInfo
): Promise<DeviceAuthRecord> {
  await ensureInitialized();

  const now = Date.now();
  const record: DeviceAuthRecord = {
    deviceCode: generateDeviceCode(),
    userCode: generateUserCode(),
    challengeNonce: crypto.randomBytes(32).toString('hex'),
    portalUrl,
    nodeManifest,
    agentInfo,
    status: 'pending',
    createdAt: now,
    expiresAt: now + DEVICE_CODE_TTL_MS,
  };

  await query(
    `INSERT INTO device_auth_sessions (device_code, user_code, data, expires_at)
     VALUES ($1, $2, $3, to_timestamp($4 / 1000.0))`,
    [
      record.deviceCode,
      record.userCode,
      JSON.stringify(record),
      record.expiresAt,
    ]
  );

  return record;
}

/**
 * Look up a record by device code (agent polling).
 */
export async function getByDeviceCode(
  deviceCode: string
): Promise<DeviceAuthRecord | undefined> {
  await ensureInitialized();

  const row = await queryOne<{
    device_code: string;
    user_code: string;
    data: DeviceAuthRecord;
    expires_at: Date;
  }>(
    `SELECT device_code, user_code, data, expires_at
     FROM device_auth_sessions
     WHERE device_code = $1 AND expires_at > NOW()`,
    [deviceCode]
  );

  if (!row) return undefined;
  return rowToRecord(row);
}

/**
 * Look up a record by user code (Portal UI).
 */
export async function getByUserCode(
  userCode: string
): Promise<DeviceAuthRecord | undefined> {
  await ensureInitialized();

  const row = await queryOne<{
    device_code: string;
    user_code: string;
    data: DeviceAuthRecord;
    expires_at: Date;
  }>(
    `SELECT device_code, user_code, data, expires_at
     FROM device_auth_sessions
     WHERE user_code = $1 AND expires_at > NOW()`,
    [userCode.toUpperCase()]
  );

  if (!row) return undefined;
  return rowToRecord(row);
}

/**
 * Update a record (e.g., set user info after OAuth, or provision key).
 */
export async function updateRecord(
  deviceCode: string,
  updates: Partial<DeviceAuthRecord>
): Promise<DeviceAuthRecord | undefined> {
  await ensureInitialized();

  const existing = await getByDeviceCode(deviceCode);
  if (!existing) return undefined;

  const updated: DeviceAuthRecord = { ...existing, ...updates };

  await query(
    `UPDATE device_auth_sessions
     SET data = $1
     WHERE device_code = $2`,
    [JSON.stringify(updated), deviceCode]
  );

  return updated;
}

/**
 * Mark a record as provisioned with the signing key and agent metadata.
 * After this, the next agent poll will receive the key (one-time delivery).
 *
 * @deprecated Use completeSelfCustodyRegistration for self-custody flow.
 * This function is only for legacy custodied key delivery.
 */
export async function completeProvisioning(
  deviceCode: string,
  key: ProvisionedKey,
  agentRecord: DeviceAuthRecord['agentRecord']
): Promise<DeviceAuthRecord | undefined> {
  return updateRecord(deviceCode, {
    status: 'provisioned',
    provisionedKey: key,
    agentRecord,
  });
}

/**
 * Complete self-custody key registration.
 * Stores ONLY public key metadata - private key never leaves the agent device.
 *
 * Called after agent successfully registers its public key via /api/device/register-key.
 */
export async function completeSelfCustodyRegistration(
  deviceCode: string,
  keyInfo: SelfCustodyKeyInfo
): Promise<DeviceAuthRecord | undefined> {
  return updateRecord(deviceCode, {
    status: 'provisioned',
    selfCustodyKey: keyInfo,
  });
}

/**
 * Consume the provisioned key (agent retrieves it, then it's cleared
 * from the record to prevent re-retrieval).
 */
export async function consumeProvisionedKey(deviceCode: string): Promise<
  | {
      key: ProvisionedKey;
      agentRecord: DeviceAuthRecord['agentRecord'];
      portalUrl: string;
      packageDownloadUrl?: string;
    }
  | undefined
> {
  await ensureInitialized();

  const record = await getByDeviceCode(deviceCode);
  if (!record || record.status !== 'provisioned' || !record.provisionedKey) {
    return undefined;
  }

  const result = {
    key: record.provisionedKey,
    agentRecord: record.agentRecord,
    portalUrl: record.portalUrl,
    packageDownloadUrl: record.packageDownloadUrl,
  };

  // Delete the record after delivery (one-time)
  await query('DELETE FROM device_auth_sessions WHERE device_code = $1', [
    deviceCode,
  ]);

  return result;
}

/**
 * Mark device auth records as paid by Stripe session ID.
 * Called from the Stripe webhook when checkout.session.completed fires.
 */
export async function markDevicePaymentComplete(
  stripeSessionId: string
): Promise<boolean> {
  await ensureInitialized();

  const row = await queryOne<{
    device_code: string;
    user_code: string;
    data: DeviceAuthRecord;
    expires_at: Date;
  }>(
    `SELECT device_code, user_code, data, expires_at
     FROM device_auth_sessions
     WHERE data->>'stripeSessionId' = $1 AND expires_at > NOW()`,
    [stripeSessionId]
  );

  if (!row) {
    console.log(
      `[Device Auth] No device found for Stripe session ${stripeSessionId}`
    );
    return false;
  }

  const record = rowToRecord(row);
  record.paymentComplete = true;
  record.status = 'authorized'; // Payment complete = authorized to proceed

  await query(
    `UPDATE device_auth_sessions
     SET data = $1
     WHERE device_code = $2`,
    [JSON.stringify(record), record.deviceCode]
  );

  console.log(
    `[Device Auth] Payment complete, status=authorized for device ${record.userCode} (Stripe session ${stripeSessionId})`
  );
  return true;
}

export const DEVICE_CODE_TTL_SECONDS = DEVICE_CODE_TTL_MS / 1000;
export const POLL_INTERVAL_SECONDS = 5;
