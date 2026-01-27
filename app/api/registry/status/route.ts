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
      } catch (e: any) {
        results.health = { error: e.message };
      }
    }

    if (type === 'emergency' || type === 'all') {
      try {
        results.emergency = await getEmergencyStatus();
      } catch (e: any) {
        results.emergency = { error: e.message, isLocked: false };
      }
    }

    if (type === 'capabilities' || type === 'all') {
      try {
        results.capabilities = await getCapabilities();
      } catch (e: any) {
        results.capabilities = { error: e.message };
      }
    }

    if (type === 'metrics' || type === 'all') {
      try {
        results.metrics = await getMetrics();
      } catch (e: any) {
        results.metrics = { error: e.message };
      }
    }

    // If specific type requested, return just that
    if (type !== 'all' && results[type]) {
      return NextResponse.json(results[type]);
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('[API] Status error:', error.message);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }
}
