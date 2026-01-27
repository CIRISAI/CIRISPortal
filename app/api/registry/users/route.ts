import { NextResponse } from 'next/server';
import {
  listOrgUsers,
  createOrgUser,
  getOrgUser,
  getOrgUserByEmail,
  updateOrgUser,
  batchCreateOrgUsers,
} from '@/lib/grpc/client';

/**
 * GET /api/registry/users - List users for an organization
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    if (!orgId) {
      return NextResponse.json(
        { error: 'org_id is required' },
        { status: 400 }
      );
    }

    // Check if requesting a specific user
    const userId = searchParams.get('user_id');
    const email = searchParams.get('email');

    if (userId) {
      const response = await getOrgUser({ orgId, userId });
      return NextResponse.json({
        data: response.user,
        context: response.context,
      });
    }

    if (email) {
      const response = await getOrgUserByEmail({ orgId, email });
      return NextResponse.json({
        data: response.user,
        context: response.context,
      });
    }

    // List all users
    const response = await listOrgUsers({
      orgId,
      includeInactive: searchParams.get('include_inactive') === 'true',
      pageSize: searchParams.get('page_size')
        ? parseInt(searchParams.get('page_size')!)
        : undefined,
      pageToken: searchParams.get('page_token') || undefined,
    });

    return NextResponse.json({
      data: response.users || [],
      totalCount: response.totalCount,
      nextPageToken: response.nextPageToken,
      context: response.context,
    });
  } catch (error: any) {
    console.error('[API] List users error:', error.message);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }
}

/**
 * POST /api/registry/users - Create, update, or batch create users
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    let response;
    switch (action) {
      case 'create':
        response = await createOrgUser({
          user: {
            orgId: params.org_id,
            email: params.email,
            displayName: params.display_name,
            role: params.role,
          },
        });
        break;

      case 'update':
        response = await updateOrgUser({
          user: {
            orgId: params.org_id,
            userId: params.user_id,
            displayName: params.display_name,
            role: params.role,
            active: params.active,
          },
        });
        break;

      case 'batch_create':
        response = await batchCreateOrgUsers({
          orgId: params.org_id,
          users: params.users,
          mode: params.mode || 'BATCH_BEST_EFFORT',
        });
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] User action error:', error.message);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }
}
