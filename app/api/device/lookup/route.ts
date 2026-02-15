import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getByUserCode } from '@/lib/device-auth/store';
import { getAllowedTemplates } from '@/lib/device-auth/abac';

/**
 * GET /api/device/lookup?code=ABCD-1234
 *
 * Called by the Portal device auth UI page after the user authenticates.
 * Returns the device auth record details and ABAC-filtered templates.
 *
 * Requires NextAuth session (user must be logged in via OAuth).
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'code query parameter is required' },
        { status: 400 }
      );
    }

    const record = getByUserCode(code);
    if (!record) {
      return NextResponse.json(
        { error: 'Invalid or expired device code' },
        { status: 404 }
      );
    }

    if (record.status !== 'pending' && record.status !== 'authorized') {
      return NextResponse.json(
        { error: `Device code already ${record.status}` },
        { status: 409 }
      );
    }

    // TODO: Look up org from session user email via Registry.
    // MVP: use the orgId from the session if available, or a default.
    const orgId = (session.user as any).orgId || 'community';

    // Get ABAC-filtered templates for this user + node
    const allowedTemplates = await getAllowedTemplates(
      orgId,
      record.nodeManifest
    );

    return NextResponse.json({
      user_code: record.userCode,
      portal_url: record.portalUrl,
      node_manifest: record.nodeManifest,
      agent_info: record.agentInfo,
      status: record.status,
      allowed_templates: allowedTemplates,
      expires_at: record.expiresAt,
    });
  } catch (error) {
    console.error('[Device Auth] Lookup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
