'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AllowedTemplate } from '@/lib/device-auth/abac';

type AgentCategory = 'ciris' | 'non_ciris';

interface DeviceLookupResponse {
  user_code: string;
  portal_url: string;
  node_manifest: Record<string, unknown>;
  agent_info: {
    agentHash?: string;
    currentPublicKey?: string;
    requestedAdapters?: string[];
  };
  status: string;
  allowed_templates: AllowedTemplate[];
  expires_at: number;
  attestation_verified: boolean;
  hardware_type: string | null;
}

/** Tier number → human-readable label */
function tierLabel(tier: number): string {
  switch (tier) {
    case 1:
      return 'Tier 1 — Full Autonomy';
    case 2:
      return 'Tier 2 — Supervised';
    case 3:
      return 'Tier 3 — Guided';
    case 4:
      return 'Tier 4 — Restricted';
    default:
      return `Tier ${tier}`;
  }
}

function DeviceAuthFlow() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const paid = searchParams.get('paid') === 'true';
  const canceled = searchParams.get('canceled') === 'true';
  const { data: session, status: sessionStatus } = useSession();

  const [deviceData, setDeviceData] = useState<DeviceLookupResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Registration step state
  const [agentCategory, setAgentCategory] = useState<AgentCategory | null>(
    null
  );
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedAdapters, setSelectedAdapters] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Fetch device record once authenticated
  const fetchDeviceData = useCallback(async () => {
    if (!code || sessionStatus !== 'authenticated') return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/device/lookup?code=${encodeURIComponent(code)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data: DeviceLookupResponse = await res.json();
      setDeviceData(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load device session'
      );
    } finally {
      setLoading(false);
    }
  }, [code, sessionStatus]);

  useEffect(() => {
    fetchDeviceData();
  }, [fetchDeviceData]);

  // Filter templates by agent category:
  // CIRIS agents → "default" only, Non-CIRIS → "non_ciris" only (community tier)
  const filteredTemplates =
    deviceData?.allowed_templates.filter((tpl) => {
      if (!agentCategory) return true;
      if (agentCategory === 'ciris') return tpl.id === 'default';
      if (agentCategory === 'non_ciris') return tpl.id === 'non_ciris';
      return true;
    }) ?? [];

  // Auto-select template when agent category narrows to one option
  useEffect(() => {
    if (
      filteredTemplates.length === 1 &&
      selectedTemplate !== filteredTemplates[0].id
    ) {
      setSelectedTemplate(filteredTemplates[0].id);
    }
  }, [agentCategory, filteredTemplates, selectedTemplate]);

  // When a template is selected, pre-fill its adapters
  useEffect(() => {
    if (!selectedTemplate || !deviceData) return;
    const tpl = deviceData.allowed_templates.find(
      (t) => t.id === selectedTemplate
    );
    if (tpl) {
      setSelectedAdapters(tpl.adapters);
    }
  }, [selectedTemplate, deviceData]);

  // Attestation status determines available agent categories
  const isAttested = deviceData?.attestation_verified === true;

  // Non-attested agents can only be Non-CIRIS — auto-select
  useEffect(() => {
    if (deviceData && !isAttested && agentCategory !== 'non_ciris') {
      setAgentCategory('non_ciris');
      setSelectedTemplate(null);
    }
  }, [deviceData, isAttested, agentCategory]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated' && code) {
      signIn(undefined, {
        callbackUrl: `/device?code=${encodeURIComponent(code)}`,
      });
    }
  }, [sessionStatus, code]);

  // Auto-complete provisioning after returning from Stripe payment
  useEffect(() => {
    if (!paid || !code || sessionStatus !== 'authenticated' || completed)
      return;
    let cancelled = false;

    async function completeAfterPayment() {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch('/api/device/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_code: code }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        if (!cancelled) setCompleted(true);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Provisioning failed after payment'
          );
        }
      } finally {
        if (!cancelled) setSubmitting(false);
      }
    }

    completeAfterPayment();
    return () => {
      cancelled = true;
    };
  }, [paid, code, sessionStatus, completed]);

  // Handle checkout → redirect to Stripe
  const handleCheckout = async () => {
    if (!selectedTemplate || !code || !agentCategory) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/device/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_code: code,
          template_id: selectedTemplate,
          adapters: selectedAdapters,
          agent_category: agentCategory,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setSubmitting(false);
    }
  };

  // No code in URL
  if (!code) {
    return (
      <CenterLayout>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Device Authorization</CardTitle>
            <CardDescription>
              Enter the code displayed by your agent setup wizard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              This page should be opened from the link provided by your agent
              during the &quot;Acquire a License&quot; setup flow.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              If you have a code, append it to the URL:
              <code className="ml-1 rounded bg-gray-100 px-2 py-0.5 text-xs">
                /device?code=ABCD-1234
              </code>
            </p>
          </CardContent>
        </Card>
      </CenterLayout>
    );
  }

  // Loading session or redirecting to login
  if (sessionStatus === 'loading' || sessionStatus === 'unauthenticated') {
    return (
      <CenterLayout>
        <div className="flex flex-col items-center gap-4">
          <Spinner />
          <p className="text-sm text-gray-500">Redirecting to sign in...</p>
        </div>
      </CenterLayout>
    );
  }

  // Provisioning in progress (returned from Stripe)
  if (paid && submitting && !completed) {
    return (
      <CenterLayout>
        <div className="flex flex-col items-center gap-4">
          <Spinner />
          <p className="text-sm font-medium text-gray-700">
            Payment received. Provisioning your agent...
          </p>
        </div>
      </CenterLayout>
    );
  }

  // Loading device data
  if (loading && !paid) {
    return (
      <CenterLayout>
        <div className="flex flex-col items-center gap-4">
          <Spinner />
          <p className="text-sm text-gray-500">Loading device session...</p>
        </div>
      </CenterLayout>
    );
  }

  // Error state
  if (error && !deviceData && !paid) {
    return (
      <CenterLayout>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">{error}</p>
            <button
              onClick={fetchDeviceData}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </CenterLayout>
    );
  }

  // Completed state
  if (completed) {
    return (
      <CenterLayout>
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-emerald-600">
              Purchase Complete!
            </CardTitle>
            <CardDescription>
              Your agent identity has been provisioned and a signing key issued.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-emerald-50 p-6 text-center">
              <p className="text-lg font-medium text-emerald-800">
                Return to the setup wizard to complete your agent configuration.
              </p>
              <p className="mt-2 text-sm text-emerald-700">
                Your agent is now polling for the provisioned key and will
                automatically continue setup.
              </p>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => window.close()}
                className="rounded-lg bg-emerald-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700"
              >
                Close This Page
              </button>
            </div>
            {(selectedTemplate || agentCategory) && (
              <div className="space-y-1 border-t pt-4 text-center text-sm text-gray-600">
                {agentCategory && (
                  <p>
                    <span className="font-medium">Agent Type:</span>{' '}
                    {agentCategory === 'ciris'
                      ? 'CIRIS Agent'
                      : 'Non-CIRIS Agent'}
                  </p>
                )}
                {selectedTemplate && (
                  <p>
                    <span className="font-medium">Template:</span>{' '}
                    {selectedTemplate}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </CenterLayout>
    );
  }

  // Error after payment
  if (error && paid) {
    return (
      <CenterLayout>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Provisioning Error</CardTitle>
            <CardDescription>
              Payment was received but provisioning encountered an issue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-700">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setSubmitting(true);
                fetch('/api/device/complete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ user_code: code }),
                })
                  .then(async (res) => {
                    if (!res.ok) {
                      const body = await res.json().catch(() => ({}));
                      throw new Error(body.error || `HTTP ${res.status}`);
                    }
                    setCompleted(true);
                  })
                  .catch((err) =>
                    setError(
                      err instanceof Error ? err.message : 'Retry failed'
                    )
                  )
                  .finally(() => setSubmitting(false));
              }}
              disabled={submitting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Retrying...' : 'Retry Provisioning'}
            </button>
          </CardContent>
        </Card>
      </CenterLayout>
    );
  }

  if (!deviceData) return null;

  // Extract node capabilities from manifest
  const nodeCaps = deviceData.node_manifest?.node_capabilities as
    | Record<string, unknown>
    | undefined;
  const nodeServices = (nodeCaps?.supported_services as string[]) || [];

  // Time remaining
  const remainingMs = deviceData.expires_at - Date.now();
  const remainingMin = Math.max(0, Math.ceil(remainingMs / 60000));

  return (
    <CenterLayout>
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            CIRIS<span className="text-emerald-600">Portal</span>
          </h1>
          <p className="mt-1 text-gray-500">Device Authorization</p>
        </div>

        {/* Canceled banner */}
        {canceled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Checkout was canceled. You can try again below.
          </div>
        )}

        {/* Node Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Agent Provisioning</CardTitle>
            <CardDescription>
              An agent is requesting to acquire a license via this portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="font-medium text-gray-500">Portal URL</span>
                <p className="text-gray-900">{deviceData.portal_url}</p>
              </div>
              <div>
                <span className="font-medium text-gray-500">Code</span>
                <p className="font-mono text-gray-900">
                  {deviceData.user_code}
                </p>
              </div>
              {nodeCaps?.node_id != null && (
                <div>
                  <span className="font-medium text-gray-500">Node ID</span>
                  <p className="text-gray-900">{String(nodeCaps.node_id)}</p>
                </div>
              )}
              <div>
                <span className="font-medium text-gray-500">Signed in as</span>
                <p className="text-gray-900">{session?.user?.email}</p>
              </div>
            </div>
            {nodeServices.length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-500">
                  Node Services
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {nodeServices.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {remainingMin > 0 && (
              <p className="text-xs text-gray-400">
                Expires in {remainingMin} minute{remainingMin !== 1 ? 's' : ''}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Important Information */}
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Important: Key Recovery Not Possible
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-amber-900">
            <p className="font-semibold">
              Agent identity keys cannot be recovered. If you wipe data or
              otherwise lose your key, it is gone forever.
            </p>

            <div>
              <p className="font-medium">What is the identity key used for?</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-amber-800">
                <li>
                  <strong>Audit trail signing</strong> &mdash; Every agent
                  decision is cryptographically signed, creating an externally
                  verifiable record
                </li>
                <li>
                  <strong>Tamper detection</strong> &mdash; Validates the
                  installation has not been modified, enabling third-party
                  verification
                </li>
                <li>
                  <strong>Identity validation</strong> &mdash; Supports testing
                  agent identity &ldquo;in the wild&rdquo; for the{' '}
                  <a
                    href="https://ciris.ai/coherence-ratchet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-amber-600"
                  >
                    Coherence Ratchet
                  </a>{' '}
                  and{' '}
                  <a
                    href="https://ciris.ai/ciris-scoring"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-amber-600"
                  >
                    CIRIS Scoring
                  </a>{' '}
                  research
                </li>
              </ul>
            </div>

            <p className="rounded-lg bg-white/50 p-3 text-amber-800">
              <strong>Privacy:</strong> Purchasing a license does not require
              opting in to sending traces to CIRIS L3C. Trace submission is
              always optional and under your control.
            </p>
          </CardContent>
        </Card>

        {/* Attestation Status */}
        {isAttested && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-emerald-800">
                <svg
                  className="h-5 w-5"
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
                CIRISVerify Attestation Passed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-emerald-900">
              <p>
                This agent submitted a cryptographic attestation that was
                verified by the portal. Here is what was checked:
              </p>
              <ul className="list-inside list-disc space-y-1 text-emerald-800">
                <li>
                  <strong>Challenge-response</strong> &mdash; The agent signed a
                  one-time nonce issued by Portal, proving it holds a valid
                  signing key
                </li>
                <li>
                  <strong>Classical signature (Ed25519)</strong> &mdash;
                  Cryptographic signature verified against the agent&apos;s
                  public key
                </li>
                <li>
                  <strong>Agent integrity</strong> &mdash; CIRISVerify confirmed
                  the agent binary has not been tampered with
                </li>
                {deviceData?.hardware_type &&
                  deviceData.hardware_type !== 'SOFTWARE_ONLY' && (
                    <li>
                      <strong>Hardware binding</strong> &mdash; Key is bound to
                      a{' '}
                      {deviceData.hardware_type
                        .replace(/_/g, ' ')
                        .toLowerCase()}{' '}
                      hardware root of trust
                    </li>
                  )}
              </ul>
              {deviceData?.hardware_type && (
                <p className="text-xs text-emerald-700">
                  Hardware type:{' '}
                  <span className="font-mono">{deviceData.hardware_type}</span>
                </p>
              )}
              <p className="rounded-lg bg-white/50 p-3 text-emerald-800">
                Because attestation passed, this agent is confirmed as a{' '}
                <strong>CIRIS framework agent</strong>. You may register it as a
                CIRIS Agent or as a Non-CIRIS Agent.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Register Your Agent */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {isAttested
                ? 'Register Your Agent'
                : 'Non-CIRIS Agent Registration'}
            </CardTitle>
            <CardDescription>
              {isAttested
                ? 'Attestation verified. Choose how to register this agent.'
                : 'No CIRISVerify attestation was provided. This agent will be registered as a third-party (Non-CIRIS) agent.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-3 ${isAttested ? 'sm:grid-cols-2' : ''}`}>
              {/* CIRIS Agent option: only shown when attestation passed */}
              {isAttested && (
                <button
                  data-testid="btn-agent-ciris"
                  onClick={() => {
                    setAgentCategory('ciris');
                    setSelectedTemplate(null);
                  }}
                  className={`rounded-lg border p-4 text-left transition-all ${
                    agentCategory === 'ciris'
                      ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-emerald-600"
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
                    <span className="font-semibold text-gray-900">
                      CIRIS Agent
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-700">
                      Verified
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    Built on the CIRIS framework with native accord compliance,
                    stewardship tiers, and WBD routing.
                  </p>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-lg font-bold text-gray-900">
                      $1.50
                    </span>
                    <span className="text-xs text-gray-500">per identity</span>
                  </div>
                </button>
              )}

              <button
                data-testid="btn-agent-nonciris"
                onClick={() => {
                  setAgentCategory('non_ciris');
                  setSelectedTemplate(null);
                }}
                className={`rounded-lg border p-4 text-left transition-all ${
                  agentCategory === 'non_ciris'
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="h-5 w-5 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  <span className="font-semibold text-gray-900">
                    Non-CIRIS Agent
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  Third-party agent using the CIRIS identity system for
                  verification and registry listing.
                </p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-lg font-bold text-gray-900">$1.50</span>
                  <span className="text-xs text-gray-500">per identity</span>
                </div>
              </button>
            </div>
            <p className="mt-3 text-xs text-gray-400">
              $0.50 issuance fee (non-refundable) + $1.00 identity bond
              (forfeited on revocation). Up to 5 concurrent identities.
            </p>
          </CardContent>
        </Card>

        {/* Step 2: Template Selection — shown only when multiple templates match */}
        {agentCategory && filteredTemplates.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Select Identity Template
              </CardTitle>
              <CardDescription>
                Choose an identity template for this agent. Available templates
                are based on your organization&apos;s access level.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {filteredTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={`rounded-lg border p-4 text-left transition-all ${
                      selectedTemplate === tpl.id
                        ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {tpl.label}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {tpl.id}
                        </Badge>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {tierLabel(tpl.tier)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {tpl.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tpl.actions.map((a) => (
                        <span
                          key={a}
                          className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Auto-selected template confirmation (single match) */}
        {agentCategory &&
          filteredTemplates.length === 1 &&
          selectedTemplate && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm text-emerald-600">
                    &#10003;
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Template: {filteredTemplates[0].label}
                    </p>
                    <p className="text-xs text-gray-500">
                      {filteredTemplates[0].description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        {/* Adapters: community tier uses template defaults (no selection) */}

        {/* Step 4: Pricing Summary + Checkout */}
        {selectedTemplate && agentCategory && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Summary</CardTitle>
              <CardDescription>
                Each agent identity requires a one-time activation payment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 rounded-lg border border-gray-200 p-4">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Identity issuance fee</span>
                  <span>$0.50</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>
                    Identity bond{' '}
                    <span className="text-xs text-gray-400">
                      (forfeited on revocation)
                    </span>
                  </span>
                  <span>$1.00</span>
                </div>
                <div className="border-t border-gray-200 pt-2">
                  <div className="flex justify-between font-semibold text-gray-900">
                    <span>Total</span>
                    <span>$1.50</span>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                <p className="mb-1 font-bold uppercase text-gray-600">
                  COMMUNITY TIER &mdash; PROVIDED &ldquo;AS IS&rdquo;
                </p>
                <p>
                  No warranty, no SLA, no liability coverage. The identity bond
                  is forfeited if the identity is revoked. See the{' '}
                  <a href="/activate" className="underline">
                    full terms
                  </a>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Confirm / Pay */}
        <CardFooter className="flex justify-end gap-3 px-0">
          <button
            data-testid="btn-register-pay"
            onClick={handleCheckout}
            disabled={!selectedTemplate || !agentCategory || submitting}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? 'Redirecting to checkout...'
              : `Register & Pay \u2014 $1.50`}
          </button>
        </CardFooter>
      </div>
    </CenterLayout>
  );
}

function CenterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-4">
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
  );
}

export default function DevicePage() {
  return (
    <Suspense
      fallback={
        <CenterLayout>
          <Spinner />
        </CenterLayout>
      }
    >
      <DeviceAuthFlow />
    </Suspense>
  );
}
