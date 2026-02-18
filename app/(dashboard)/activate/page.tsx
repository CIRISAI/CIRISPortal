'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  TIER_DEFINITIONS,
  formatCents,
  getActivationCost,
} from '@/lib/stripe/tiers';

/**
 * Identity Activation Page
 *
 * Shown to community users who have signed up via OAuth but haven't
 * paid their activation stake yet. Redirected here from middleware
 * when org.metadata.activation_status !== 'active'.
 */
export default function ActivatePage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tier = TIER_DEFINITIONS.community;
  const totalCost = getActivationCost('community');

  const handleActivate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: In production, the hardwareKeyHash comes from the agent's
      // TPM-backed key. For portal-initiated activation, we generate a
      // placeholder that gets replaced during device auth key binding.
      const hardwareKeyHash = `portal-activation-${Date.now()}`;

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'activation',
          tier: 'community',
          hardwareKeyHash,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg
                className="h-8 w-8 text-emerald-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Activate Your Identity
            </h1>
            <p className="mt-2 text-gray-600">
              Welcome, {session?.user?.name || session?.user?.email}
            </p>
          </div>

          {/* What you get */}
          <div
            data-testid="activate-features"
            className="mb-6 rounded-lg bg-gray-50 p-4"
          >
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Community Identity Includes
            </h2>
            <ul className="space-y-2">
              {tier.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-3 text-sm text-gray-700"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-600">
                    &#10003;
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Pricing breakdown */}
          <div
            data-testid="activate-pricing"
            className="mb-6 space-y-2 rounded-lg border border-gray-200 p-4"
          >
            <div className="flex justify-between text-sm text-gray-600">
              <span>Identity issuance fee</span>
              <span>{formatCents(tier.issuanceFee)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>
                Refundable identity bond
                <span className="ml-1 text-xs text-gray-400">
                  (returned on decommission)
                </span>
              </span>
              <span>{formatCents(tier.identityBond)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2">
              <div className="flex justify-between font-semibold text-gray-900">
                <span>Total</span>
                <span>{formatCents(totalCost)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              No recurring charges. Upgrade to Professional anytime.
            </p>
          </div>

          {error && (
            <div
              data-testid="activate-error"
              className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <button
            data-testid="btn-activate"
            onClick={handleActivate}
            disabled={isLoading}
            className="w-full rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow disabled:opacity-50"
          >
            {isLoading
              ? 'Redirecting to checkout...'
              : `Activate Identity \u2014 ${formatCents(totalCost)}`}
          </button>

          <p className="mt-4 text-center text-xs text-gray-400">
            Secured by Stripe. Your identity bond of{' '}
            {formatCents(tier.identityBond)} is fully refundable when you
            properly decommission your agent identity.
          </p>
        </div>

        {/* Upgrade teaser */}
        <div className="mt-6 rounded-lg border border-gray-100 bg-white p-4 text-center shadow-sm">
          <p className="text-sm text-gray-600">
            Need steward-backed verification or professional capabilities?
          </p>
          <p className="mt-1 text-sm font-medium text-emerald-600">
            Professional tier starts at $10/agent/month
          </p>
        </div>
      </div>
    </div>
  );
}
