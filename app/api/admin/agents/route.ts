import { NextResponse } from 'next/server';
import { registerAgent, batchRegisterAgents } from '@/lib/grpc/client';

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
    const { agentHash, agentType, version, capabilities, maxAutonomyTier } =
      body;

    if (!agentHash || !agentType || !version || !capabilities) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: agentHash, agentType, version, capabilities',
        },
        { status: 400 }
      );
    }

    const response = await registerAgent({
      agentHash,
      agentType,
      version,
      capabilities,
      maxAutonomyTier,
    });

    return NextResponse.json({
      success: true,
      agent: response.agent,
      context: response.context,
    });
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number };
    console.error('[API] Register agent error:', err.message);
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: 500 }
    );
  }
}
