/**
 * Package builder — creates zip archives from licensed module source directories.
 *
 * Zips the full package directory (templates, modules, config, compliance)
 * excluding .git, __pycache__, .env, *.pyc, node_modules, and other
 * non-distributable files.
 *
 * For production: packages are pre-built at deploy time and cached.
 * For development: built on-demand from source directories.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, statSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { LICENSED_PACKAGES, type LicensedPackage } from './registry';

// Cache directory for pre-built zips
const CACHE_DIR = process.env.PACKAGE_CACHE_DIR || '/tmp/ciris-packages';

// Files/directories to exclude from package zips
const EXCLUDE_PATTERNS = [
  '.git',
  '.git/*',
  '__pycache__',
  '__pycache__/*',
  '*.pyc',
  '.env',
  '.env.*',
  'node_modules',
  'node_modules/*',
  '.venv',
  '.venv/*',
  'external', // CIRISAgent submodule — not included in package
  'external/*',
  '.DS_Store',
  '*.egg-info',
  '*.egg-info/*',
  'safety_report_*.json',
  'tests', // Tests stay in repo, not shipped
  'tests/*',
  'tools', // Dev tools stay in repo
  'tools/*',
  '*.md', // Docs stay in repo (except README shipped separately)
  'docker-compose*.yml',
  '.pre-commit-config.yaml',
  '.gitmodules',
  '.gitignore',
  'setup.py',
  'pytest.ini',
  'run_tests.py',
  'test_requirements.txt',
];

/**
 * Build a zip archive for a licensed package.
 * Returns the path to the zip file and its SHA-256 checksum.
 */
export async function buildPackageZip(
  packageId: string
): Promise<{ zipPath: string; checksum: string; sizeBytes: number } | null> {
  const pkg = LICENSED_PACKAGES[packageId];
  if (!pkg) return null;

  // Check source directory exists
  if (!existsSync(pkg.sourcePath)) {
    console.error(
      `[Package Builder] Source directory not found: ${pkg.sourcePath}`
    );
    return null;
  }

  // Ensure cache directory exists
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  const zipFilename = `${pkg.name}-${pkg.version}.zip`;
  const zipPath = path.join(CACHE_DIR, zipFilename);

  // Check if cached zip exists and is still valid
  // (For dev: always rebuild. For prod: check mtime.)
  const shouldRebuild =
    !existsSync(zipPath) || process.env.NODE_ENV !== 'production';

  if (shouldRebuild) {
    try {
      // Build exclude flags for zip command
      const excludeFlags = EXCLUDE_PATTERNS.map((p) => `-x '${p}'`).join(' ');

      // Create zip from source directory
      // Using system zip command (available on all POSIX systems + macOS)
      const cmd = `cd "${pkg.sourcePath}" && zip -r "${zipPath}" . ${excludeFlags} -x '.*'`;
      execSync(cmd, { stdio: 'pipe', timeout: 30000 });

      console.log(`[Package Builder] Built ${zipFilename}`);
    } catch (error) {
      console.error(`[Package Builder] Failed to build ${zipFilename}:`, error);
      return null;
    }
  }

  // Calculate checksum
  const checksumCmd = `shasum -a 256 "${zipPath}" | cut -d' ' -f1`;
  const checksum = execSync(checksumCmd, { encoding: 'utf-8' }).trim();

  const stats = statSync(zipPath);

  return {
    zipPath,
    checksum,
    sizeBytes: stats.size,
  };
}

/**
 * Get cached zip path if it exists (no rebuild).
 */
export function getCachedZipPath(packageId: string): string | null {
  const pkg = LICENSED_PACKAGES[packageId];
  if (!pkg) return null;

  const zipFilename = `${pkg.name}-${pkg.version}.zip`;
  const zipPath = path.join(CACHE_DIR, zipFilename);

  return existsSync(zipPath) ? zipPath : null;
}

/**
 * Pre-build all packages (called at deploy time or startup).
 */
export async function prebuildAllPackages(): Promise<
  Record<string, { checksum: string; sizeBytes: number }>
> {
  const results: Record<string, { checksum: string; sizeBytes: number }> = {};

  for (const [id, pkg] of Object.entries(LICENSED_PACKAGES)) {
    if (!existsSync(pkg.sourcePath)) {
      console.warn(
        `[Package Builder] Skipping ${id}: source not found at ${pkg.sourcePath}`
      );
      continue;
    }

    const result = await buildPackageZip(id);
    if (result) {
      results[id] = {
        checksum: result.checksum,
        sizeBytes: result.sizeBytes,
      };
    }
  }

  return results;
}
