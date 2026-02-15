import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getByDeviceCode } from '@/lib/device-auth/store';
import {
  getVerifyBinary,
  SUPPORTED_PLATFORMS,
} from '@/lib/verify/distribution';

/**
 * GET /api/verify/binaries/[platform]
 *
 * Download a CIRISVerify binary for a specific platform.
 *
 * Authentication: X-Device-Code header (agent) or NextAuth session (human).
 * Any licensed agent or authenticated user can download — CIRISVerify is
 * universal (not domain-specific like licensed packages).
 *
 * Query params:
 * - type=static|shared|dylib|dll — preferred binary type (optional)
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
      const record = getByDeviceCode(deviceCode);
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

    // Get preferred type from query
    const url = new URL(request.url);
    const preferredType = url.searchParams.get('type') as any;

    const result = getVerifyBinary(platform, preferredType);
    if (!result) {
      return NextResponse.json(
        {
          error: 'Binary not available for this platform',
          platform,
          hint: 'This platform may only be available after CI builds. Check /api/verify/binaries for available platforms.',
        },
        { status: 404 }
      );
    }

    console.log(
      `[CIRISVerify] Serving ${result.info.file} for ${platform} (${result.info.size} bytes)`
    );

    const contentType =
      result.info.type === 'dll'
        ? 'application/x-msdownload'
        : 'application/octet-stream';

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${result.info.file}"`,
        'Content-Length': result.info.size.toString(),
        'X-Verify-Checksum': result.info.sha256,
        'X-Verify-Platform': platform,
        'X-Verify-Binary-Type': result.info.type,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    console.error('[CIRISVerify] Download error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
