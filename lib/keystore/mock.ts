/**
 * In-memory mock KeyStore implementation for development and testing
 *
 * This implementation stores keys in memory using a Map, making it useful for:
 * - Local development without Cloudflare KV
 * - Unit testing
 * - CI/CD environments
 *
 * Note: Keys are stored in memory and will be lost when the process exits.
 * This is intentional for a development/test implementation.
 */

import type {
  KeyStore,
  KeyPairMetadata,
  PublicKeys,
  HybridSignature,
  SignRequest,
  KeyRotationResult,
} from './types';
import {
  generateEncryptedKeyPair,
  signWithEncryptedKey,
  deriveOrgKey,
  type EncryptedKeyData,
} from './crypto';

interface StoredKeyPair {
  metadata: KeyPairMetadata;
  publicKeys: PublicKeys;
  encryptedData: EncryptedKeyData;
}

/**
 * In-memory mock implementation of KeyStore
 */
export class MockKeyStore implements KeyStore {
  // In-memory storage
  private keys: Map<string, StoredKeyPair> = new Map();
  private activeKeys: Map<string, string> = new Map(); // orgId -> keyId

  // Mock master key for development (32 bytes)
  // In production, this comes from MASTER_KEK environment variable
  private mockMasterKey: Uint8Array;

  constructor(masterKey?: Uint8Array) {
    // Use provided master key or generate a random one for testing
    if (masterKey) {
      this.mockMasterKey = masterKey;
    } else {
      // Generate a deterministic test key (NOT for production!)
      // This allows tests to be reproducible
      this.mockMasterKey = new Uint8Array(32);
      const testSeed = new TextEncoder().encode(
        'ciris-mock-keystore-dev-only!!'
      );
      this.mockMasterKey.set(testSeed.slice(0, 32));
    }
  }

  private getStorageKey(orgId: string, keyId: string): string {
    return `${orgId}:${keyId}`;
  }

