/**
 * CIRISVerify binary distribution.
 *
 * Since CIRISVerify is open-source (AGPL-3.0), platform binaries are
 * distributed via GitHub Releases at:
 *   https://github.com/CIRISAI/CIRISVerify/releases
 *
 * This module provides helpers to resolve the correct GitHub release
 * asset URL for each platform and verify binary integrity against
 * the manifest published at release time.
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

const GITHUB_RELEASES_URL =
  process.env.CIRIS_VERIFY_RELEASES_URL ||
  'https://github.com/CIRISAI/CIRISVerify/releases';

const GITHUB_REPO = 'CIRISAI/CIRISVerify';

export interface VerifyBinaryInfo {
  platform: string;
  file: string;
  sha256: string;
  size: number;
  type: 'shared' | 'static' | 'dylib' | 'dll';
}

export interface PlatformDownload {
  platform: string;
  /** Direct download URL for the platform archive from GitHub Releases */
  downloadUrl: string;
  /** Archive filename (e.g., ciris-verify-v0.1.0-linux-x86_64.tar.gz) */
  archiveFile: string;
  /** Inner binary filename after extraction */
  binaryFile: string;
  type: VerifyBinaryInfo['type'];
}

/**
 * Platform → release archive mapping.
 * Archives are named: ciris-verify-{version}-{platform}.tar.gz (or .zip for Windows)
 */
const PLATFORM_ARCHIVES: Record<
  string,
  { archiveSuffix: string; binaryFile: string; type: VerifyBinaryInfo['type'] }
> = {
  'darwin-arm64': {
    archiveSuffix: 'macos-arm64.tar.gz',
    binaryFile: 'libciris_verify_ffi.dylib',
    type: 'dylib',
  },
  'darwin-x86_64': {
    archiveSuffix: 'macos-x86_64.tar.gz',
    binaryFile: 'libciris_verify_ffi.dylib',
    type: 'dylib',
  },
  'linux-x86_64': {
    archiveSuffix: 'linux-x86_64.tar.gz',
    binaryFile: 'libciris_verify_ffi.so',
    type: 'shared',
  },
  'linux-arm64': {
    archiveSuffix: 'linux-arm64.tar.gz',
    binaryFile: 'libciris_verify_ffi.so',
    type: 'shared',
  },
  'android-arm64-v8a': {
    archiveSuffix: 'android.tar.gz',
    binaryFile: 'libciris_verify_ffi.so',
    type: 'shared',
  },
  'android-armeabi-v7a': {
    archiveSuffix: 'android.tar.gz',
    binaryFile: 'libciris_verify_ffi.so',
    type: 'shared',
  },
  'android-x86_64': {
    archiveSuffix: 'android.tar.gz',
    binaryFile: 'libciris_verify_ffi.so',
    type: 'shared',
  },
  'ios-arm64': {
    archiveSuffix: 'ios.tar.gz',
    binaryFile: 'libciris_verify_ffi.a',
    type: 'static',
  },
  'ios-sim-arm64': {
    archiveSuffix: 'ios.tar.gz',
    binaryFile: 'libciris_verify_ffi.a',
    type: 'static',
  },
  'windows-x86_64': {
    archiveSuffix: 'windows-x86_64.zip',
    binaryFile: 'ciris_verify_ffi.dll',
    type: 'dll',
  },
};

/**
 * Build the GitHub Releases download URL for a specific version and platform.
 */
export function getDownloadUrl(
  version: string,
  platform: string
): PlatformDownload | null {
  const entry = PLATFORM_ARCHIVES[platform];
  if (!entry) return null;

  const tag = version.startsWith('v') ? version : `v${version}`;
  const archiveFile = `ciris-verify-${tag}-${entry.archiveSuffix}`;
  const downloadUrl = `https://github.com/${GITHUB_REPO}/releases/download/${tag}/${archiveFile}`;

  return {
    platform,
    downloadUrl,
    archiveFile,
    binaryFile: entry.binaryFile,
    type: entry.type,
  };
}

/**
 * Get the latest release tag from GitHub API.
 * Falls back to the provided default if the API call fails.
 */
export async function getLatestReleaseTag(
  fallback: string = 'latest'
): Promise<string> {
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: { Accept: 'application/vnd.github.v3+json' },
      }
    );
    if (resp.ok) {
      const data = (await resp.json()) as { tag_name: string };
      return data.tag_name;
    }
  } catch {
    // Fall through to fallback
  }
  return fallback;
}

/**
 * Build the manifest.json download URL for a specific release.
 * The manifest contains SHA-256 hashes for all platform binaries.
 */
export function getManifestUrl(version: string): string {
  const tag = version.startsWith('v') ? version : `v${version}`;
  return `https://github.com/${GITHUB_REPO}/releases/download/${tag}/manifest.json`;
}

/**
 * Fetch the release manifest (SHA-256 hashes) from GitHub.
 */
export async function fetchReleaseManifest(
  version: string
): Promise<Record<string, unknown> | null> {
  try {
    const url = getManifestUrl(version);
    const resp = await fetch(url);
    if (resp.ok) {
      return (await resp.json()) as Record<string, unknown>;
    }
  } catch {
    // Manifest not available
  }
  return null;
}

/**
 * Get download info for all supported platforms at a given version.
 */
export function getAllPlatformDownloads(version: string): PlatformDownload[] {
  return Object.keys(PLATFORM_ARCHIVES)
    .map((platform) => getDownloadUrl(version, platform))
    .filter((d): d is PlatformDownload => d !== null);
}

/**
 * Build a "latest" redirect URL for a platform (uses GitHub's /latest redirect).
 */
export function getLatestDownloadUrl(platform: string): string | null {
  const entry = PLATFORM_ARCHIVES[platform];
  if (!entry) return null;
  // GitHub doesn't support /latest/download for unknown filenames without the tag,
  // so we construct the releases page URL — agents should resolve latest tag first.
  return `${GITHUB_RELEASES_URL}/latest`;
}

export const SUPPORTED_PLATFORMS = Object.keys(PLATFORM_ARCHIVES);
