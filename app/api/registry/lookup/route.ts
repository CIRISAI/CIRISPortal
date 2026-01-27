import { NextResponse } from 'next/server';
import { lookupAgent, lookupPartner, getPublicKeys } from '@/lib/grpc/client';

/**
 * GET /api/registry/lookup - Public lookup endpoints
 *
 * Query params:
 * - agent_hash: Lookup an agent by hash
 * - partner_id: Lookup a partner by ID
 * - org_id + keys: Get public keys for an organization
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentHash = searchParams.get('agent_hash');
    const partnerId = searchParams.get('partner_id');
    const orgId = searchParams.get('org_id');
    const wantKeys = searchParams.get('keys') === 'true';

    // Agent lookup
    if (agentHash) {
      try {
        const response = await lookupAgent({ agentHash });
        return NextResponse.json({
          found: !!response.agent,
          agent: response.agent,
          context: response.context,
        });
      } catch (error: any) {
        // Not found is not an error for lookups
        if (error.code === 5) {
          // NOT_FOUND
          return NextResponse.json({
            found: false,
            agent: null,
          });
        }
        throw error;
      }
    }

    // Partner lookup
    if (partnerId) {
      try {
        const response = await lookupPartner({ orgId: partnerId });
        return NextResponse.json({
          found: !!response.partner,
          partner: response.partner,
          context: response.context,
        });
      } catch (error: any) {
        if (error.code === 5) {
          return NextResponse.json({
            found: false,
            partner: null,
          });
        }
        throw error;
      }
    }

    // Public keys lookup
    if (orgId && wantKeys) {
      try {
        const response = await getPublicKeys({ orgId });
        return NextResponse.json({
          found: response.keys && response.keys.length > 0,
          keys: response.keys || [],
          context: response.context,
        });
      } catch (error: any) {
        if (error.code === 5) {
          return NextResponse.json({
            found: false,
            keys: [],
          });
        }
        throw error;
      }
    }

    return NextResponse.json(
      {
        error:
          'Missing required parameter: agent_hash, partner_id, or org_id with keys=true',
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API] Lookup error:', error.message);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }
}
