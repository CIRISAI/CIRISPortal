/**
 * Cryptographic utilities for KeyStore envelope encryption
 *
 * Uses Web Crypto API (crypto.subtle) for compatibility with both
 * Node.js (v19+) and Cloudflare Workers.
 *
 * Envelope encryption scheme:
 * 1. Master KEK (Key Encryption Key) is stored as environment secret
 * 2. Each org has a derived key via HKDF: org_key = HKDF(master_key, org_id)
 * 3. Each key pair has a random DEK (Data Encryption Key)
 * 4. DEK is encrypted with org_key and stored alongside encrypted data
 * 5. Private keys are encrypted with DEK using AES-256-GCM
 */

// Get the crypto object - works in both Node.js and Cloudflare Workers
const getCrypto = (): Crypto => {
  if (typeof globalThis.crypto !== 'undefined') {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API not available');
};

/**
 * Convert Uint8Array to Base64 string
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert ArrayBuffer to Base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return uint8ArrayToBase64(new Uint8Array(buffer));
}

/**
 * Convert Base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to Uint8Array
 */
export function arrayBufferToUint8Array(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}

/**
 * Generate a random 256-bit Data Encryption Key (DEK)
 */
export async function generateDEK(): Promise<Uint8Array> {
  const crypto = getCrypto();
  const dek = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(dek);
  return dek;
}

/**
 * Generate a random initialization vector for AES-GCM
 * AES-GCM recommends 96-bit (12 byte) IVs
 */
export async function generateIV(): Promise<Uint8Array> {
  const crypto = getCrypto();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  return iv;
}

/**
 * Import a raw key for AES-GCM operations
 */
async function importAESKey(keyData: Uint8Array): Promise<CryptoKey> {
  const crypto = getCrypto();
  return crypto.subtle.importKey(
    'raw',
    keyData as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive an organization-specific key from the master KEK using HKDF
 *
 * @param masterKey - The master Key Encryption Key (256 bits)
 * @param orgId - Organization identifier used as HKDF info
 * @returns Derived 256-bit key for the organization
 */
export async function deriveOrgKey(
  masterKey: Uint8Array,
  orgId: string
): Promise<Uint8Array> {
  const crypto = getCrypto();

  // Import master key for HKDF
  const baseKey = await crypto.subtle.importKey(
    'raw',
    masterKey as BufferSource,
    'HKDF',
    false,
    ['deriveBits']
  );

  // Use orgId as info, with a fixed salt for the application
  const salt = new TextEncoder().encode('ciris-portal-keys-v1');
  const info = new TextEncoder().encode(orgId);

  // Derive 256 bits
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info,
    },
    baseKey,
    256
  );

  return new Uint8Array(derivedBits);
}

/**
 * Encrypt data using AES-256-GCM
 *
 * @param data - Data to encrypt
 * @param key - 256-bit encryption key
 * @param iv - 96-bit initialization vector
 * @returns Encrypted data (ciphertext + auth tag)
 */
export async function encryptAESGCM(
  data: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  const crypto = getCrypto();
  const cryptoKey = await importAESKey(key);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    cryptoKey,
    data as BufferSource
  );

  return new Uint8Array(encrypted);
}

/**
 * Decrypt data using AES-256-GCM
 *
 * @param encryptedData - Ciphertext + auth tag
 * @param key - 256-bit encryption key
 * @param iv - 96-bit initialization vector
 * @returns Decrypted data
 */
export async function decryptAESGCM(
  encryptedData: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  const crypto = getCrypto();
  const cryptoKey = await importAESKey(key);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    cryptoKey,
    encryptedData as BufferSource
  );

  return new Uint8Array(decrypted);
}

/**
 * Encrypt a DEK with the organization's KEK
 *
 * @param dek - Data Encryption Key to encrypt
 * @param kek - Key Encryption Key (organization-specific)
 * @returns Object containing encrypted DEK and IV
 */
