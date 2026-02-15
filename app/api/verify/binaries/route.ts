import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  listAvailablePlatforms,
  getDistManifest,
  SUPPORTED_PLATFORMS,
} from '@/lib/verify/distribution';

/**
 * GET /api/verify/binaries
 *
 * List available CIRISVerify binaries and their SHA-256 hashes.
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

  const manifest = getDistManifest();
  const available = listAvailablePlatforms();

  return NextResponse.json({
    version: (manifest as any)?.version || '0.1.0',
    supported_platforms: SUPPORTED_PLATFORMS,
    available: available,
    manifest,
  });
}
