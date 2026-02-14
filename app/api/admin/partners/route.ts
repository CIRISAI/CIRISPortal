import { NextResponse } from 'next/server';
import { listExpiringLicenses } from '@/lib/grpc/client';

/**
 * GET /api/admin/partners - List partners with expiring licenses
 *
 * Query params:
 * - within_days?: number (default: 90)
 * - page_size?: number
 * - page_token?: string
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const withinDays = searchParams.get('within_days');
    const pageSize = searchParams.get('page_size');
    const pageToken = searchParams.get('page_token');

    const response = await listExpiringLicenses({
      withinDays: withinDays ? parseInt(withinDays) : 90,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      pageToken: pageToken || undefined,
    });

    return NextResponse.json({
      partners: response.partners || [],
      nextPageToken: response.nextPageToken,
      context: response.context,
    });
  } catch (error: unknown) {
    console.error('[API] List expiring licenses error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