export async function encryptDEKWithKEK(
  dek: Uint8Array,
  kek: Uint8Array
): Promise<{ encryptedDEK: string; dekIV: string }> {
  const iv = await generateIV();
  const encrypted = await encryptAESGCM(dek, kek, iv);

  return {
    encryptedDEK: uint8ArrayToBase64(encrypted),
    dekIV: uint8ArrayToBase64(iv),
  };
}

/**
 * Decrypt a DEK with the organization's KEK
 *
 * @param encryptedDEK - Base64-encoded encrypted DEK
 * @param dekIV - Base64-encoded IV used for DEK encryption
 * @param kek - Key Encryption Key (organization-specific)
 * @returns Decrypted DEK
 */
export async function decryptDEKWithKEK(
  encryptedDEK: string,
  dekIV: string,
  kek: Uint8Array
): Promise<Uint8Array> {
  const encrypted = new Uint8Array(base64ToArrayBuffer(encryptedDEK));
  const iv = new Uint8Array(base64ToArrayBuffer(dekIV));

  return decryptAESGCM(encrypted, kek, iv);
}

/**
 * Encrypt a private key with a DEK
 *
 * @param privateKey - Private key bytes to encrypt
 * @param dek - Data Encryption Key
 * @returns Object containing encrypted key and IV
 */
export async function encryptPrivateKey(
  privateKey: Uint8Array,
  dek: Uint8Array
): Promise<{ encryptedKey: string; keyIV: string }> {
  const iv = await generateIV();
  const encrypted = await encryptAESGCM(privateKey, dek, iv);

  return {
    encryptedKey: uint8ArrayToBase64(encrypted),
    keyIV: uint8ArrayToBase64(iv),
  };
}

/**
 * Decrypt a private key with a DEK
 *
 * @param encryptedKey - Base64-encoded encrypted private key
 * @param keyIV - Base64-encoded IV used for key encryption
 * @param dek - Data Encryption Key
 * @returns Decrypted private key bytes
 */
export async function decryptPrivateKey(
  encryptedKey: string,
  keyIV: string,
  dek: Uint8Array
): Promise<Uint8Array> {
  const encrypted = new Uint8Array(base64ToArrayBuffer(encryptedKey));
  const iv = new Uint8Array(base64ToArrayBuffer(keyIV));

  return decryptAESGCM(encrypted, dek, iv);
}

/**
 * Ed25519 key pair generation using Web Crypto API
 *
 * Note: Ed25519 support in Web Crypto API was added in:
 * - Node.js v18.4.0+ (behind flag), v20.0.0+ (stable)
 * - Chrome 113+
 * - Cloudflare Workers (supported)
 *
 * @returns Object containing public and private key bytes
 */
