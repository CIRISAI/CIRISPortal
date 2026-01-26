/**
 * KeyStore factory
 *
 * Returns the appropriate KeyStore implementation based on configuration.
 * In development mode (without KV binding), returns MockKeyStore.
 * In production (with KV binding available), returns CloudflareKVKeyStore.
 *
 * Implementations:
 * - MockKeyStore: In-memory implementation for development/testing
 * - CloudflareKVKeyStore: Production implementation using Cloudflare Workers KV
 * - VaultKeyStore: (future) HashiCorp Vault implementation
 * - HSMKeyStore: (future) Hardware Security Module implementation
 */

import type { KeyStore } from './types';
import { CloudflareKVKeyStore } from './cloudflare-kv';
import { MockKeyStore } from './mock';

export type KeyStoreType = 'mock' | 'cloudflare-kv' | 'vault' | 'hsm';

let keyStoreInstance: KeyStore | null = null;

/**
 * Determine the appropriate KeyStore type based on environment
 */
function detectKeyStoreType(): KeyStoreType {
  // Explicit override via environment variable
  const explicit = process.env.KEY_STORE_TYPE as KeyStoreType | undefined;
  if (explicit) {
    return explicit;
  }

  // In development or test mode, use mock
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test'
  ) {
    return 'mock';
  }

  // Default to cloudflare-kv in production
  return 'cloudflare-kv';
}

/**
 * Check if we're in a Cloudflare Workers environment
 */
function isCloudflareWorkersEnvironment(): boolean {
  // Check for Cloudflare-specific globals
  // In Workers, caches is the Cache API and crypto is available
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as Record<string, unknown>).caches !== 'undefined' &&
    typeof (globalThis as Record<string, unknown>).crypto !== 'undefined'
  );
}

/**
 * Get the configured KeyStore instance (singleton)
 *
 * In Cloudflare Workers, you should call initKeyStore() with the KV binding
 * before calling getKeyStore().
 *
 * In development, MockKeyStore is returned automatically.
 */
export function getKeyStore(): KeyStore {
  if (!keyStoreInstance) {
    const storeType = detectKeyStoreType();

    switch (storeType) {
      case 'mock':
        console.log('[KeyStore] Using MockKeyStore (development/test mode)');
        keyStoreInstance = new MockKeyStore();
        break;

      case 'cloudflare-kv':
        // If KV isn't available, fall back to mock in development
        if (!isCloudflareWorkersEnvironment()) {
          console.warn(
            '[KeyStore] cloudflare-kv requested but not in Workers environment. ' +
              'Falling back to MockKeyStore. Set KEY_STORE_TYPE=mock to suppress this warning.'
          );
          keyStoreInstance = new MockKeyStore();
        } else {
          // In production, KV should be provided via initKeyStore()
          console.log('[KeyStore] Using CloudflareKVKeyStore');
          keyStoreInstance = new CloudflareKVKeyStore();
        }
        break;

      case 'vault':
        // TODO: Implement VaultKeyStore
        throw new Error(
          'VaultKeyStore not yet implemented. ' +
            'See lib/keystore/README.md for migration guide.'
        );

      case 'hsm':
        // TODO: Implement HSMKeyStore
        throw new Error(
          'HSMKeyStore not yet implemented. ' +
            'See lib/keystore/README.md for migration guide.'
        );

      default:
        throw new Error(`Unknown key store type: ${storeType}`);
    }
  }

  return keyStoreInstance;
}

/**
 * Initialize KeyStore with Cloudflare KV binding
 *
 * Call this in your Cloudflare Workers handler before using getKeyStore():
 *
 * ```typescript
 * import { initKeyStore, getKeyStore } from '@/lib/keystore';
 *
 * export default {
 *   async fetch(request, env, ctx) {
 *     initKeyStore(env.KEYS_KV);
 *     const keyStore = getKeyStore();
 *     // ...
 *   }
 * }
 * ```
 *
 * @param kv - Cloudflare KV namespace binding
 */
export function initKeyStore(kv: KVNamespace): void {
  if (keyStoreInstance) {
    console.warn(
      '[KeyStore] KeyStore already initialized. Call resetKeyStore() first if you need to reinitialize.'
    );
    return;
  }

  const storeType = detectKeyStoreType();

  if (storeType === 'cloudflare-kv') {
    console.log('[KeyStore] Initializing CloudflareKVKeyStore with KV binding');
    keyStoreInstance = new CloudflareKVKeyStore(kv);
  } else {
    console.warn(
      `[KeyStore] initKeyStore called but KEY_STORE_TYPE=${storeType}. KV binding ignored.`
    );
    getKeyStore(); // Initialize with the configured type
  }
}

/**
 * Initialize KeyStore with a custom implementation
 *
 * Useful for testing or custom implementations.
 *
 * @param store - Custom KeyStore implementation
 */
export function initKeyStoreWithInstance(store: KeyStore): void {
  if (keyStoreInstance) {
    console.warn(
      '[KeyStore] KeyStore already initialized. Call resetKeyStore() first if you need to reinitialize.'
    );
    return;
  }

  console.log('[KeyStore] Initializing with custom KeyStore instance');
  keyStoreInstance = store;
}

/**
 * Reset the KeyStore instance
 *
 * Primarily for testing purposes. In production, this should rarely be needed.
 */
export function resetKeyStore(): void {
  keyStoreInstance = null;
}

/**
 * Check if KeyStore has been initialized
 */
export function isKeyStoreInitialized(): boolean {
  return keyStoreInstance !== null;
}

/**
 * Get the current KeyStore type
 */
export function getKeyStoreType(): KeyStoreType | null {
  if (!keyStoreInstance) {
    return null;
  }

  if (keyStoreInstance instanceof MockKeyStore) {
    return 'mock';
  }

  if (keyStoreInstance instanceof CloudflareKVKeyStore) {
    return 'cloudflare-kv';
  }

  // Future implementations
  return null;
}
