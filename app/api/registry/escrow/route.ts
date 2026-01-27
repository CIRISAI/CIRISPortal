import { NextResponse } from 'next/server';
import {
  requestKeyEscrow,
  listKeyEscrows,
  requestKeyRecovery,
} from '@/lib/grpc/client';

/**
 * GET /api/registry/escrow - List key escrows for an organization
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

    const response = await listKeyEscrows({
      orgId,
      pageSize: searchParams.get('page_size')
        ? parseInt(searchParams.get('page_size')!)
        : undefined,
      pageToken: searchParams.get('page_token') || undefined,
    });

    return NextResponse.json({
      data: response.escrows || [],
      totalCount: response.totalCount,
      nextPageToken: response.nextPageToken,
      context: response.context,
    });
  } catch (error: any) {
    console.error('[API] List escrows error:', error.message);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }
}

/**
 * POST /api/registry/escrow - Request escrow or recovery
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    let response;
    switch (action) {
      case 'escrow':
        response = await requestKeyEscrow({
          orgId: params.org_id,
          keyId: params.key_id,
          escrowType: params.escrow_type,
          requesterUserId: params.requester_user_id,
        });
        break;

      case 'recover':
        response = await requestKeyRecovery({
          orgId: params.org_id,
          keyId: params.key_id,
          reason: params.reason,
          requesterUserId: params.requester_user_id,
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
    console.error('[API] Escrow action error:', error.message);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }
}