export async function generateEd25519KeyPair(): Promise<{
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}> {
  const crypto = getCrypto();

  try {
    // Try native Ed25519 support first
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'Ed25519',
      },
      true, // extractable
      ['sign', 'verify']
    );

    // Export keys to raw format
    const publicKeyBuffer = await crypto.subtle.exportKey(
      'raw',
      keyPair.publicKey
    );
    const privateKeyBuffer = await crypto.subtle.exportKey(
      'pkcs8',
      keyPair.privateKey
    );

    // Ed25519 raw public key is 32 bytes
    // PKCS8 private key contains the 32-byte seed at a known offset
    // We extract just the seed for storage efficiency
    const pkcs8 = new Uint8Array(privateKeyBuffer);
    // PKCS8 Ed25519 private key structure:
    // 30 2e (SEQUENCE, 46 bytes)
    //   02 01 00 (INTEGER 0 - version)
    //   30 05 (SEQUENCE, 5 bytes)
    //     06 03 2b 65 70 (OID 1.3.101.112 - Ed25519)
    //   04 22 (OCTET STRING, 34 bytes)
    //     04 20 (OCTET STRING, 32 bytes)
    //       [32 bytes of private key seed]
    // The seed starts at byte 16 (0-indexed)
    const privateKeySeed = pkcs8.slice(16, 48);

    return {
      publicKey: new Uint8Array(publicKeyBuffer),
      privateKey: privateKeySeed,
    };
  } catch (error) {
    // Ed25519 not supported in this environment
    throw new Error(
      `Ed25519 key generation not supported in this environment: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        'Ed25519 requires Node.js v20+, Chrome 113+, or Cloudflare Workers.'
    );
  }
}

/**
 * Import an Ed25519 private key from seed bytes for signing
 *
 * @param privateKeySeed - 32-byte Ed25519 private key seed
 * @returns CryptoKey for signing
 */
export async function importEd25519PrivateKey(
  privateKeySeed: Uint8Array
): Promise<CryptoKey> {
  const crypto = getCrypto();

  // Reconstruct PKCS8 format from seed
  // PKCS8 Ed25519 structure (48 bytes total):
  const pkcs8Header = new Uint8Array([
    0x30,
    0x2e, // SEQUENCE, 46 bytes
    0x02,
    0x01,
    0x00, // INTEGER 0 (version)
    0x30,
    0x05, // SEQUENCE, 5 bytes
    0x06,
    0x03,
    0x2b,
    0x65,
    0x70, // OID 1.3.101.112 (Ed25519)
    0x04,
    0x22, // OCTET STRING, 34 bytes
    0x04,
    0x20, // OCTET STRING, 32 bytes (the seed)
  ]);

  const pkcs8 = new Uint8Array(48);
  pkcs8.set(pkcs8Header);
  pkcs8.set(privateKeySeed, 16);

  return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, false, [
    'sign',
  ]);
}

/**
 * Import an Ed25519 public key for verification
 *
 * @param publicKey - 32-byte Ed25519 public key
 * @returns CryptoKey for verification
 */
export async function importEd25519PublicKey(
  publicKey: Uint8Array
): Promise<CryptoKey> {
  const crypto = getCrypto();

  return crypto.subtle.importKey(
    'raw',
    publicKey as BufferSource,
    { name: 'Ed25519' },
    true,
    ['verify']
  );
}

/**
 * Sign a message using Ed25519
 *
 * @param message - Message bytes to sign
 * @param privateKey - CryptoKey for signing
 * @returns 64-byte Ed25519 signature
 */
export async function signEd25519(
  message: Uint8Array,
  privateKey: CryptoKey
): Promise<Uint8Array> {
  const crypto = getCrypto();

  const signature = await crypto.subtle.sign(
    'Ed25519',
    privateKey,
    message as BufferSource
  );

  return new Uint8Array(signature);
}

/**
 * Verify an Ed25519 signature
 *
 * @param message - Original message bytes
 * @param signature - 64-byte Ed25519 signature
 * @param publicKey - CryptoKey for verification
 * @returns true if signature is valid
 */
export async function verifyEd25519(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: CryptoKey
): Promise<boolean> {
  const crypto = getCrypto();

  return crypto.subtle.verify(
    'Ed25519',
    publicKey,
    signature as BufferSource,
    message as BufferSource
  );
}

/**
 * Encrypted key data structure for storage
 */
export interface EncryptedKeyData {
  // Ed25519 (classical) key
  classicalEncrypted: string; // Base64 encrypted private key
  classicalIV: string; // Base64 IV for classical key encryption
  classicalPublic: string; // Base64 public key

  // ML-DSA-65 (post-quantum) key - placeholder for now
  postQuantumEncrypted: string;
  postQuantumIV: string;
  postQuantumPublic: string;

  // DEK encryption
  encryptedDEK: string; // Base64 encrypted DEK
  dekIV: string; // Base64 IV for DEK encryption

  // Metadata
  algorithm: {
    classical: 'Ed25519';
    postQuantum: 'ML-DSA-65';
  };
}

/**
 * Generate a complete key pair with envelope encryption
 *
 * @param orgKey - Organization-specific KEK derived from master key
 * @returns Encrypted key data ready for storage
 */
export async function generateEncryptedKeyPair(
  orgKey: Uint8Array
): Promise<EncryptedKeyData> {
  // Generate Ed25519 key pair
  const { publicKey: classicalPublic, privateKey: classicalPrivate } =
    await generateEd25519KeyPair();

  // Generate DEK for this key pair
  const dek = await generateDEK();

  // Encrypt the private key with DEK
  const { encryptedKey: classicalEncrypted, keyIV: classicalIV } =
    await encryptPrivateKey(classicalPrivate, dek);

  // Encrypt the DEK with the org key
  const { encryptedDEK, dekIV } = await encryptDEKWithKEK(dek, orgKey);

  // Clear sensitive data
  classicalPrivate.fill(0);
  dek.fill(0);

  // TODO: Generate ML-DSA-65 key pair when library is available
  // For now, use placeholder values
  const postQuantumPlaceholder = 'ML_DSA_65_NOT_YET_IMPLEMENTED';

  return {
    classicalEncrypted,
    classicalIV,
    classicalPublic: uint8ArrayToBase64(classicalPublic),

    postQuantumEncrypted: postQuantumPlaceholder,
    postQuantumIV: postQuantumPlaceholder,
    postQuantumPublic: postQuantumPlaceholder,

    encryptedDEK,
    dekIV,

    algorithm: {
      classical: 'Ed25519',
      postQuantum: 'ML-DSA-65',
    },
  };
}

/**
 * Decrypt and use a private key for signing
 *
 * @param encryptedData - Encrypted key data from storage
 * @param orgKey - Organization-specific KEK
 * @param message - Message to sign
 * @returns Ed25519 signature (ML-DSA-65 placeholder until implemented)
 */
export async function signWithEncryptedKey(
  encryptedData: EncryptedKeyData,
  orgKey: Uint8Array,
  message: Uint8Array
): Promise<{ classicalSignature: string; postQuantumSignature: string }> {
  // Decrypt DEK
  const dek = await decryptDEKWithKEK(
    encryptedData.encryptedDEK,
    encryptedData.dekIV,
    orgKey
  );

  // Decrypt Ed25519 private key
  const classicalPrivate = await decryptPrivateKey(
    encryptedData.classicalEncrypted,
    encryptedData.classicalIV,
    dek
  );

  // Import and sign with Ed25519
  const privateKey = await importEd25519PrivateKey(classicalPrivate);
  const classicalSig = await signEd25519(message, privateKey);

  // Clear sensitive data
  dek.fill(0);
  classicalPrivate.fill(0);

  // TODO: Sign with ML-DSA-65 when library is available
  // The ML-DSA-65 signature should be over (message || classicalSignature)
  // for hybrid binding

  return {
    classicalSignature: uint8ArrayToBase64(classicalSig),
    postQuantumSignature: 'ML_DSA_65_NOT_YET_IMPLEMENTED',
  };
}

/**
 * Get the master KEK from environment
 * In production, this should be a 256-bit key stored as a Cloudflare secret
 */
export function getMasterKEK(): Uint8Array {
  const masterKeyBase64 = process.env.KEY_ENCRYPTION_KEY;

  if (!masterKeyBase64) {
    throw new Error(
      'KEY_ENCRYPTION_KEY environment variable not set. ' +
        'Generate a 256-bit key: openssl rand -base64 32'
    );
  }

  const masterKey = new Uint8Array(base64ToArrayBuffer(masterKeyBase64));

  if (masterKey.length !== 32) {
    throw new Error(
      `KEY_ENCRYPTION_KEY must be 256 bits (32 bytes). Got ${masterKey.length} bytes.`
    );
  }

  return masterKey;
}
