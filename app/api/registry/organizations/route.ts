import { NextRequest, NextResponse } from 'next/server';
import { listOrganizations, createOrganization } from '@/lib/grpc/client';

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

    if (!name || !primaryEmail || !oauthDomain) {
      return NextResponse.json(
        { error: 'Missing required fields: name, primaryEmail, oauthDomain' },
        { status: 400 }
      );
    }

    // Generate org ID from domain
    const orgId = `org-${oauthDomain.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    const response = await createOrganization({
      organization: {
        orgId,
        name,
        legalName,
        primaryEmail,
        oauthProvider: 'google',
        oauthDomain,
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

    return NextResponse.json({
      orgId,
      name,
      primaryEmail,
      oauthDomain,
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
