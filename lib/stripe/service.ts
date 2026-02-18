/**
 * Stripe Service - Manages customer billing, identity activation, and subscriptions.
 *
 * Ported from ethicsengine-portal-api/app/services/stripe_service.py → TypeScript.
 * Uses Stripe Node SDK directly (no async wrapper needed like Python).
 *
 * Identity activation uses two separate line items:
 * 1. Issuance fee (non-refundable) — prevents identity churn
 * 2. Identity bond (refundable) — accountability anchor
 */

import Stripe from 'stripe';
import { getStripeConfig, isStripeConfigured } from './config';
import { TIER_DEFINITIONS, type TierName } from './tiers';

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const config = getStripeConfig();
    if (!config.secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = new Stripe(config.secretKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }
  return _stripe;
}

// ─── Customer Management ────────────────────────────────────────────────────

/**
 * Create a new Stripe customer.
 * Pattern: ethicsengine-portal-api StripeService.create_customer()
 */
export async function createCustomer(
  email: string,
  name?: string,
  tier: TierName = 'community'
): Promise<Stripe.Customer> {
  const stripe = getStripe();
  const params: Stripe.CustomerCreateParams = {
    email,
    metadata: {
      tier,
      activation_status: 'pending',
      created_via: 'ciris-portal',
    },
  };
  if (name) params.name = name;

  const customer = await stripe.customers.create(params);
  console.log(
    `[Stripe] Customer created: ${customer.id} (${email}, tier=${tier})`
  );
  return customer;
}

/**
 * Get a Stripe customer by email.
 * Pattern: ethicsengine-portal-api StripeService.get_customer_by_email()
 */
export async function getCustomerByEmail(
  email: string
): Promise<Stripe.Customer | null> {
  const stripe = getStripe();
  const result = await stripe.customers.list({ email, limit: 1 });
  if (result.data.length > 0) {
    return result.data[0];
  }
  return null;
}

/**
 * Get a Stripe customer by ID.
 */
export async function getCustomer(
  customerId: string
): Promise<Stripe.Customer> {
  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) {
    throw new Error(`Customer ${customerId} has been deleted`);
  }
  return customer as Stripe.Customer;
}

/**
 * Update customer metadata.
 * Pattern: ethicsengine-portal-api StripeService.update_customer_metadata()
 */
export async function updateCustomerMetadata(
  customerId: string,
  metadata: Record<string, string>
): Promise<Stripe.Customer> {
  const stripe = getStripe();
  return await stripe.customers.update(customerId, { metadata });
}

// ─── Identity Activation ────────────────────────────────────────────────────

/**
 * Create a Stripe Checkout Session for identity activation.
 *
 * Two line items:
 * 1. Issuance fee (non-refundable product)
 * 2. Identity bond (refundable product)
 *
 * Metadata stores hardware_key_hash and tier for audit trail.
 */
export async function createActivationCheckout(
  customerId: string,
  tier: TierName,
  hardwareKeyHash: string,
  successUrl: string,
  cancelUrl: string,
  context?: { orgId?: string; userId?: string }
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const config = getStripeConfig();
  const tierDef = TIER_DEFINITIONS[tier];

  // Get price IDs for this tier's activation
  const tierKey = tier === 'safety_critical' ? 'enterprise' : tier;
  const issuancePriceId =
    config.prices.issuance[tierKey as keyof typeof config.prices.issuance];
  const bondPriceId =
    config.prices.bond[tierKey as keyof typeof config.prices.bond];

  if (!issuancePriceId || !bondPriceId) {
    throw new Error(`Activation prices not configured for tier: ${tier}`);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [
      { price: issuancePriceId, quantity: 1 },
      { price: bondPriceId, quantity: 1 },
    ],
    metadata: {
      type: 'identity_activation',
      tier,
      hardware_key_hash: hardwareKeyHash,
      issuance_fee_cents: String(tierDef.issuanceFee),
      bond_cents: String(tierDef.identityBond),
      org_id: context?.orgId || '',
      user_id: context?.userId || '',
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  console.log(
    `[Stripe] Activation checkout created: ${session.id} (tier=${tier}, customer=${customerId})`
  );
  return session;
}

/**
 * Refund the identity bond portion only.
 * Requires the PaymentIntent ID from the original activation.
 * The issuance fee is non-refundable.
 */
export async function refundBond(
  paymentIntentId: string,
  bondAmountCents: number,
  reason?: string
): Promise<Stripe.Refund> {
  const stripe = getStripe();
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: bondAmountCents,
    reason: 'requested_by_customer',
    metadata: {
      type: 'identity_bond_refund',
      reason: reason || 'proper_decommission',
    },
  });

  console.log(
    `[Stripe] Bond refunded: ${refund.id} (${bondAmountCents} cents from PI ${paymentIntentId})`
  );
  return refund;
}

