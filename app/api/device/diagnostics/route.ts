import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateKeyPair, healthCheck } from '@/lib/grpc/client';

/**
 * GET /api/device/diagnostics
 *
 * Diagnostic endpoint for testing gRPC connectivity to CIRISRegistry.
 * Tests health check (unauthenticated) and key generation (authenticated).
 * Requires NextAuth session with orgId.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const orgId = (session.user as any).orgId;

    const results: Record<string, any> = {
      grpc_url: process.env.REGISTRY_GRPC_URL || 'localhost:50052 (default)',
      jwt_secret_set: !!(
        process.env.REGISTRY_JWT_SECRET || process.env.JWT_SECRET
      ),
      jwt_issuer: process.env.REGISTRY_JWT_ISSUER || 'ciris-registry (default)',
      user: session.user.email,
      org_id: orgId || 'NOT SET',
      role: (session.user as any).role || 'NOT SET',
    };

    // Test 1: Health check (unauthenticated RegistryService)
    try {
      const health = await healthCheck(false);
      results.health_check = {
        status: 'ok',
        registry_version: health.version,
        db_healthy: health.databaseHealthy,
      };
    } catch (e: any) {
      results.health_check = {
        status: 'error',
        message: e?.message || String(e),
        code: e?.code,
      };
    }

    // Test 2: Key generation (authenticated PortalService) using user's actual org
    if (orgId) {
      try {
        const keyData = await generateKeyPair({
          orgId,
          requesterUserId: session.user.email,
          activateImmediately: false,
        });
        results.key_generation = {
          status: 'ok',
          has_private_key: !!(
            keyData.ed25519PrivateKey || keyData.ed25519_private_key
          ),
          has_key_record: !!keyData.keyRecord,
          key_id: keyData.keyRecord?.keyId || 'none',
        };
      } catch (e: any) {
        results.key_generation = {
          status: 'error',
          message: e?.message || String(e),
          code: e?.code,
          metadata: e?.metadata?.toJSON?.() || null,
        };
      }
    } else {
      results.key_generation = {
        status: 'skipped',
        reason: 'No orgId in session - cannot test key generation',
      };
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Diagnostics failed',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
