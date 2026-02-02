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

    // Map status to numeric enum (SDK expects 0=UNSPECIFIED, 1=ACTIVE, 2=SUSPENDED, 3=REVOKED)
    const mapStatus = (status: unknown): number => {
      if (typeof status === 'number') return status;
      const statusStr = String(status);
      if (statusStr === 'PARTNER_STATUS_ACTIVE' || statusStr === '1') return 1;
      if (statusStr === 'PARTNER_STATUS_SUSPENDED' || statusStr === '2')
        return 2;
      if (statusStr === 'PARTNER_STATUS_REVOKED' || statusStr === '3') return 3;
      return 1; // Default to ACTIVE
    };

    return NextResponse.json({
      found: true,
      partner: {
        partnerId: partner.partnerId || partnerId,
        orgId: partner.orgId || partnerId,
        organizationName: partner.organizationName || partner.name || 'Unknown',
        status: mapStatus(partner.status),
        licenseType: partner.licenseType || 1,
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
