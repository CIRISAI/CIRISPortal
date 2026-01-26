/**
 * Key custody types for CIRISPortal
 *
 * These types define the interface for cryptographic key management.
 * The implementation is abstracted to allow migration from Cloudflare KV
 * to HSM/Vault in the future.
 */

export interface KeyPairMetadata {
  keyId: string;
  orgId: string;
  status: 'active' | 'rotated' | 'revoked';
  createdAt: string; // ISO 8601
  rotatedAt?: string; // ISO 8601, if rotated
  algorithm: {
    classical: 'Ed25519';
    postQuantum: 'ML-DSA-65';
  };
}

export interface PublicKeys {
  keyId: string;
  classical: {
    algorithm: 'Ed25519';
    publicKey: string; // Base64 encoded
  };
  postQuantum: {
    algorithm: 'ML-DSA-65';
    publicKey: string; // Base64 encoded
  };
}

export interface HybridSignature {
  classicalSignature: string; // Base64 encoded Ed25519 signature
  postQuantumSignature: string; // Base64 encoded ML-DSA-65 signature
  timestamp: number; // Unix timestamp
  keyId: string;
}

export interface SignRequest {
  orgId: string;
  keyId: string;
  message: Uint8Array;
  purpose: string; // For audit logging
}

export interface KeyRotationResult {
  oldKeyId: string;
  newKeyId: string;
  rotatedAt: string;
}

/**
 * KeyStore interface - abstraction over key storage backends
 *
 * Implementations:
 * - CloudflareKVKeyStore: Uses Cloudflare Workers KV with envelope encryption
 * - VaultKeyStore: (future) Uses HashiCorp Vault
 * - HSMKeyStore: (future) Uses hardware security module
 */
export interface KeyStore {
  /**
   * Generate a new key pair for an organization
   * Private keys are encrypted and stored; only public keys are returned
   */
  generateKeyPair(orgId: string): Promise<KeyPairMetadata>;

  /**
   * Get public keys for an organization
   * Returns the currently active key pair's public keys
   */
  getPublicKeys(orgId: string, keyId?: string): Promise<PublicKeys | null>;

  /**
   * Sign a message using the organization's custodied private key
   * Returns a hybrid signature (classical + post-quantum)
   */
  sign(request: SignRequest): Promise<HybridSignature>;

  /**
   * Rotate keys for an organization
   * Creates a new key pair and marks the old one as rotated
   * Old keys remain available for verification but not signing
   */
  rotateKeys(orgId: string): Promise<KeyRotationResult>;

  /**
   * List all key pairs for an organization (metadata only)
   */
  listKeys(orgId: string): Promise<KeyPairMetadata[]>;

  /**
   * Revoke a specific key pair
   * Revoked keys cannot be used for signing or verification
   */
  revokeKey(orgId: string, keyId: string, reason: string): Promise<void>;

  /**
   * Check if an organization has an active key pair
   */
  hasActiveKey(orgId: string): Promise<boolean>;
}

/**
 * Audit entry for key operations
 */
export interface KeyAuditEntry {
  id: string;
  timestamp: string;
  operation: 'generate' | 'sign' | 'rotate' | 'revoke' | 'export_public';
  orgId: string;
  keyId: string;
  actorId: string; // User or system that initiated the operation
  actorEmail?: string;
  purpose?: string;
  messageHash?: string; // SHA-256 of signed message (for sign operations)
  success: boolean;
  errorMessage?: string;
  signature?: string; // Signature over the audit entry itself
}
