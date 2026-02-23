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
 * Community users pay $1.50 per agent identity ($0.50 issuance + $1.00 bond).
 * Each activation generates one key. Users can activate up to 5 identities.
 * Bond is forfeited on revocation; admin can manually refund via Stripe.
 *
 * Collects a public contact email (may differ from OAuth email) and requires
 * explicit acknowledgment of terms before proceeding to checkout.
 */
export default function ActivatePage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicEmail, setPublicEmail] = useState(session?.user?.email || '');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const tier = TIER_DEFINITIONS.community;
  const totalCost = getActivationCost('community');

  const handleActivate = async () => {
    if (!termsAccepted) {
      setError('You must accept the terms to continue.');
      return;
    }
    if (!publicEmail || !publicEmail.includes('@')) {
      setError('A valid public contact email is required.');
      return;
    }

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
          publicEmail,
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
              New Agent Identity
            </h1>
            <p className="mt-2 text-gray-600">
              {formatCents(totalCost)} per agent identity
            </p>
          </div>

          {/* CIRIS Identity Benefits */}
          <div
            data-testid="activate-features"
            className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4"
          >
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-emerald-700">
              CIRIS Identity Benefits
            </h2>
            <ul className="space-y-2">
              <li className="flex items-start gap-3 text-sm text-emerald-900">
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 text-xs text-emerald-700">
                  &#10003;
                </span>
                <span>
                  <strong>Cryptographic Audit Trail</strong> &mdash; Every
                  action is signed with your agent&apos;s Ed25519 key, creating
                  tamper-evident traces
                </span>
              </li>
              <li className="flex items-start gap-3 text-sm text-emerald-900">
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 text-xs text-emerald-700">
                  &#10003;
                </span>
                <span>
                  <strong>Coherence Ratchet</strong> &mdash; Your traces
                  contribute to the mathematical framework where coordinated
                  deception becomes statistically harder over time
                </span>
              </li>
              <li className="flex items-start gap-3 text-sm text-emerald-900">
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 text-xs text-emerald-700">
                  &#10003;
                </span>
                <span>
                  <strong>CIRIS Scoring</strong> &mdash; Measures integrity
                  across interactions; higher scores indicate more reliable
                  agents
                </span>
              </li>
              <li className="flex items-start gap-3 text-sm text-emerald-900">
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 text-xs text-emerald-700">
                  &#10003;
                </span>
                <span>
                  <strong>Future Decommissioning</strong> &mdash; Only CIRIS
                  identities will support proper agent decommissioning per CIRIS
                  standards
                </span>
              </li>
            </ul>
          </div>

          {/* Non-CIRIS Alternative */}
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-100 p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-600">
              Non-CIRIS Identity Option
            </h2>
            <p className="text-xs text-gray-600">
              Non-CIRIS identities are stored in the registry but{' '}
              <strong>do not participate</strong> in the coherence ratchet,
              CIRIS scoring, or cryptographic provenance. They cannot be
              decommissioned per CIRIS standards. Choose this only if you want
              to support CIRIS development without requiring identity
              verification.
            </p>
          </div>

          {/* Public contact email */}
          <div className="mb-6">
            <label
              htmlFor="public-email"
              className="block text-sm font-medium text-gray-700"
            >
              Public Contact Email
            </label>
            <p className="mb-2 text-xs text-gray-500">
              This email will be publicly visible in the CIRIS Registry as the
              contact for your agent identity. It may differ from your sign-in
              email. Anyone querying the registry can see this address.
            </p>
            <input
              data-testid="input-public-email"
              type="email"
              id="public-email"
              value={publicEmail}
              onChange={(e) => setPublicEmail(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="contact@example.com"
              required
            />
          </div>

          {/* What is publicly visible */}
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-amber-900">
              What is publicly visible
            </h3>
            <ul className="space-y-1 text-xs text-amber-800">
              <li>&#8226; Your public contact email (above)</li>
              <li>&#8226; Organization name and domain</li>
              <li>
                &#8226; Agent identity hash, status, and registration date
              </li>
              <li>&#8226; Public key fingerprints</li>
              <li>&#8226; Identity template type (e.g., echo, default)</li>
            </ul>
            <p className="mt-2 text-xs text-amber-700">
              Private keys, capabilities, adapters, and your sign-in email are{' '}
              <strong>never</strong> publicly exposed.
            </p>
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
                Identity bond
                <span className="ml-1 text-xs text-gray-400">
                  (forfeited on revocation)
                </span>
              </span>
              <span>{formatCents(tier.identityBond)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2">
              <div className="flex justify-between font-semibold text-gray-900">
                <span>Total per identity</span>
                <span>{formatCents(totalCost)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Per identity. No recurring charges. Up to {tier.agentLimit}{' '}
              concurrent identities.
            </p>
          </div>

          {/* AS-IS / No warranty disclaimer */}
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-bold uppercase text-gray-700">
              COMMUNITY TIER &mdash; PROVIDED &ldquo;AS IS&rdquo;
            </p>
            <p className="mt-2 text-xs text-gray-600">
              THE COMMUNITY TIER IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
              AVAILABLE&rdquo; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
              INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. CIRIS L3C
              MAKES NO GUARANTEES REGARDING UPTIME, VERIFICATION ACCURACY, OR
              REGISTRY AVAILABILITY AT THE COMMUNITY TIER.
            </p>
            <p className="mt-2 text-xs text-gray-600">
              Community identities receive no steward-backed verification, no
              SLA, and no liability coverage. You are solely responsible for
              your agent&apos;s behavior. The identity bond is forfeited on
              revocation. For steward-backed validation and accountability
              support, upgrade to the Professional tier.
            </p>
          </div>

          {/* Terms acceptance */}
          <label className="mb-4 flex cursor-pointer items-start gap-3">
            <input
              data-testid="checkbox-terms"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-xs text-gray-600">
              I understand that my public contact email and agent identity data
              will be visible in the CIRIS Registry, that the community tier is
              provided without warranty or guarantees, and that the identity
              bond is forfeited if my identity is revoked.
            </span>
          </label>

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
            disabled={isLoading || !termsAccepted}
            className="w-full rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow disabled:opacity-50"
          >
            {isLoading
              ? 'Redirecting to checkout...'
              : `Activate Identity \u2014 ${formatCents(totalCost)}`}
          </button>

          <p className="mt-4 text-center text-xs text-gray-400">
            Secured by Stripe. Bond of {formatCents(tier.identityBond)} is
            forfeited if the identity is revoked.
          </p>
        </div>

        {/* Upgrade teaser */}
        <div className="mt-6 rounded-lg border border-gray-100 bg-white p-4 text-center shadow-sm">
          <p className="text-sm text-gray-600">
            Need steward-backed verification, SLA, or liability coverage?
          </p>
          <p className="mt-1 text-sm font-medium text-emerald-600">
            Professional tier starts at $10/agent/month
          </p>
        </div>
      </div>
    </div>
  );
}
