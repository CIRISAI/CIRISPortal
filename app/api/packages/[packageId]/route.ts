import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { readFileSync } from 'fs';
import { LICENSED_PACKAGES, getPackageInfo } from '@/lib/packages/registry';
import { buildPackageZip } from '@/lib/packages/builder';
import { getAllowedTemplates } from '@/lib/device-auth/abac';
import { TEMPLATE_PRESETS } from '@/lib/templates';

/**
 * GET /api/packages/[packageId]
 *
 * Download a licensed module package as a zip file.
 *
 * Authentication: Two modes supported:
 * 1. NextAuth session (human user) — ABAC check ensures the user's org
 *    is allowed to access this package's template.
 * 2. X-Device-Code header (agent during device auth) — validates the device
 *    code is provisioned for a template that matches this package.
 *
 * ABAC policy:
 * - Package access requires the user/agent to have ABAC permission for
 *   the package's corresponding licensed template (iris → medical,
 *   aureus → financial, themis → legal).
 * - INTERNAL orgs: all packages allowed.
 * - PARTNER orgs: only packages for allowed_identity_templates.
 * - COMMUNITY orgs: no licensed packages (403).
 *
 * Query params:
 * - info=true: Return package metadata instead of zip download
 *
 * Response headers include:
 * - X-Package-Checksum: SHA-256 checksum of the zip
 * - X-Package-Version: Package version string
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ packageId: string }> }
) {
  try {
    const { packageId } = await params;

    // Check package exists
    const pkg = LICENSED_PACKAGES[packageId];
    if (!pkg) {
      return NextResponse.json(
        {
          error: 'Package not found',
          available: Object.keys(LICENSED_PACKAGES),
        },
        { status: 404 }
      );
    }

    // ================================================================
    // Authentication + ABAC Authorization
    // ================================================================
    let orgId: string | null = null;

    // Mode 1: Device code auth (agent downloading during provisioning)
    const deviceCode = request.headers.get('x-device-code');
    if (deviceCode) {
      // Validate via device auth store
      const { getByDeviceCode } = await import('@/lib/device-auth/store');
      const record = getByDeviceCode(deviceCode);

      if (!record || record.status !== 'provisioned') {
        return NextResponse.json(
          { error: 'Invalid or unprovided device code' },
          { status: 401 }
        );
      }

      // Verify the device code was provisioned for a template
      // that matches this package
      if (record.selectedTemplate !== pkg.templateId) {
        return NextResponse.json(
          {
            error: 'Package access denied',
            detail: `Device auth provisioned for template "${record.selectedTemplate}", not "${pkg.templateId}"`,
          },
          { status: 403 }
        );
      }

      orgId = record.orgId || null;
    } else {
      // Mode 2: NextAuth session (human user)
      const session = await getServerSession();
      if (!session?.user?.email) {
        return NextResponse.json(
          {
            error: 'Authentication required (session or X-Device-Code header)',
          },
          { status: 401 }
        );
      }

      orgId = (session.user as any).orgId || 'community';
    }

    // ABAC check: verify the org is allowed to access this package's template
    if (orgId) {
      const allowedTemplates = await getAllowedTemplates(orgId);
      const hasAccess = allowedTemplates.some((t) => t.id === pkg.templateId);

      if (!hasAccess) {
        return NextResponse.json(
          {
            error: 'Package access denied by organization policy',
            detail: `Your organization does not have access to the "${pkg.templateId}" licensed template`,
            allowed_templates: allowedTemplates.map((t) => t.id),
          },
          { status: 403 }
        );
      }
    }

    // ================================================================
    // Response
    // ================================================================

    // If ?info=true, return metadata only
    const url = new URL(request.url);
    if (url.searchParams.get('info') === 'true') {
      const info = getPackageInfo(packageId);
      return NextResponse.json(info);
    }

    // Build the zip (or use cached)
    const result = await buildPackageZip(packageId);
    if (!result) {
      return NextResponse.json(
        {
          error: 'Package build failed',
          detail: `Could not build package for ${packageId}. Source directory may not exist.`,
        },
        { status: 500 }
      );
    }

    // Read and serve the zip file
    const zipBuffer = readFileSync(result.zipPath);

    console.log(
      `[Packages] Serving ${pkg.name} v${pkg.version} to org=${orgId} (${result.sizeBytes} bytes)`
    );

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${pkg.name}-${pkg.version}.zip"`,
        'Content-Length': result.sizeBytes.toString(),
        'X-Package-Checksum': result.checksum,
        'X-Package-Version': pkg.version,
        'X-Package-Id': packageId,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    console.error('[Packages] Download error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
