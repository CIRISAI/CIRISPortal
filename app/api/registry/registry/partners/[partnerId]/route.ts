import { NextResponse } from 'next/server';
import { lookupPartner } from '@/lib/grpc/client';

/**
 * GET /api/registry/registry/partners/[partnerId] - Lookup partner by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  try {
    const { partnerId } = await params;

    console.log('[API] lookupPartner called for:', partnerId);

    const response = await lookupPartner({ orgId: partnerId });

    if (!response || !response.partner) {
      return NextResponse.json(
        { found: false, partner: null },
        { status: 200 }
      );
    }

    // Map response to what the SDK expects
    const partner = response.partner;

    return NextResponse.json({
      found: true,
      partner: {
        partnerId: partner.partnerId || partnerId,
        orgId: partner.orgId || partnerId,
        organizationName: partner.organizationName || partner.name || 'Unknown',
        status: partner.status || 'PARTNER_STATUS_ACTIVE',
        licenseType: partner.licenseType || 'LICENSE_BASIC',
        expiresAt: partner.expiresAt
          ? parseInt(partner.expiresAt) * 1000
          : Date.now() + 90 * 24 * 60 * 60 * 1000,
        grantedCapabilities: partner.grantedCapabilities || [],
        deniedCapabilities: partner.deniedCapabilities || [],
        createdAt: partner.createdAt || '0',
        lastActivityAt: partner.lastActivityAt,
      },
      context: response.context,
    });
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number };
    console.error('[API] lookupPartner error:', err.message);

    // Return not found for gRPC NOT_FOUND errors
    if (err.code === 5) {
      return NextResponse.json(
        { found: false, partner: null },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: 500 }
    );
  }
}
