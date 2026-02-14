import { NextResponse } from 'next/server';
import {
  listOrgUsers,
  createOrgUser,
  getOrgUser,
  getOrgUserByEmail,
  updateOrgUser,
  batchCreateOrgUsers,
  // v1.2.0 multi-org membership methods
  listOrgMembers,
  createUserWithMembership,
  addUserToOrg,
  getUser,
  updateUserOrgRole,
  removeUserFromOrg,
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

    // Use v1.2.0 listOrgMembers (returns User with memberships) or legacy listOrgUsers
    const useMembers = searchParams.get('members') === 'true';

    if (useMembers) {
      // v1.2.0: Returns User objects with membership info
      const response = await listOrgMembers({
        orgId,
        includeInactive: searchParams.get('include_inactive') === 'true',
        pageSize: searchParams.get('page_size')
          ? parseInt(searchParams.get('page_size')!)
          : undefined,
        pageToken: searchParams.get('page_token') || undefined,
      });

      return NextResponse.json({
        data: response.members || [],
        totalCount: response.totalCount,
        nextPageToken: response.nextPageToken,
        context: response.context,
      });
    }

    // Legacy: List all users (OrgUser model)
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
  } catch (error: unknown) {
    console.error('[API] List users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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

      // v1.2.0 multi-org membership actions
      case 'create_with_membership':
        // Create new user and add to org in one transaction
        response = await createUserWithMembership({
          email: params.email,
          name: params.name || params.display_name,
          orgId: params.org_id,
          role: params.role || 'ORG_VIEWER',
        });
        break;

      case 'add_to_org':
        // Add existing user to this org
        response = await addUserToOrg({
          userId: params.user_id,
          orgId: params.org_id,
          role: params.role || 'ORG_VIEWER',
          invitedBy: params.invited_by,
        });
        break;

      case 'update_role':
        // Update user's role in this org
        response = await updateUserOrgRole({
          userId: params.user_id,
          orgId: params.org_id,
          newRole: params.role,
        });
        break;

      case 'remove_from_org':
        // Remove user from this org (but keep user identity)
        response = await removeUserFromOrg({
          userId: params.user_id,
          orgId: params.org_id,
        });
        break;

      case 'get_user':
        // Get user with all memberships
        response = await getUser({
          userId: params.user_id,
        });
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('[API] User action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
