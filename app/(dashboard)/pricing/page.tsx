'use client';

import { useState } from 'react';
import {
  TIER_DEFINITIONS,
  formatCents,
  type TierName,
} from '@/lib/stripe/tiers';
import { TierBadge } from '@/components/ui/tier-badge';

const TIER_ORDER: TierName[] = [
  'community',
  'professional',
  'enterprise',
  'safety_critical',
];

export default function PricingPage() {
  const [loadingTier, setLoadingTier] = useState<TierName | null>(null);

  // TODO: Get actual current tier from session/org metadata
  const currentTier: TierName = 'community';

  const handleUpgrade = async (tier: TierName) => {
    if (tier === 'safety_critical') {
      // Custom pricing — contact sales
      window.location.href =
        'mailto:licensing@ciris.ai?subject=Safety-Critical%20License%20Inquiry';
      return;
    }

    setLoadingTier(tier);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          tier,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Checkout failed');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div data-testid="pricing-page" className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Agent Identity &amp; Assurance Tiers
        </h1>
        <p className="mt-2 text-gray-600">
          Identity is the foundation. Assurance is the value.
        </p>
      </div>

      {/* Tier cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {TIER_ORDER.map((tierName) => {
          const tier = TIER_DEFINITIONS[tierName];
          const isCurrent = tierName === currentTier;
          const isHigher =
            TIER_ORDER.indexOf(tierName) > TIER_ORDER.indexOf(currentTier);

          return (
            <div
              key={tierName}
              data-testid={`tier-card-${tierName}`}
              className={`relative rounded-xl border p-6 ${
                isCurrent
                  ? 'border-emerald-300 bg-emerald-50/50 shadow-md'
                  : 'border-gray-200 bg-white shadow-sm'
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span
                    data-testid="tier-current-badge"
                    className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white"
                  >
                    Current Tier
                  </span>
                </div>
              )}

              <div className="mb-4">
                <TierBadge tier={tierName} size="md" />
              </div>

              {/* Activation cost */}
              <div className="mb-4">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  Identity Activation
                </p>
                <div className="mt-1 text-sm text-gray-700">
                  <span>{formatCents(tier.issuanceFee)} fee</span>
                  <span className="text-gray-400"> + </span>
                  <span>{formatCents(tier.identityBond)} bond</span>
                </div>
              </div>

              {/* Monthly price */}
              <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  Monthly Assurance
                </p>
                <div className="mt-1">
                  {tier.monthlyPrice === null ? (
                    <span className="text-2xl font-bold text-gray-900">
                      Custom
                    </span>
                  ) : tier.monthlyPrice === 0 ? (
                    <span className="text-2xl font-bold text-gray-900">
                      Free
                    </span>
                  ) : (
                    <div>
                      <span className="text-2xl font-bold text-gray-900">
                        {formatCents(tier.monthlyPrice)}
                      </span>
                      <span className="text-sm text-gray-500">/agent/mo</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Agent limit */}
              {tier.agentLimit !== null && (
                <p className="mb-4 text-xs text-gray-500">
                  Up to {tier.agentLimit} agent
                  {tier.agentLimit !== 1 ? 's' : ''}
                </p>
              )}
              {tier.agentLimit === null && (
                <p className="mb-4 text-xs text-gray-500">Unlimited agents</p>
              )}

              {/* Features */}
              <ul className="mb-6 space-y-2">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <span className="mt-0.5 text-emerald-500">&#10003;</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Action button */}
              <div className="mt-auto">
                {isCurrent ? (
                  <button
                    data-testid={`btn-current-plan-${tierName}`}
                    disabled
                    className="w-full rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700"
                  >
                    Current Plan
                  </button>
                ) : isHigher ? (
                  <button
                    data-testid={`btn-upgrade-${tierName}`}
                    onClick={() => handleUpgrade(tierName)}
                    disabled={loadingTier === tierName}
                    className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {loadingTier === tierName
                      ? 'Redirecting...'
                      : tierName === 'safety_critical'
                        ? 'Contact Sales'
                        : 'Upgrade'}
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400"
                  >
                    Included
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ / info */}
      <div className="mt-12 rounded-xl border border-gray-200 bg-white p-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          How Identity Activation Works
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="mb-2 font-medium text-gray-900">Issuance Fee</h3>
            <p className="text-sm text-gray-600">
              A small, non-refundable fee that covers registry infrastructure
              and prevents identity churn. This is your commitment to the
              identity ecosystem.
            </p>
          </div>
          <div>
            <h3 className="mb-2 font-medium text-gray-900">Identity Bond</h3>
            <p className="text-sm text-gray-600">
              A per-identity stake for Sybil resistance. Forfeited on
              revocation. Costs are per agent identity, not per organization.
            </p>
          </div>
          <div>
            <h3 className="mb-2 font-medium text-gray-900">
              Monthly Assurance
            </h3>
            <p className="text-sm text-gray-600">
              Paid tiers include steward-backed verification, compliance
              documentation, and accountability guarantees. You&apos;re not
              paying for capability &mdash; you&apos;re paying for
              accountability.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
