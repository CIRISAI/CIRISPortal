import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getByDeviceCode } from '@/lib/device-auth/store';
import {
  getDownloadUrl,
  getLatestReleaseTag,
  SUPPORTED_PLATFORMS,
} from '@/lib/verify/distribution';

/**
 * GET /api/verify/binaries/[platform]
 *
 * Redirect to the GitHub Releases download URL for a specific platform.
 *
 * Authentication: X-Device-Code header (agent) or NextAuth session (human).
 * CIRISVerify is open-source (AGPL-3.0), so binaries are public on GitHub.
 * Auth is retained here for audit logging of which agents download verify.
 *
 * Query params:
 * - version — specific release tag (optional, defaults to latest)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;

    // Validate platform
    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        {
          error: 'Unsupported platform',
          supported: SUPPORTED_PLATFORMS,
        },
        { status: 404 }
      );
    }

    // Auth: device code or session
    const deviceCode = request.headers.get('x-device-code');
    if (deviceCode) {
      const record = await getByDeviceCode(deviceCode);
      if (!record || record.status !== 'provisioned') {
        return NextResponse.json(
          { error: 'Invalid or unprovisioned device code' },
          { status: 401 }
        );
      }
    } else {
      const session = await getServerSession();
      if (!session?.user?.email) {
        return NextResponse.json(
          {
            error: 'Authentication required (session or X-Device-Code header)',
          },
          { status: 401 }
        );
      }
    }

    // Resolve version
    const url = new URL(request.url);
    const requestedVersion = url.searchParams.get('version');
    const version = requestedVersion || (await getLatestReleaseTag('0.1.0'));

    const download = getDownloadUrl(version, platform);
    if (!download) {
      return NextResponse.json(
        {
          error: 'No download available for this platform',
          platform,
          hint: 'Check /api/verify/binaries for available platforms.',
        },
        { status: 404 }
      );
    }

    console.log(
      `[CIRISVerify] Redirecting ${platform} download to GitHub: ${download.downloadUrl}`
    );

    // Redirect to GitHub Releases download
    return NextResponse.redirect(download.downloadUrl, 302);
  } catch (error) {
    console.error('[CIRISVerify] Download redirect error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
