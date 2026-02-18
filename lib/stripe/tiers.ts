/**
 * CIRIS Tier Definitions
 *
 * Pricing model: activation cost PER AGENT IDENTITY (issuance fee + identity bond)
 * plus optional monthly assurance subscription for paid tiers.
 *
 * Community: $1.50 per agent identity ($0.50 fee + $1.00 bond), max 5 concurrent.
 * Professional+: activation cost per key, plus monthly subscription for assurance.
 *
 * Bond is forfeited on revocation by default. Admin can issue manual refund
 * via Stripe dashboard for properly decommissioned identities.
 *
 * All prices in cents (USD).
 */

export type TierName =
  | 'community'
  | 'professional'
  | 'enterprise'
  | 'safety_critical';

export interface TierDefinition {
  /** Recurring monthly price per agent (cents). null = custom pricing. */
  monthlyPrice: number | null;
  /** Non-refundable identity issuance fee PER KEY (cents). */
  issuanceFee: number;
  /** Identity bond PER KEY (cents). Forfeited on revocation; admin can manually refund. */
  identityBond: number;
  /** Max concurrent agent identities per org. null = unlimited. */
  agentLimit: number | null;
  /** Display label. */
  label: string;
  /** Feature list for UI display. */
  features: string[];
}

export const TIER_DEFINITIONS: Record<TierName, TierDefinition> = {
  community: {
    monthlyPrice: 0,
    issuanceFee: 50, // $0.50
    identityBond: 100, // $1.00
    agentLimit: 5,
    label: 'Community',
    features: [
      'Hardware-bound identity',
      'Basic verification',
      'Echo & Default templates',
      'Community support',
    ],
  },
  professional: {
    monthlyPrice: 1000, // $10.00/mo per agent
    issuanceFee: 500, // $5.00
    identityBond: 1000, // $10.00
    agentLimit: 50,
    label: 'Professional',
    features: [
      'Steward-backed verification',
      'All community + partner templates',
      'Signed licensing chain',
      'Capability authorization',
      'Support SLA',
    ],
  },
  enterprise: {
    monthlyPrice: 10000, // $100.00/mo per agent
    issuanceFee: 2500, // $25.00
    identityBond: 10000, // $100.00
    agentLimit: 500,
    label: 'Enterprise',
    features: [
      'Formal attestation support',
      'Audit log anchoring',
      'Compliance documentation (SOC2/HIPAA/GDPR)',
      'License revocation guarantees',
      'Incident investigation support',
    ],
  },
  safety_critical: {
    monthlyPrice: null, // Custom pricing
    issuanceFee: 25000, // $250.00
    identityBond: 100000, // $1,000.00
    agentLimit: null,
    label: 'Safety-Critical',
    features: [
      'Liability backing',
      'Forensic audit support',
      'Regulatory compliance certification',
      'Dedicated steward identity anchoring',
      'Priority verification infrastructure',
    ],
  },
};

/**
 * Get total activation cost for a tier (issuance fee + identity bond).
 */
export function getActivationCost(tier: TierName): number {
  const def = TIER_DEFINITIONS[tier];
  return def.issuanceFee + def.identityBond;
}

/**
 * Format cents as dollar string.
 */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Get tier from license type string (from proto).
 */
export function licenseTypeToTier(licenseType: string): TierName {
  switch (licenseType) {
    case 'COMMUNITY':
    case 'COMMUNITY_PLUS':
      return 'community';
    case 'PROFESSIONAL_MEDICAL':
    case 'PROFESSIONAL_LEGAL':
    case 'PROFESSIONAL_FINANCIAL':
      return 'professional';
    case 'PROFESSIONAL_FULL':
      return 'enterprise';
    default:
      return 'community';
  }
}
