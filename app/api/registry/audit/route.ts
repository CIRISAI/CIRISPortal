import { NextResponse } from 'next/server';
import { getAuditLog, exportAuditLog } from '@/lib/grpc/client';

/**
 * GET /api/registry/audit - Get audit log entries
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

    // Build filters from query params
    const filters: any = {};
    if (searchParams.get('start_time')) {
      filters.startTime = searchParams.get('start_time');
    }
    if (searchParams.get('end_time')) {
      filters.endTime = searchParams.get('end_time');
    }
    if (searchParams.get('action_types')) {
      filters.actionTypes = searchParams
        .get('action_types')!
        .split(',')
        .map((s) => parseInt(s));
    }
    if (searchParams.get('actor_user_id')) {
      filters.actorUserId = searchParams.get('actor_user_id');
    }
    if (searchParams.get('target_id')) {
      filters.targetId = searchParams.get('target_id');
    }

    const response = await getAuditLog({
      orgId,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      pageSize: searchParams.get('page_size')
        ? parseInt(searchParams.get('page_size')!)
        : undefined,
      pageToken: searchParams.get('page_token') || undefined,
    });

    // Transform response to match SDK expected format
    return NextResponse.json({
      data: response.entries || [],
      totalCount: response.totalCount,
      nextPageToken: response.nextPageToken,
      context: response.context,
    });
  } catch (error: any) {
    console.error('[API] Get audit log error:', error.message);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }
}

/**
 * POST /api/registry/audit - Export audit log
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { org_id, filters, format } = body;

    if (!org_id) {
      return NextResponse.json(
        { error: 'org_id is required' },
        { status: 400 }
      );
    }

    const response = await exportAuditLog({
      orgId: org_id,
      filters,
      format,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] Export audit log error:', error.message);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }
}
