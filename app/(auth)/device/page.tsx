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
import { Checkbox } from '@/components/ui/checkbox';
import type { AllowedTemplate } from '@/lib/device-auth/abac';

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
  const { data: session, status: sessionStatus } = useSession();

  const [deviceData, setDeviceData] = useState<DeviceLookupResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
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

  // Redirect to login if not authenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated' && code) {
      signIn(undefined, {
        callbackUrl: `/device?code=${encodeURIComponent(code)}`,
      });
    }
  }, [sessionStatus, code]);

  const handleComplete = async () => {
    if (!selectedTemplate || !code) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/device/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_code: code,
          template_id: selectedTemplate,
          adapters: selectedAdapters,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setCompleted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Provisioning failed');
    } finally {
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
              Enter the code displayed by your CIRISAgent setup wizard.
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

  // Loading device data
  if (loading) {
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
  if (error && !deviceData) {
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
              Agent Provisioned
            </CardTitle>
            <CardDescription>
              Your agent has been registered and a signing key has been issued.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-800">
                You can now return to your agent setup wizard. The agent will
                automatically receive its signing key and configuration.
              </p>
            </div>
            {selectedTemplate && (
              <div className="text-sm text-gray-600">
                <p>
                  <span className="font-medium">Template:</span>{' '}
                  {selectedTemplate}
                </p>
                <p>
                  <span className="font-medium">Adapters:</span>{' '}
                  {selectedAdapters.join(', ')}
                </p>
              </div>
            )}
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

        {/* Template Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Identity Template</CardTitle>
            <CardDescription>
              Choose an identity template for this agent. Available templates
              are based on your organization&apos;s access level.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {deviceData.allowed_templates.map((tpl) => (
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
            {deviceData.allowed_templates.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-500">
                No templates available for your organization.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Adapter Selection */}
        {selectedTemplate && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configure Adapters</CardTitle>
              <CardDescription>
                Select which adapters this agent should use. Defaults are
                pre-selected from the template.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {getAvailableAdapters(deviceData, selectedTemplate).map(
                  (adapter) => (
                    <label
                      key={adapter}
                      className="flex items-center gap-2 rounded-md border border-gray-100 px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={selectedAdapters.includes(adapter)}
                        onCheckedChange={(checked) => {
                          setSelectedAdapters((prev) =>
                            checked
                              ? [...prev, adapter]
                              : prev.filter((a) => a !== adapter)
                          );
                        }}
                      />
                      <span className="text-gray-700">{adapter}</span>
                    </label>
                  )
                )}
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

        {/* Confirm */}
        <CardFooter className="flex justify-end gap-3 px-0">
          <button
            onClick={handleComplete}
            disabled={!selectedTemplate || submitting}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Provisioning...' : 'Authorize Agent'}
          </button>
        </CardFooter>
      </div>
    </CenterLayout>
  );
}

/**
 * Get the union of template adapters + node-supported adapters for selection.
 */
function getAvailableAdapters(
  data: DeviceLookupResponse,
  templateId: string
): string[] {
  const tpl = data.allowed_templates.find((t) => t.id === templateId);
  if (!tpl) return [];

  const nodeCaps = data.node_manifest?.node_capabilities as
    | Record<string, unknown>
    | undefined;
  const nodeAdapters = (nodeCaps?.supported_adapters as string[]) || [];

  // Union of template adapters and node-supported adapters
  const all = new Set([...tpl.adapters, ...nodeAdapters]);
  return Array.from(all).sort();
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
