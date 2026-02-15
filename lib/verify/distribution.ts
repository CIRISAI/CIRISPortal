/**
 * CIRISVerify binary distribution.
 *
 * Serves pre-built CIRISVerify binaries for all supported platforms.
 * Binaries are stored on disk (deployed via Ansible as secrets) and
 * their SHA-256 hashes are published to CIRISRegistry at release time.
 *
 * Supported platforms:
 * - darwin-arm64       (macOS Apple Silicon)
 * - darwin-x86_64      (macOS Intel)
 * - linux-x86_64       (Linux x64)
 * - linux-arm64        (Linux ARM64)
 * - ios-arm64          (iOS devices)
 * - ios-sim-arm64      (iOS simulator)
 * - android-arm64-v8a  (Android 64-bit ARM)
 * - android-armeabi-v7a (Android 32-bit ARM)
 * - android-x86_64     (Android emulator)
 * - windows-x86_64     (Windows x64)
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

// Base path for CIRISVerify binaries on the deployment host
const VERIFY_BASE_PATH =
  process.env.CIRIS_VERIFY_DIST_PATH || '/opt/ciris/verify/dist';

// Development fallback
const DEV_VERIFY_PATH = '/Users/macmini/CIRISVerify/dist';

function getBasePath(): string {
  if (existsSync(VERIFY_BASE_PATH)) return VERIFY_BASE_PATH;
  if (existsSync(DEV_VERIFY_PATH)) return DEV_VERIFY_PATH;
  return VERIFY_BASE_PATH; // will 404 gracefully
}

export interface VerifyBinaryInfo {
  platform: string;
  file: string;
  sha256: string;
  size: number;
  type: 'shared' | 'static' | 'dylib' | 'dll';
}

/**
 * Platform → binary filename mapping.
 */
const PLATFORM_BINARIES: Record<
  string,
  { file: string; dir: string; type: VerifyBinaryInfo['type'] }[]
> = {
  'darwin-arm64': [
    { file: 'libciris_verify_ffi.dylib', dir: 'darwin-arm64', type: 'dylib' },
    { file: 'libciris_verify_ffi.a', dir: 'darwin-arm64', type: 'static' },
  ],
  'darwin-x86_64': [
    { file: 'libciris_verify_ffi.dylib', dir: 'darwin-x86_64', type: 'dylib' },
    { file: 'libciris_verify_ffi.a', dir: 'darwin-x86_64', type: 'static' },
  ],
  'linux-x86_64': [
    { file: 'libciris_verify_ffi.so', dir: 'linux-x86_64', type: 'shared' },
  ],
  'linux-arm64': [
    { file: 'libciris_verify_ffi.so', dir: 'linux-arm64', type: 'shared' },
  ],
  'ios-arm64': [
    { file: 'libciris_verify_ffi.a', dir: 'ios-arm64', type: 'static' },
  ],
  'ios-sim-arm64': [
    { file: 'libciris_verify_ffi.a', dir: 'ios-sim-arm64', type: 'static' },
  ],
  'android-arm64-v8a': [
    {
      file: 'libciris_verify_ffi.so',
      dir: 'android-arm64-v8a',
      type: 'shared',
    },
  ],
  'android-armeabi-v7a': [
    {
      file: 'libciris_verify_ffi.so',
      dir: 'android-armeabi-v7a',
      type: 'shared',
    },
  ],
  'android-x86_64': [
    { file: 'libciris_verify_ffi.so', dir: 'android-x86_64', type: 'shared' },
  ],
  'windows-x86_64': [
    { file: 'ciris_verify_ffi.dll', dir: 'windows-x86_64', type: 'dll' },
  ],
};

/**
 * List all available platforms and their binary info.
 */
export function listAvailablePlatforms(): VerifyBinaryInfo[] {
  const base = getBasePath();
  const results: VerifyBinaryInfo[] = [];

  for (const [platform, binaries] of Object.entries(PLATFORM_BINARIES)) {
    for (const bin of binaries) {
      const fullPath = join(base, bin.dir, bin.file);
      if (existsSync(fullPath)) {
        const stat = statSync(fullPath);
        const hash = crypto
          .createHash('sha256')
          .update(readFileSync(fullPath))
          .digest('hex');
        results.push({
          platform,
          file: bin.file,
          sha256: hash,
          size: stat.size,
          type: bin.type,
        });
      }
    }
  }

  return results;
}

/**
 * Get a specific binary for a platform.
 * Returns the file buffer + metadata, or null if not found.
 */
export function getVerifyBinary(
  platform: string,
  preferredType?: VerifyBinaryInfo['type']
): { buffer: Buffer; info: VerifyBinaryInfo } | null {
  const binaries = PLATFORM_BINARIES[platform];
  if (!binaries) return null;

  const base = getBasePath();

  // If preferred type specified, try that first
  const ordered = preferredType
    ? [
        ...binaries.filter((b) => b.type === preferredType),
        ...binaries.filter((b) => b.type !== preferredType),
      ]
    : binaries;

  for (const bin of ordered) {
    const fullPath = join(base, bin.dir, bin.file);
    if (existsSync(fullPath)) {
      const buffer = readFileSync(fullPath);
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      return {
        buffer,
        info: {
          platform,
          file: bin.file,
          sha256: hash,
          size: buffer.length,
          type: bin.type,
        },
      };
    }
  }

  return null;
}

/**
 * Read the distribution manifest (generated at build time).
 */
export function getDistManifest(): Record<string, unknown> | null {
  const base = getBasePath();
  const manifestPath = join(base, 'manifest.json');
  if (!existsSync(manifestPath)) return null;
  return JSON.parse(readFileSync(manifestPath, 'utf-8'));
}

export const SUPPORTED_PLATFORMS = Object.keys(PLATFORM_BINARIES);
