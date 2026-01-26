/**
 * KeyStore factory
 *
 * Returns the appropriate KeyStore implementation based on configuration.
 * Currently only CloudflareKVKeyStore is implemented; this factory allows
 * easy migration to Vault or HSM in the future.
 */

import type { KeyStore } from './types';
import { CloudflareKVKeyStore } from './cloudflare-kv';

export type KeyStoreType = 'cloudflare-kv' | 'vault' | 'hsm';

let keyStoreInstance: KeyStore | null = null;

/**
 * Get the configured KeyStore instance (singleton)
 */
export function getKeyStore(): KeyStore {
  if (!keyStoreInstance) {
    const storeType = (process.env.KEY_STORE_TYPE ||
      'cloudflare-kv') as KeyStoreType;

    switch (storeType) {
      case 'cloudflare-kv':
        keyStoreInstance = new CloudflareKVKeyStore();
        break;
      case 'vault':
        // TODO: Implement VaultKeyStore
        throw new Error('VaultKeyStore not yet implemented');
      case 'hsm':
        // TODO: Implement HSMKeyStore
        throw new Error('HSMKeyStore not yet implemented');
      default:
        throw new Error(`Unknown key store type: ${storeType}`);
    }
  }

  return keyStoreInstance;
}

/**
 * Reset the KeyStore instance (for testing)
 */
export function resetKeyStore(): void {
  keyStoreInstance = null;
}
