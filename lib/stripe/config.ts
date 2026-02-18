/**
 * Stripe Configuration
 *
 * Environment variables for Stripe integration.
 * Pattern: ethicsengine-portal-api/app/config.py
 */

export function getStripeConfig() {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',

    // Activation products (one-time)
    prices: {
      issuance: {
        community: process.env.STRIPE_PRICE_ISSUANCE_COMMUNITY || '',
        professional: process.env.STRIPE_PRICE_ISSUANCE_PRO || '',
        enterprise: process.env.STRIPE_PRICE_ISSUANCE_ENTERPRISE || '',
      },
      bond: {
        community: process.env.STRIPE_PRICE_BOND_COMMUNITY || '',
        professional: process.env.STRIPE_PRICE_BOND_PRO || '',
        enterprise: process.env.STRIPE_PRICE_BOND_ENTERPRISE || '',
      },
      // Non-CIRIS agents (third-party agents using CIRIS identity system)
      nonCirisIssuance: {
        community: process.env.STRIPE_PRICE_ISSUANCE_NONCIRIS_COMMUNITY || '',
      },
      nonCirisBond: {
        community: process.env.STRIPE_PRICE_BOND_NONCIRIS_COMMUNITY || '',
      },
      // Subscription products (recurring assurance)
      subscription: {
        professional: process.env.STRIPE_PRICE_ID_PRO || '',
        enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE || '',
      },
    },

    // Safety-critical uses custom per-customer pricing
    productIdSafety: process.env.STRIPE_PRODUCT_ID_SAFETY || '',
  };
}

/**
 * Check if Stripe is configured (has a secret key).
 * In devtest mode, Stripe operations are skipped.
 */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