/**
 * Mark stake as forfeited (malicious use / revocation).
 * Records the forfeiture in metadata but does not refund.
 */
export async function forfeitStake(
  paymentIntentId: string,
  reason: string
): Promise<void> {
  const stripe = getStripe();
  await stripe.paymentIntents.update(paymentIntentId, {
    metadata: {
      stake_status: 'forfeited',
      forfeiture_reason: reason,
      forfeited_at: new Date().toISOString(),
    },
  });

  console.log(
    `[Stripe] Stake forfeited: PI ${paymentIntentId} (reason: ${reason})`
  );
}

// ─── Subscription Management ────────────────────────────────────────────────

/**
 * Create a Stripe Checkout Session for tier subscription upgrade.
 * Pattern: ethicsengine-portal-api customer_routes.py set_customer_tier()
 */
export async function createSubscriptionCheckout(
  customerId: string,
  tier: TierName,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const config = getStripeConfig();

  const tierKey = tier === 'safety_critical' ? 'enterprise' : tier;
  const priceId =
    config.prices.subscription[
      tierKey as keyof typeof config.prices.subscription
    ];

  if (!priceId) {
    throw new Error(`Subscription price not configured for tier: ${tier}`);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      type: 'tier_subscription',
      tier,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  console.log(
    `[Stripe] Subscription checkout created: ${session.id} (tier=${tier}, customer=${customerId})`
  );
  return session;
}

/**
 * Cancel a subscription immediately.
 * Pattern: ethicsengine-portal-api StripeService.cancel_subscription_immediately()
 */
export async function cancelSubscriptionImmediately(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  const canceled = await stripe.subscriptions.cancel(subscriptionId);
  console.log(`[Stripe] Subscription canceled: ${subscriptionId}`);
  return canceled;
}

/**
 * List subscriptions for a customer.
 * Pattern: ethicsengine-portal-api StripeService.list_subscriptions()
 */
export async function listSubscriptions(
  customerId: string,
  status: Stripe.SubscriptionListParams.Status = 'all'
): Promise<Stripe.Subscription[]> {
  const stripe = getStripe();
  const result = await stripe.subscriptions.list({
    customer: customerId,
    status,
    limit: 10,
  });
  return result.data;
}

/**
 * List invoices for a customer.
 * Pattern: ethicsengine-portal-api StripeService.list_invoices()
 */
export async function listInvoices(
  customerId: string,
  limit: number = 10
): Promise<Stripe.Invoice[]> {
  const stripe = getStripe();
  const result = await stripe.invoices.list({
    customer: customerId,
    limit: Math.min(limit, 100),
  });
  return result.data;
}

// ─── Customer Portal ────────────────────────────────────────────────────────

/**
 * Create a Stripe Customer Portal session.
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();
  return await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

// ─── Webhook Verification ───────────────────────────────────────────────────

/**
 * Verify and construct a Stripe webhook event.
 */
export function constructWebhookEvent(
  body: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  const config = getStripeConfig();
  if (!config.webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  return stripe.webhooks.constructEvent(body, signature, config.webhookSecret);
}

// ─── Health Check ───────────────────────────────────────────────────────────

/**
 * Check Stripe API connectivity.
 * Pattern: ethicsengine-portal-api StripeService.health_check()
 */
export async function healthCheck(): Promise<boolean> {
  if (!isStripeConfigured()) return false;
  try {
    const stripe = getStripe();
    await stripe.customers.list({ limit: 1 });
    return true;
  } catch {
    return false;
  }
}
