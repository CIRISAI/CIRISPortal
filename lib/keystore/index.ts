/**
 * KeyStore module exports
 *
 * Usage:
 *   import { getKeyStore } from '@/lib/keystore';
 *   const keyStore = getKeyStore();
 *   const keys = await keyStore.generateKeyPair(orgId);
 *
 * In Cloudflare Workers, initialize with KV binding first:
 *   import { initKeyStore, getKeyStore } from '@/lib/keystore';
 *   initKeyStore(env.KEYS_KV);
 *   const keyStore = getKeyStore();
 *
 * For testing:
 *   import { MockKeyStore, createTestKeyStore } from '@/lib/keystore';
 *   const mockStore = createTestKeyStore();
 */

// Types
export * from './types';

// Implementations
export { CloudflareKVKeyStore } from './cloudflare-kv';
export {
  MockKeyStore,
  createTestKeyStore,
  createDeterministicTestKeyStore,
} from './mock';

// Factory functions
export {
  getKeyStore,
  initKeyStore,
  initKeyStoreWithInstance,
  resetKeyStore,
  isKeyStoreInitialized,
  getKeyStoreType,
  type KeyStoreType,
} from './factory';

// Crypto utilities (for advanced use cases)
export {
  // Envelope encryption
  generateDEK,
  generateIV,
  encryptDEKWithKEK,
  decryptDEKWithKEK,
  encryptPrivateKey,
  decryptPrivateKey,
  deriveOrgKey,

  // Ed25519 operations
  generateEd25519KeyPair,
  importEd25519PrivateKey,
  importEd25519PublicKey,
  signEd25519,
  verifyEd25519,

  // High-level operations
  generateEncryptedKeyPair,
  signWithEncryptedKey,
  getMasterKEK,

  // Utility functions
  arrayBufferToBase64,
  uint8ArrayToBase64,
  base64ToArrayBuffer,
  arrayBufferToUint8Array,

  // Types
  type EncryptedKeyData,
} from './crypto';
