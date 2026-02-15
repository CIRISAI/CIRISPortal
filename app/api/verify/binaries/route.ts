import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  getLatestReleaseTag,
  getAllPlatformDownloads,
  fetchReleaseManifest,
  SUPPORTED_PLATFORMS,
} from '@/lib/verify/distribution';

/**
 * GET /api/verify/binaries
 *
 * List available CIRISVerify platform downloads from GitHub Releases.
 * Returns direct download URLs for all supported platforms.
 * Requires authentication (NextAuth session or X-Device-Code).
 */
export async function GET(request: Request) {
  // Auth: device code or session
  const deviceCode = request.headers.get('x-device-code');
  if (!deviceCode) {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
  }

  const version = await getLatestReleaseTag('0.1.0');
  const downloads = getAllPlatformDownloads(version);
  const manifest = await fetchReleaseManifest(version);

  return NextResponse.json({
    version,
    source: 'github',
    releases_url: `https://github.com/CIRISAI/CIRISVerify/releases/tag/${version}`,
    supported_platforms: SUPPORTED_PLATFORMS,
    downloads,
    manifest,
  });
}
