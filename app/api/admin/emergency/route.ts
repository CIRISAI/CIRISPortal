import { NextResponse } from 'next/server';
import {
  setEmergencyShutdown,
  clearEmergencyShutdown,
  getEmergencyStatus,
} from '@/lib/grpc/client';

/**
 * GET /api/admin/emergency - Get current emergency status
 */
export async function GET() {
  try {
    const response = await getEmergencyStatus();

    return NextResponse.json({
      isLocked: response.isLocked || false,
      severity: response.severity || '',
      reason: response.lockReason || '',
      lockedAt: response.lockedAt || '',
      lockedBy: response.lockedBy || '',
      unlockAt: response.lockedUntil || null,
      allowedOperations: response.allowedOperations || [],
      context: response.context,
    });
  } catch (error: unknown) {
    console.error('[API] Get emergency status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/emergency - Set or clear emergency shutdown
 *
 * Body for SET:
 * {
 *   action: 'SET',
 *   severity: string,
 *   reason: string,
 *   duration?: number (seconds, null for manual unlock),
 *   allowedOperations?: string[]
 * }
 *
 * Body for CLEAR:
 * {
 *   action: 'CLEAR'
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'CLEAR') {
      const response = await clearEmergencyShutdown();

      return NextResponse.json({
        success: true,
        cleared: true,
        context: response.context,
      });
    }

    if (action === 'SET') {
      const { severity, reason, duration, allowedOperations } = body;

      if (!severity || !reason) {
        return NextResponse.json(
          { error: 'Missing required fields: severity, reason' },
          { status: 400 }
        );
      }

      const response = await setEmergencyShutdown({
        severity,
        reason,
        durationSeconds: duration || undefined,
        allowedOperations: allowedOperations || [],
      });

      return NextResponse.json({
        success: true,
        activated: true,
        lockedUntil: response.lockedUntil,
        context: response.context,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use SET or CLEAR' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('[API] Emergency action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
