import { NextResponse } from 'next/server';
import { massRevoke, getRevocationList } from '@/lib/grpc/client';

/**
 * GET /api/admin/revoke - Get revocation list/history
 *
 * Query params:
 * - since: string (optional) - Get revocations since this version
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    const response = await getRevocationList({
      since: since || undefined,
    });

    return NextResponse.json({
      entries: response.entries || [],
      currentVersion: response.currentVersion,
      context: response.context,
    });
  } catch (error: unknown) {
    console.error('[API] Get revocation list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/revoke - Execute mass revocation
 *
 * Body:
 * {
 *   agentHashes?: string[],
 *   partnerIds?: string[],
 *   versionPattern?: string,
 *   agentType?: string,
 *   reason: string,
 *   reasonCode: string,
 *   severity: string,
 *   isDryRun?: boolean
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      agentHashes,
      partnerIds,
      versionPattern,
      agentType,
      reason,
      reasonCode,
      severity,
      isDryRun,
    } = body;

    if (!reason || !reasonCode || !severity) {
      return NextResponse.json(
        { error: 'Missing required fields: reason, reasonCode, severity' },
        { status: 400 }
      );
    }

    // At least one selection criteria required
    if (!agentHashes && !partnerIds && !versionPattern && !agentType) {
      return NextResponse.json(
        {
          error:
            'At least one selection criteria required: agentHashes, partnerIds, versionPattern, or agentType',
        },
        { status: 400 }
      );
    }

    const response = await massRevoke({
      agentHashes,
      partnerIds,
      versionPattern,
      agentType,
      reason,
      reasonCode,
      severity,
      isDryRun: isDryRun || false,
    });

    return NextResponse.json({
      success: true,
      isDryRun: isDryRun || false,
      revokedCount: response.revokedCount || 0,
      affectedAgents: response.affectedAgents || [],
      affectedPartners: response.affectedPartners || [],
      auditLogId: response.auditLogId,
      context: response.context,
    });
  } catch (error: unknown) {
    console.error('[API] Mass revoke error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
