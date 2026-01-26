/**
 * Cloudflare KV KeyStore implementation
 *
 * Stores encrypted private keys in Cloudflare Workers KV.
 * Uses envelope encryption: each key pair has a unique DEK (data encryption key),
 * which is encrypted with the master KEK (key encryption key).
 *
 * Key storage format:
 *   keys:{orgId}:active -> keyId of active key
 *   keys:{orgId}:{keyId}:metadata -> KeyPairMetadata (JSON)
 *   keys:{orgId}:{keyId}:public -> PublicKeys (JSON)
 *   keys:{orgId}:{keyId}:private -> EncryptedKeyData (JSON)
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
  getMasterKEK,
  type EncryptedKeyData,
} from './crypto';

export class CloudflareKVKeyStore implements KeyStore {
  // KV namespace injected from Cloudflare Workers context
  private kv: KVNamespace | null = null;

  // Cached master KEK (loaded on first use)
  private masterKEK: Uint8Array | null = null;

  constructor(kv?: KVNamespace) {
    this.kv = kv || null;
  }

  private getKV(): KVNamespace {
    if (!this.kv) {
      throw new Error(
        'KV namespace not initialized. In Cloudflare Workers, pass the KV binding to the constructor. ' +
          'In development, use MockKeyStore instead.'
      );
    }
    return this.kv;
  }

  private async getMasterKey(): Promise<Uint8Array> {
    if (!this.masterKEK) {
      this.masterKEK = getMasterKEK();
    }
    return this.masterKEK;
  }

  private async getOrgKey(orgId: string): Promise<Uint8Array> {
    const masterKey = await this.getMasterKey();
    return deriveOrgKey(masterKey, orgId);
  }

  private generateKeyId(): string {
    // Generate a unique key ID with prefix and timestamp
    const timestamp = Date.now().toString(36);
    const randomBytes = new Uint8Array(4);
    if (typeof globalThis.crypto !== 'undefined') {
      globalThis.crypto.getRandomValues(randomBytes);
    } else {
      // Fallback (should not happen in Cloudflare Workers)
      for (let i = 0; i < 4; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256);
      }
    }
    const random = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `k_${timestamp}${random}`;
  }

  // Storage key helpers
  private activeKeyPath(orgId: string): string {
    return `keys:${orgId}:active`;
  }

  private metadataPath(orgId: string, keyId: string): string {
    return `keys:${orgId}:${keyId}:metadata`;
  }

  private publicKeyPath(orgId: string, keyId: string): string {
    return `keys:${orgId}:${keyId}:public`;
  }

  private privateKeyPath(orgId: string, keyId: string): string {
    return `keys:${orgId}:${keyId}:private`;
  }

  async generateKeyPair(orgId: string): Promise<KeyPairMetadata> {
    const kv = this.getKV();
    const keyId = this.generateKeyId();
    const now = new Date().toISOString();

    // Derive org-specific key from master key
    const orgKey = await this.getOrgKey(orgId);

    try {
      // Generate encrypted key pair using WebCrypto
      const encryptedData = await generateEncryptedKeyPair(orgKey);

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

      // Store all key data in KV
      await Promise.all([
        kv.put(this.metadataPath(orgId, keyId), JSON.stringify(metadata)),
        kv.put(this.publicKeyPath(orgId, keyId), JSON.stringify(publicKeys)),
        kv.put(
          this.privateKeyPath(orgId, keyId),
          JSON.stringify(encryptedData)
        ),
        kv.put(this.activeKeyPath(orgId), keyId),
      ]);

      console.log(
        `[CloudflareKVKeyStore] Generated key pair ${keyId} for org ${orgId}`
      );

      return metadata;
    } finally {
      // Clear sensitive org key from memory
      orgKey.fill(0);
    }
  }

  async getPublicKeys(
    orgId: string,
    keyId?: string
  ): Promise<PublicKeys | null> {
    const kv = this.getKV();

    // If no keyId provided, get the active key
    const targetKeyId = keyId || (await this.getActiveKeyId(orgId));
    if (!targetKeyId) {
      return null;
    }

    const publicKeysJson = await kv.get(
      this.publicKeyPath(orgId, targetKeyId),
      'json'
    );

    if (!publicKeysJson) {
      return null;
    }

    return publicKeysJson as PublicKeys;
  }

  async sign(request: SignRequest): Promise<HybridSignature> {
    const { orgId, keyId, message, purpose } = request;
    const kv = this.getKV();

    // Verify the key exists and is active
    const metadata = await this.getKeyMetadata(orgId, keyId);
    if (!metadata) {
      throw new Error(`Key ${keyId} not found for org ${orgId}`);
    }
    if (metadata.status !== 'active') {
      throw new Error(`Key ${keyId} is ${metadata.status}, cannot sign`);
    }

    // Get encrypted private key data
    const encryptedData = (await kv.get(
      this.privateKeyPath(orgId, keyId),
      'json'
    )) as EncryptedKeyData | null;

    if (!encryptedData) {
      throw new Error(`Private key data not found for key ${keyId}`);
    }

    // Derive org key and sign
    const orgKey = await this.getOrgKey(orgId);

    try {
      const { classicalSignature, postQuantumSignature } =
        await signWithEncryptedKey(encryptedData, orgKey, message);

      const timestamp = Math.floor(Date.now() / 1000);

      console.log(
        `[CloudflareKVKeyStore] Signed message with key ${keyId} for org ${orgId}, purpose: ${purpose}`
      );

      return {
        classicalSignature,
        postQuantumSignature,
        timestamp,
        keyId,
      };
    } finally {
      // Clear sensitive data
      orgKey.fill(0);
    }
  }

  async rotateKeys(orgId: string): Promise<KeyRotationResult> {
    const kv = this.getKV();
    const oldKeyId = await this.getActiveKeyId(orgId);

    if (!oldKeyId) {
      throw new Error(`No active key found for org ${orgId}`);
    }

    // Get old key metadata
    const oldMetadata = await this.getKeyMetadata(orgId, oldKeyId);
    if (!oldMetadata) {
      throw new Error(`Metadata not found for key ${oldKeyId}`);
    }

    // Generate new key pair (this also updates the active key pointer)
    const newMetadata = await this.generateKeyPair(orgId);

    // Mark old key as rotated
    const now = new Date().toISOString();
    oldMetadata.status = 'rotated';
    oldMetadata.rotatedAt = now;

    await kv.put(
      this.metadataPath(orgId, oldKeyId),
      JSON.stringify(oldMetadata)
    );

    console.log(
      `[CloudflareKVKeyStore] Rotated keys for org ${orgId}: ${oldKeyId} -> ${newMetadata.keyId}`
    );

    return {
      oldKeyId,
      newKeyId: newMetadata.keyId,
      rotatedAt: now,
    };
  }

  async listKeys(orgId: string): Promise<KeyPairMetadata[]> {
    const kv = this.getKV();

    // List all keys with the org prefix
    const prefix = `keys:${orgId}:`;
    const listResult = await kv.list({ prefix });

    // Filter for metadata keys and fetch them
    const metadataKeys = listResult.keys.filter((key) =>
      key.name.endsWith(':metadata')
    );

    const results: KeyPairMetadata[] = [];

    for (const key of metadataKeys) {
      const metadata = (await kv.get(
        key.name,
        'json'
      )) as KeyPairMetadata | null;
      if (metadata) {
        results.push(metadata);
      }
    }

    // Sort by creation date, newest first
    results.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return results;
  }

  async revokeKey(orgId: string, keyId: string, reason: string): Promise<void> {
    const kv = this.getKV();
    const metadata = await this.getKeyMetadata(orgId, keyId);

    if (!metadata) {
      throw new Error(`Key ${keyId} not found for org ${orgId}`);
    }

    // Update key status to revoked
    metadata.status = 'revoked';

    await kv.put(this.metadataPath(orgId, keyId), JSON.stringify(metadata));

    // If this was the active key, remove the active pointer
    const activeKeyId = await this.getActiveKeyId(orgId);
    if (activeKeyId === keyId) {
      await kv.delete(this.activeKeyPath(orgId));
    }

    console.log(
      `[CloudflareKVKeyStore] Revoked key ${keyId} for org ${orgId}: ${reason}`
    );
  }

  async hasActiveKey(orgId: string): Promise<boolean> {
    const activeKeyId = await this.getActiveKeyId(orgId);
    if (!activeKeyId) {
      return false;
    }

    const metadata = await this.getKeyMetadata(orgId, activeKeyId);
    return metadata?.status === 'active';
  }

  // Helper methods

  private async getActiveKeyId(orgId: string): Promise<string | null> {
    const kv = this.getKV();
    return kv.get(this.activeKeyPath(orgId));
  }

  private async getKeyMetadata(
    orgId: string,
    keyId: string
  ): Promise<KeyPairMetadata | null> {
    const kv = this.getKV();
    return kv.get(
      this.metadataPath(orgId, keyId),
      'json'
    ) as Promise<KeyPairMetadata | null>;
  }
}

// Type declaration for Cloudflare Workers KV
// This would normally come from @cloudflare/workers-types
declare global {
  interface KVNamespace {
    get(key: string, type?: 'text'): Promise<string | null>;
    get<T>(key: string, type: 'json'): Promise<T | null>;
    get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
    put(
      key: string,
      value: string | ArrayBuffer | ReadableStream
    ): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: {
      prefix?: string;
      limit?: number;
      cursor?: string;
    }): Promise<{
      keys: { name: string; expiration?: number; metadata?: unknown }[];
      list_complete: boolean;
      cursor?: string;
    }>;
  }
}
