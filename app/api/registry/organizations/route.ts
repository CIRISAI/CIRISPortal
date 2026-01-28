import { NextRequest, NextResponse } from 'next/server';
import {
  listOrganizations,
  createOrganization,
  createOrgUser,
} from '@/lib/grpc/client';

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
    const orgId = oauthDomain
      ? `org-${oauthDomain.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
      : `org-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;

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
    });

    if (response.error) {
      return NextResponse.json(
        { error: response.error.message || 'Failed to create organization' },
        { status: 400 }
      );
    }

    // Also create the primary contact as an admin user in the org
    try {
      await createOrgUser({
        user: {
          orgId,
          email: primaryEmail,
          displayName: primaryEmail.split('@')[0],
          role: 'ORG_ADMIN',
        },
      });
      console.log(`[API] Created admin user ${primaryEmail} in org ${orgId}`);
    } catch (userError) {
      // Log but don't fail - org was created successfully
      console.warn(
        `[API] Failed to create admin user for org ${orgId}:`,
        userError
      );
    }

    return NextResponse.json({
      orgId,
      name,
      primaryEmail,
      oauthDomain: oauthDomain || null,
      active: true,
      createdAt: new Date().toISOString(),
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
