import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  registerAgent,
  batchRegisterAgents,
  listRegisteredAgents,
} from '@/lib/grpc/client';

/**
 * GET /api/admin/agents - List registered agents
 *
 * Query params:
 * - page_size?: number (default: 50)
 * - page_token?: string
 * - status?: string (filter by agent status)
 * - agent_type?: string (filter by type)
 * - search?: string (search in agent hash)
 * - version_prefix?: string (filter by version prefix, e.g., "1.2")
 * - include_test?: boolean (include test records)
 * - order_by?: string (field to order by)
 * - descending?: boolean (sort descending)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pageSize = searchParams.get('page_size');
    const pageToken = searchParams.get('page_token');
    const status = searchParams.get('status');
    const agentType = searchParams.get('agent_type');
    const searchQuery = searchParams.get('search');
    const versionPrefix = searchParams.get('version_prefix');
    const includeTest = searchParams.get('include_test');
    const orderBy = searchParams.get('order_by');
    const descending = searchParams.get('descending');

    console.log('[API] ListRegisteredAgents called with:', {
      pageSize,
      pageToken,
      status,
      agentType,
      searchQuery,
      versionPrefix,
    });

    const response = await listRegisteredAgents({
      agentType: agentType || undefined,
      status: status || undefined,
      versionPrefix: versionPrefix || undefined,
      searchQuery: searchQuery || undefined,
      includeTestRecords: includeTest === 'true',
      pageSize: pageSize ? parseInt(pageSize) : 50,
      pageToken: pageToken || undefined,
      orderBy: orderBy || undefined,
      descending: descending === 'true',
    });

    console.log(
      '[API] ListRegisteredAgents response:',
      response.agents?.length || 0,
      'agents'
    );

    return NextResponse.json({
      agents: response.agents || [],
      totalCount: response.totalCount || 0,
      stats: {
        registered: response.activeCount || 0,
        deprecated: response.deprecatedCount || 0,
        revoked: response.revokedCount || 0,
        attested: 0, // Backend doesn't track this yet
      },
      nextPageToken: response.nextPageToken || null,
      context: response.context,
    });
  } catch (error: unknown) {
    console.error('[API] List agents error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/agents - Register agents
 *
 * Body for single registration:
 * {
 *   agentHash: string,
 *   agentType: string,
 *   version: { major, minor, patch },
 *   capabilities: string[],
 *   maxAutonomyTier?: string
 * }
 *
 * Body for batch registration:
 * {
 *   batch: true,
 *   agents: Array<{ agentHash, agentType, version, capabilities, maxAutonomyTier? }>
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Batch registration
    if (body.batch && Array.isArray(body.agents)) {
      const response = await batchRegisterAgents({
        agents: body.agents,
      });

      return NextResponse.json({
        success: true,
        successCount: response.successCount || 0,
        failureCount: response.failureCount || 0,
        errors: response.errors || [],
        context: response.context,
      });
    }

    // Single registration
    const {
      agentHash: providedHash,
      agentType,
      version,
      capabilities,
      maxAutonomyTier,
      identityTemplate,
      stewardshipTier,
      permittedActions,
      approvedAdapters,
      orgId,
    } = body;

    if (!agentType || !version || !capabilities) {
      return NextResponse.json(
        {
          error: 'Missing required fields: agentType, version, capabilities',
        },
        { status: 400 }
      );
    }

    // Generate identity ID server-side if not provided.
    // Build hashes live in the build registry; agent identities get assigned IDs.
    const agentHash = providedHash || crypto.randomBytes(32).toString('hex');

    const response = await registerAgent({
      agentHash,
      agentType,
      version,
      capabilities,
      maxAutonomyTier,
      identityTemplate,
      stewardshipTier,
      permittedActions,
      approvedAdapters,
      orgId,
    });

    return NextResponse.json({
      success: true,
      agent: response.agent,
      context: response.context,
    });
  } catch (error: unknown) {
    console.error('[API] Register agent error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
