import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe/service';
import { isStripeConfigured } from '@/lib/stripe/config';
import { generateKeyPair } from '@/lib/grpc/client';
import { markDevicePaymentComplete } from '@/lib/device-auth/store';

/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook handler. Processes:
 * - checkout.session.completed — activation or subscription checkout done
 * - customer.subscription.created/updated/deleted — tier changes
 * - invoice.payment_failed / invoice.paid — payment status
 * - charge.refunded — stake refund recorded
 *
 * This route is PUBLIC (no session auth) but verified via Stripe signature.
 */
export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Billing not configured' },
      { status: 503 }
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event;
  try {
    const body = await request.text();
    event = constructWebhookEvent(body, signature);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Webhook verification failed';
    console.error('[Webhook] Signature verification failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const metadata = session.metadata || {};

        if (metadata.type === 'identity_activation') {
          console.log(
            `[Webhook] Identity activated: tier=${metadata.tier}, hw_key=${metadata.hardware_key_hash}, org=${metadata.org_id}, agent_category=${metadata.agent_category || 'ciris'}`
          );

          // Mark device auth record as paid (if this was a device auth checkout)
          await markDevicePaymentComplete(session.id);

          // Auto-generate key for the org that paid
          if (metadata.org_id && metadata.user_id) {
            try {
              const keyResponse = await generateKeyPair({
                orgId: metadata.org_id,
                requesterUserId: metadata.user_id,
                activateImmediately: true,
              });
              console.log(
                `[Webhook] Key auto-generated for org ${metadata.org_id}: ${keyResponse?.keyRecord?.keyId || keyResponse?.key_record?.key_id || 'unknown'}`
              );
            } catch (keyError) {
              console.error(
                `[Webhook] Failed to auto-generate key for org ${metadata.org_id}:`,
                keyError
              );
              // Payment succeeded but key generation failed — needs manual follow-up
            }
          } else {
            console.warn(
              '[Webhook] Activation payment missing org_id/user_id in metadata — key not auto-generated'
            );
          }
        } else if (metadata.type === 'tier_subscription') {
          console.log(`[Webhook] Subscription started: tier=${metadata.tier}`);
          // TODO: Update org tier in Registry
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log(
          `[Webhook] Subscription ${event.type}: ${subscription.id} (status=${subscription.status})`
        );
        // TODO: Sync subscription status to org metadata
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log(
          `[Webhook] Subscription canceled: ${subscription.id} — downgrading to community`
        );
        // TODO: Downgrade org to community tier (keep identity, lose assurance)
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log(
          `[Webhook] Payment failed: invoice=${invoice.id}, customer=${invoice.customer}`
        );
        // TODO: Flag org as payment_failed in metadata
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        console.log(`[Webhook] Payment succeeded: invoice=${invoice.id}`);
        // TODO: Clear payment_failed flag
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        console.log(`[Webhook] Charge refunded: ${charge.id}`);
        // Stake refund recorded — identity bond returned
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('[Webhook] Processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
