'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Info,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface AgentRecord {
  agentHash: string;
  agentType: string;
  version: {
    major: number;
    minor: number;
    patch: number;
  };
  status: string;
  capabilities: string[];
  registeredAt: string;
  hasAttestation: boolean;
}

interface LookupResponse {
  agent?: AgentRecord;
  found: boolean;
  context?: {
    serverVersion: string;
  };
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  AGENT_STATUS_REGISTERED: {
    label: 'Registered',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: CheckCircle2,
  },
  AGENT_STATUS_DEPRECATED: {
    label: 'Deprecated',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: AlertTriangle,
  },
  AGENT_STATUS_REVOKED: {
    label: 'Revoked',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: XCircle,
  },
};

const AGENT_TYPES: Record<string, string> = {
  AGENT_TYPE_CIRIS_CORE: 'CIRIS Core',
  AGENT_TYPE_CIRIS_LITE: 'CIRIS Lite',
  AGENT_TYPE_PARTNER: 'Partner Agent',
  AGENT_TYPE_CUSTOM: 'Custom Agent',
};

function formatVersion(version?: {
  major: number;
  minor: number;
  patch: number;
}) {
  if (!version) return '-';
  return `v${version.major}.${version.minor}.${version.patch}`;
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || {
    label: status.replace('AGENT_STATUS_', ''),
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    icon: Info,
  };
  const Icon = config.icon;

  return (
    <Badge
      className={`${config.bgColor} ${config.color} gap-1`}
      variant="outline"
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export default function VerifyPage() {
  const [agentHash, setAgentHash] = useState('');
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookupMutation = useMutation({
    mutationFn: async (hash: string): Promise<LookupResponse> => {
      const response = await fetch(
        `/api/registry/lookup?agent_hash=${encodeURIComponent(hash)}`
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Lookup failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
    },
    onError: (err: Error) => {
      setResult(null);
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate input
    const cleanHash = agentHash.trim();
    if (!cleanHash) {
      setError('Please enter an agent hash');
      return;
    }

    // Check format: 64-char hex or 44-char base64
    const isHex = /^[a-fA-F0-9]{64}$/.test(cleanHash);
    const isBase64 = /^[A-Za-z0-9+/]{43}=?$/.test(cleanHash);

    if (!isHex && !isBase64) {
      setError(
        'Invalid hash format. Expected 64-character hex or 44-character base64.'
      );
      return;
    }

    lookupMutation.mutate(cleanHash);
  };

  const agent = result?.agent;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-emerald-100 p-3">
            <Shield className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            CIRIS Agent Verification
          </h1>
          <p className="mt-2 text-gray-600">
            Verify the authenticity and registration status of any CIRIS agent
          </p>
        </div>

        {/* Search Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Lookup Agent
            </CardTitle>
            <CardDescription>
              Enter the agent hash to verify its registration status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="agent-hash">Agent Hash</Label>
                <Input
                  id="agent-hash"
                  placeholder="Enter 64-character hex or base64 hash"
                  value={agentHash}
                  onChange={(e) => setAgentHash(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Accepts SHA-256 hash in hex (64 chars) or base64 (44 chars)
                  format
                </p>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={lookupMutation.isPending}
              >
                {lookupMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Verify Agent
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardContent className="flex items-center gap-3 pt-6">
              <XCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
              <div>
                <p className="font-medium text-red-800">Verification Error</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Not Found Result */}
        {result && !result.found && (
          <Card className="mb-8 border-yellow-200 bg-yellow-50">
            <CardContent className="py-8 text-center">
              <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
              <h3 className="text-xl font-semibold text-yellow-800">
                Agent Not Registered
              </h3>
              <p className="mt-2 text-yellow-700">
                The provided hash does not match any registered agent in the
                CIRIS registry.
              </p>
              <div className="mt-4 rounded-lg bg-yellow-100 p-4 text-left text-sm">
                <p className="font-medium text-yellow-800">What this means:</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-yellow-700">
                  <li>The agent may not be officially registered</li>
                  <li>The hash may be incorrect or corrupted</li>
                  <li>The agent may be from an untrusted source</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Found Result */}
        {result && result.found && agent && (
          <Card className="mb-8 border-green-200">
            <CardHeader className="bg-green-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  <div>
                    <CardTitle className="text-green-800">
                      Agent Verified
                    </CardTitle>
                    <CardDescription className="text-green-600">
                      This agent is registered in the CIRIS registry
                    </CardDescription>
                  </div>
                </div>
                <StatusBadge status={agent.status} />
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Agent Details */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Agent Type
                    </p>
                    <p className="font-medium">
                      {AGENT_TYPES[agent.agentType] || agent.agentType}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Version
                    </p>
                    <p className="font-medium">
                      {formatVersion(agent.version)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Registered
                    </p>
                    <p className="font-medium">
                      {agent.registeredAt
                        ? new Date(
                            parseInt(agent.registeredAt) * 1000
                          ).toLocaleDateString()
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Build Attestation
                    </p>
                    <p className="font-medium">
                      {agent.hasAttestation ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          Verified
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Not available
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Agent Hash */}
                <div>
                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    Agent Hash
                  </p>
                  <div className="overflow-x-auto rounded-lg bg-muted p-3">
                    <code className="text-xs">{agent.agentHash}</code>
                  </div>
                </div>

                {/* Capabilities */}
                {agent.capabilities && agent.capabilities.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">
                      Capabilities
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {agent.capabilities.map((cap) => (
                        <Badge key={cap} variant="secondary">
                          {cap
                            .replace('CAP_', '')
                            .toLowerCase()
                            .replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warning for deprecated/revoked */}
                {agent.status === 'AGENT_STATUS_DEPRECATED' && (
                  <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
                    <div>
                      <p className="font-medium text-yellow-800">
                        This agent version is deprecated
                      </p>
                      <p className="text-sm text-yellow-700">
                        Consider upgrading to a newer version for continued
                        support.
                      </p>
                    </div>
                  </div>
                )}

                {agent.status === 'AGENT_STATUS_REVOKED' && (
                  <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                    <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                    <div>
                      <p className="font-medium text-red-800">
                        This agent has been revoked
                      </p>
                      <p className="text-sm text-red-700">
                        Do not use this agent. It may have security
                        vulnerabilities or compliance issues.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Info className="h-5 w-5" />
              About Agent Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              CIRIS agents are verified through cryptographic hashing. Each
              registered agent has a unique SHA-256 hash derived from its binary
              contents, ensuring integrity and authenticity.
            </p>
            <p>
              <strong className="text-foreground">Registered</strong> agents
              have been reviewed and approved for use within the CIRIS
              ecosystem.
            </p>
            <p>
              <strong className="text-foreground">Build Attestation</strong>{' '}
              provides additional verification that the agent was built from
              trusted source code using reproducible build processes.
            </p>
            <div className="pt-2">
              <a
                href="https://docs.ciris.ai/agents/verification"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-600 hover:underline"
              >
                Learn more about agent verification
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
