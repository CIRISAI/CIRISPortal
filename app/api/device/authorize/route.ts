import { NextResponse } from 'next/server';
import {
  createDeviceAuth,
  DEVICE_CODE_TTL_SECONDS,
  POLL_INTERVAL_SECONDS,
} from '@/lib/device-auth/store';

// Base URL for the Portal (used in verification_uri)
const PORTAL_BASE_URL =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://portal.ciris.ai';

/**
 * POST /api/device/authorize
 *
 * Initiates a device authorization flow (RFC 8628).
 * Called by CIRISAgent (unauthenticated) when user clicks "Acquire a License".
 *
 * The agent sends the portal URL and its identity info. We return
 * a device code (for polling) and a verification URL (for the user to
 * open in their browser).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { portal_url, agent_info } = body;

    if (!portal_url) {
      return NextResponse.json(
        { error: 'portal_url is required' },
        { status: 400 }
      );
    }

    const record = createDeviceAuth(portal_url, {}, agent_info || {});

    // RFC 8628 response format
    return NextResponse.json({
      device_code: record.deviceCode,
      user_code: record.userCode,
      verification_uri: `${PORTAL_BASE_URL}/device`,
      verification_uri_complete: `${PORTAL_BASE_URL}/device?code=${record.userCode}`,
      expires_in: DEVICE_CODE_TTL_SECONDS,
      interval: POLL_INTERVAL_SECONDS,
    });
  } catch (error) {
    console.error('[Device Auth] Authorize error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
