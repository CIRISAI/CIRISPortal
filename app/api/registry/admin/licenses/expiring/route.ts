import { NextResponse } from 'next/server';
import { listExpiringLicenses } from '@/lib/grpc/client';

/**
 * GET /api/registry/admin/licenses/expiring - List expiring licenses
 *
 * Query params:
 * - expiring_within_days?: number (default: 90)
 * - include_expired?: boolean (default: false)
 * - page_size?: number
 * - page_token?: string
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const expiringWithinDays = searchParams.get('expiring_within_days');
    const includeExpired = searchParams.get('include_expired');
    const pageSize = searchParams.get('page_size');
    const pageToken = searchParams.get('page_token');

    console.log('[API] listExpiringLicenses called with:', {
      expiringWithinDays,
      includeExpired,
    });

    const response = await listExpiringLicenses({
      withinDays: expiringWithinDays ? parseInt(expiringWithinDays) : 90,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      pageToken: pageToken || undefined,
    });

    // Map response to what the SDK expects
    const partners = response.partners || [];
    const countExpiringSoon = partners.length;

    return NextResponse.json({
      partners,
      countExpiringSoon,
      nextPageToken: response.nextPageToken,
      context: response.context,
    });
  } catch (error: unknown) {
    console.error('[API] listExpiringLicenses error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
