import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createPortalSession, getCustomerByEmail } from '@/lib/stripe/service';
import { isStripeConfigured } from '@/lib/stripe/config';

/**
 * POST /api/stripe/portal
 *
 * Create a Stripe Customer Portal session for managing subscription,
 * viewing invoices, and updating payment methods.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Billing not configured' },
        { status: 503 }
      );
    }

    const customer = await getCustomerByEmail(session.user.email);
    if (!customer) {
      return NextResponse.json(
        { error: 'No billing account found' },
        { status: 404 }
      );
    }

    const baseUrl = request.nextUrl.origin;
    const portalSession = await createPortalSession(
      customer.id,
      `${baseUrl}/account`
    );

    return NextResponse.json({ url: portalSession.url });
  } catch (error: unknown) {
    console.error('[API] Stripe portal error:', error);
    const message =
      error instanceof Error ? error.message : 'Portal session failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
