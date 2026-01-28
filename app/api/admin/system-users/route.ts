import { NextResponse } from 'next/server';
import {
  listSystemUsers,
  createSystemUser,
  updateSystemUser,
} from '@/lib/grpc/client';

/**
 * GET /api/admin/system-users - List all system users
 * Requires SYSTEM_ADMIN role
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const response = await listSystemUsers({
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
    console.error('[API] List system users error:', error.message);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/system-users - Create or update system user
 * Requires SYSTEM_ADMIN role
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    let response;
    switch (action) {
      case 'create':
        // Validate SYSTEM_ADMIN requires @ciris.ai email
        if (
          params.role === 'SYSTEM_ADMIN' &&
          !params.email?.endsWith('@ciris.ai')
        ) {
          return NextResponse.json(
            { error: 'SYSTEM_ADMIN role requires @ciris.ai email' },
            { status: 400 }
          );
        }

        response = await createSystemUser({
          email: params.email,
          name: params.name,
          role: params.role,
        });
        break;

      case 'update':
        response = await updateSystemUser({
          userId: params.user_id,
          name: params.name,
          role: params.role,
          active: params.active,
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
    console.error('[API] System user action error:', error.message);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }
}
