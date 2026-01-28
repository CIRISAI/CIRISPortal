import { NextRequest, NextResponse } from 'next/server';
import { listOrganizations, createOrganization } from '@/lib/grpc/client';

/**
 * CIRIS Internal Organization - must match user-provisioning.ts
 */
const CIRIS_ORG = {
  id: 'ciris-internal',
  name: 'CIRIS',
  domain: 'ciris.ai',
};

/**
 * GET /api/registry/organizations
 * List all organizations
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pageSize = parseInt(searchParams.get('pageSize') || '100');
    const pageToken = searchParams.get('pageToken') || undefined;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const response = await listOrganizations({
      pageSize,
      pageToken,
      includeInactive,
    });

    return NextResponse.json({
      organizations: response.organizations || [],
      nextPageToken: response.nextPageToken,
      totalCount: response.totalCount,
    });
  } catch (error) {
    const err = error as { message?: string; code?: number };
    console.error('[API] List organizations error:', err.message);
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: 500 }
    );
  }
}

/**
 * POST /api/registry/organizations
 * Create a new organization
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, primaryEmail, oauthDomain, legalName } = body;

    if (!name || !primaryEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: name, primaryEmail' },
        { status: 400 }
      );
    }

    // Generate org ID from domain if provided, otherwise from name
    // Use canonical CIRIS org ID for ciris.ai domain
    const isCirisInternal = oauthDomain?.toLowerCase() === CIRIS_ORG.domain;
    const orgId = isCirisInternal
      ? CIRIS_ORG.id
      : oauthDomain
        ? `org-${oauthDomain.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
        : `org-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;

    // Atomic creation: org + initial admin in same transaction
    // Role 100 = ORG_ADMIN in the proto enum
    const response = await createOrganization({
      organization: {
        orgId,
        name,
        legalName,
        primaryEmail,
        oauthProvider: 'google',
        oauthDomain: oauthDomain || undefined,
        active: true,
        metadata: {
          createdVia: 'portal',
          createdAt: new Date().toISOString(),
        },
      },
      initialAdmin: {
        email: primaryEmail,
        name: primaryEmail.split('@')[0],
        role: 100, // ORG_ADMIN
        active: true,
      },
    });

    if (response.error) {
      return NextResponse.json(
        { error: response.error.message || 'Failed to create organization' },
        { status: 400 }
      );
    }

    // Use the actual org ID returned by the registry (UUID), not our slug
    const actualOrgId = response.orgId || response.organization?.orgId || orgId;

    console.log(
      `[API] Created org ${actualOrgId} with admin user ${primaryEmail} atomically`
    );

    return NextResponse.json({
      orgId: actualOrgId,
      name,
      primaryEmail,
      oauthDomain: oauthDomain || null,
      active: true,
      createdAt: new Date().toISOString(),
      adminUserId: response.adminUserId,
    });
  } catch (error) {
    const err = error as { message?: string; code?: number };
    console.error('[API] Create organization error:', err.message);
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: 500 }
    );
  }
}
