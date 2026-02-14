import { NextResponse } from 'next/server';
import {
  healthCheck,
  getEmergencyStatus,
  getCapabilities,
  getMetrics,
} from '@/lib/grpc/client';

/**
 * GET /api/registry/status - Public status endpoint
 *
 * Query params:
 * - type: 'health' | 'emergency' | 'capabilities' | 'metrics' | 'all'
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    const results: Record<string, any> = {};

    if (type === 'health' || type === 'all') {
      try {
        results.health = await healthCheck(true);
      } catch (e: unknown) {
        console.error('[API] Health check sub-query error:', e);
        results.health = { error: 'Unavailable' };
      }
    }

    if (type === 'emergency' || type === 'all') {
      try {
        results.emergency = await getEmergencyStatus();
      } catch (e: unknown) {
        console.error('[API] Emergency status sub-query error:', e);
        results.emergency = { error: 'Unavailable', isLocked: false };
      }
    }

    if (type === 'capabilities' || type === 'all') {
      try {
        results.capabilities = await getCapabilities();
      } catch (e: unknown) {
        console.error('[API] Capabilities sub-query error:', e);
        results.capabilities = { error: 'Unavailable' };
      }
    }

    if (type === 'metrics' || type === 'all') {
      try {
        results.metrics = await getMetrics();
      } catch (e: unknown) {
        console.error('[API] Metrics sub-query error:', e);
        results.metrics = { error: 'Unavailable' };
      }
    }

    // If specific type requested, return just that
    if (type !== 'all' && results[type]) {
      return NextResponse.json(results[type]);
    }

    return NextResponse.json(results);
  } catch (error: unknown) {
    console.error('[API] Status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
