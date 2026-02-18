import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import {
  createActivationCheckout,
  createSubscriptionCheckout,
  getCustomerByEmail,
  createCustomer,
} from '@/lib/stripe/service';
import { TIER_DEFINITIONS, type TierName } from '@/lib/stripe/tiers';
import { isStripeConfigured } from '@/lib/stripe/config';

/**
 * POST /api/stripe/checkout
 *
 * Create a Stripe Checkout Session for:
 * 1. Identity activation (one-time: issuance fee + identity bond)
 * 2. Tier subscription upgrade (recurring assurance)
 *
 * Body: { type: 'activation' | 'subscription', tier: TierName, hardwareKeyHash?: string }
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

    const body = await request.json();
    const { type, tier, hardwareKeyHash } = body as {
      type: 'activation' | 'subscription';
      tier: TierName;
      hardwareKeyHash?: string;
    };

    if (!type || !tier) {
      return NextResponse.json(
        { error: 'Missing required fields: type, tier' },
        { status: 400 }
      );
    }

    if (!TIER_DEFINITIONS[tier]) {
      return NextResponse.json(
        { error: `Invalid tier: ${tier}` },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const email = session.user.email;
    let customer = await getCustomerByEmail(email);
    if (!customer) {
      customer = await createCustomer(
        email,
        session.user.name || undefined,
        tier
      );
    }

    const baseUrl = request.nextUrl.origin;

    if (type === 'activation') {
      if (!hardwareKeyHash) {
        return NextResponse.json(
          { error: 'hardwareKeyHash is required for activation' },
          { status: 400 }
        );
      }

      const checkoutSession = await createActivationCheckout(
        customer.id,
        tier,
        hardwareKeyHash,
        `${baseUrl}/dashboard?activated=true`,
        `${baseUrl}/activate?canceled=true`
      );

      return NextResponse.json({ url: checkoutSession.url });
    }

    if (type === 'subscription') {
      if (tier === 'community') {
        return NextResponse.json(
          { error: 'Community tier has no subscription' },
          { status: 400 }
        );
      }

      const checkoutSession = await createSubscriptionCheckout(
        customer.id,
        tier,
        `${baseUrl}/dashboard?upgraded=true`,
        `${baseUrl}/pricing?canceled=true`
      );

      return NextResponse.json({ url: checkoutSession.url });
    }

    return NextResponse.json(
      { error: `Invalid checkout type: ${type}` },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('[API] Stripe checkout error:', error);
    const message = error instanceof Error ? error.message : 'Checkout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
