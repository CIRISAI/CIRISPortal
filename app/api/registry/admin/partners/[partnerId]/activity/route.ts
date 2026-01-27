import { NextResponse } from 'next/server';
import { getPartnerActivity } from '@/lib/grpc/client';

/**
 * GET /api/registry/admin/partners/[partnerId]/activity - Get partner activity stats
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  try {
    const { partnerId } = await params;

    console.log('[API] getPartnerActivity called for:', partnerId);

    const response = await getPartnerActivity({ partnerId });

    return NextResponse.json({
      partnerId,
      lookupsLast30Days: response.lookupsLast30Days || 0,
      lookupsLast7Days: response.lookupsLast7Days || 0,
      activeAgents: response.activeAgents || 0,
      lastActivityAt: response.lastActivityAt || null,
      healthStatus: response.healthStatus || 'HEALTHY',
      recommendations: response.recommendations || null,
      context: response.context,
    });
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number };
    console.error('[API] getPartnerActivity error:', err.message);

    // Return default activity data on error (graceful degradation)
    if (err.code === 5 || err.code === 12) {
      // NOT_FOUND or UNIMPLEMENTED
      const { partnerId } = await params;
      return NextResponse.json({
        partnerId,
        lookupsLast30Days: 0,
        lookupsLast7Days: 0,
        activeAgents: 0,
        lastActivityAt: null,
        healthStatus: 'UNKNOWN',
        recommendations: null,
        _note: 'Activity tracking not yet available',
      });
    }

    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: 500 }
    );
  }
}
