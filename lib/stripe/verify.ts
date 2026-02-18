/**
 * Stripe session verification helper.
 *
 * Used by the device auth flow to confirm that a checkout session
 * has been paid, as a fallback when the webhook hasn't arrived yet.
 */

import Stripe from 'stripe';
import { isStripeConfigured } from './config';

/**
 * Verify that a Stripe checkout session has been paid.
 * Returns true if the session status is 'complete' and payment_status is 'paid'.
 */
export async function verifyCheckoutSession(
  sessionId: string
): Promise<boolean> {
  if (!isStripeConfigured()) return false;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-02-24.acacia',
    });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session.status === 'complete' && session.payment_status === 'paid';
  } catch (error) {
    console.error('[Stripe Verify] Failed to verify session:', error);
    return false;
  }
}