  private generateKeyId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `k_${timestamp}${random}`;
  }

  async generateKeyPair(orgId: string): Promise<KeyPairMetadata> {
    const keyId = this.generateKeyId();
    const now = new Date().toISOString();

    // Derive org-specific key from master key
    const orgKey = await deriveOrgKey(this.mockMasterKey, orgId);

    // Generate encrypted key pair
    const encryptedData = await generateEncryptedKeyPair(orgKey);

    // Clear sensitive org key from memory
    orgKey.fill(0);

    const metadata: KeyPairMetadata = {
      keyId,
      orgId,
      status: 'active',
      createdAt: now,
      algorithm: {
        classical: 'Ed25519',
        postQuantum: 'ML-DSA-65',
      },
    };

    const publicKeys: PublicKeys = {
      keyId,
      classical: {
        algorithm: 'Ed25519',
        publicKey: encryptedData.classicalPublic,
      },
      postQuantum: {
        algorithm: 'ML-DSA-65',
        publicKey: encryptedData.postQuantumPublic,
      },
    };

    // Store in memory
    const storageKey = this.getStorageKey(orgId, keyId);
    this.keys.set(storageKey, {
      metadata,
      publicKeys,
      encryptedData,
    });

    // Update active key for org
    this.activeKeys.set(orgId, keyId);

    console.log(`[MockKeyStore] Generated key pair ${keyId} for org ${orgId}`);

    return metadata;
  }

  async getPublicKeys(
    orgId: string,
    keyId?: string
  ): Promise<PublicKeys | null> {
    const targetKeyId = keyId || this.activeKeys.get(orgId);
    if (!targetKeyId) {
      return null;
    }

    const storageKey = this.getStorageKey(orgId, targetKeyId);
    const stored = this.keys.get(storageKey);

    if (!stored) {
      return null;
    }

    return stored.publicKeys;
  }

  async sign(request: SignRequest): Promise<HybridSignature> {
    const { orgId, keyId, message, purpose } = request;

    const storageKey = this.getStorageKey(orgId, keyId);
    const stored = this.keys.get(storageKey);

    if (!stored) {
      throw new Error(`Key ${keyId} not found for org ${orgId}`);
    }

    if (stored.metadata.status !== 'active') {
      throw new Error(`Key ${keyId} is ${stored.metadata.status}, cannot sign`);
    }

    // Derive org key and sign
    const orgKey = await deriveOrgKey(this.mockMasterKey, orgId);

    const { classicalSignature, postQuantumSignature } =
      await signWithEncryptedKey(stored.encryptedData, orgKey, message);

    // Clear sensitive data
    orgKey.fill(0);

    const timestamp = Math.floor(Date.now() / 1000);

    console.log(
      `[MockKeyStore] Signed message with key ${keyId} for org ${orgId}, purpose: ${purpose}`
    );

    return {
      classicalSignature,
      postQuantumSignature,
      timestamp,
      keyId,
    };
  }

  async rotateKeys(orgId: string): Promise<KeyRotationResult> {
    const oldKeyId = this.activeKeys.get(orgId);
    if (!oldKeyId) {
      throw new Error(`No active key found for org ${orgId}`);
    }

    // Mark old key as rotated
    const oldStorageKey = this.getStorageKey(orgId, oldKeyId);
    const oldStored = this.keys.get(oldStorageKey);
    if (oldStored) {
      oldStored.metadata.status = 'rotated';
      oldStored.metadata.rotatedAt = new Date().toISOString();
    }

    // Generate new key pair
    const newMetadata = await this.generateKeyPair(orgId);

    console.log(
      `[MockKeyStore] Rotated keys for org ${orgId}: ${oldKeyId} -> ${newMetadata.keyId}`
    );

    return {
      oldKeyId,
      newKeyId: newMetadata.keyId,
      rotatedAt: new Date().toISOString(),
    };
  }

  async listKeys(orgId: string): Promise<KeyPairMetadata[]> {
    const result: KeyPairMetadata[] = [];

    for (const [key, stored] of this.keys.entries()) {
      if (key.startsWith(`${orgId}:`)) {
        result.push(stored.metadata);
      }
    }

    // Sort by creation date, newest first
    result.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return result;
  }

  async revokeKey(orgId: string, keyId: string, reason: string): Promise<void> {
    const storageKey = this.getStorageKey(orgId, keyId);
    const stored = this.keys.get(storageKey);

    if (!stored) {
      throw new Error(`Key ${keyId} not found for org ${orgId}`);
    }

    stored.metadata.status = 'revoked';

    // If this was the active key, remove it from active keys
    if (this.activeKeys.get(orgId) === keyId) {
      this.activeKeys.delete(orgId);
    }

    console.log(
      `[MockKeyStore] Revoked key ${keyId} for org ${orgId}: ${reason}`
    );
  }

  async hasActiveKey(orgId: string): Promise<boolean> {
    const activeKeyId = this.activeKeys.get(orgId);
    if (!activeKeyId) {
      return false;
    }

    const storageKey = this.getStorageKey(orgId, activeKeyId);
    const stored = this.keys.get(storageKey);

    return stored?.metadata.status === 'active';
  }

  // Test helper methods

  /**
   * Clear all stored keys (for testing)
   */
  clear(): void {
    this.keys.clear();
    this.activeKeys.clear();
  }

  /**
   * Get the number of stored keys (for testing)
   */
  getKeyCount(): number {
    return this.keys.size;
  }

  /**
   * Export all keys for debugging (metadata only, no private keys)
   */
  exportMetadata(): KeyPairMetadata[] {
    return Array.from(this.keys.values()).map((stored) => stored.metadata);
  }
}

/**
 * Create a MockKeyStore with a random master key for testing
 */
export function createTestKeyStore(): MockKeyStore {
  // Generate a random master key for each test
  const masterKey = new Uint8Array(32);
  if (typeof globalThis.crypto !== 'undefined') {
    globalThis.crypto.getRandomValues(masterKey);
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < 32; i++) {
      masterKey[i] = Math.floor(Math.random() * 256);
    }
  }
  return new MockKeyStore(masterKey);
}

/**
 * Create a MockKeyStore with a deterministic key for reproducible tests
 */
export function createDeterministicTestKeyStore(seed: string): MockKeyStore {
  const masterKey = new Uint8Array(32);
  const seedBytes = new TextEncoder().encode(seed);
  // Simple deterministic key derivation (NOT for production!)
  for (let i = 0; i < 32; i++) {
    masterKey[i] = seedBytes[i % seedBytes.length] ^ (i * 7);
  }
  return new MockKeyStore(masterKey);
}
