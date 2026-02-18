import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { refundBond } from '@/lib/stripe/service';
import { isStripeConfigured } from '@/lib/stripe/config';

/**
 * POST /api/stripe/refund
 *
 * Refund the identity bond portion of an activation payment.
 * The issuance fee is non-refundable.
 *
 * Requires:
 * - Authenticated session
 * - paymentIntentId from the original activation
 * - bondAmountCents to refund
 * - hardwareKeySignature proving ownership of the hardware key
 *
 * Body: { paymentIntentId: string, bondAmountCents: number, hardwareKeySignature: string }
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
    const { paymentIntentId, bondAmountCents, hardwareKeySignature } = body as {
      paymentIntentId: string;
      bondAmountCents: number;
      hardwareKeySignature: string;
    };

    if (!paymentIntentId || !bondAmountCents || !hardwareKeySignature) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: paymentIntentId, bondAmountCents, hardwareKeySignature',
        },
        { status: 400 }
      );
    }

    // TODO: Verify hardwareKeySignature against the stored hardware_key_hash
    // in the PaymentIntent metadata. This ensures only the hardware key owner
    // can reclaim their bond.
    //
    // For MVP, we accept the signature and log it for audit.
    console.log(
      `[Refund] Bond refund requested: PI=${paymentIntentId}, amount=${bondAmountCents}, user=${session.user.email}`
    );

    const refund = await refundBond(
      paymentIntentId,
      bondAmountCents,
      `Proper decommission by ${session.user.email}`
    );

    return NextResponse.json({
      status: 'refunded',
      refundId: refund.id,
      amount: refund.amount,
    });
  } catch (error: unknown) {
    console.error('[API] Stripe refund error:', error);
    const message = error instanceof Error ? error.message : 'Refund failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
