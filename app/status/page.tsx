'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Database,
  Server,
  Shield,
  Clock,
  Activity,
} from 'lucide-react';

interface HealthData {
  health?: {
    status: string;
    readiness: string;
    version: string;
    buildCommit: string;
    uptimeSeconds: string;
    databaseHealthy: boolean;
    replicationLagMs: string;
    activeConnections: number;
    context?: {
      serverVersion: string;
      environment: string;
    };
  };
  emergency?: {
    isLocked: boolean;
    severity?: string;
    message?: string;
    lockedAt?: string;
    lockedUntil?: string;
  };
  capabilities?: {
    protocolVersion: string;
    supportsMerkleProofs: boolean;
    supportsOfflineMode: boolean;
    supportsBatchOperations: boolean;
    supportsWebhooks: boolean;
    supportsBuildAttestation: boolean;
    supportedAlgorithms: string[];
  };
}

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'HEALTH_SERVING':
    case 'READINESS_LIVE':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'HEALTH_NOT_SERVING':
    case 'READINESS_NOT_LIVE':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  }
};

const StatusBadge = ({ status }: { status: string }) => {
  const isHealthy = status === 'HEALTH_SERVING' || status === 'READINESS_LIVE';
  return (
    <Badge
      variant={isHealthy ? 'default' : 'destructive'}
      className={isHealthy ? 'bg-green-500' : ''}
    >
      {isHealthy ? 'Operational' : 'Degraded'}
    </Badge>
  );
};

const formatUptime = (seconds: string) => {
  const secs = parseInt(seconds) || 0;
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const mins = Math.floor((secs % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

export default function StatusPage() {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const { data, isLoading, error, refetch } = useQuery<HealthData>({
    queryKey: ['status'],
    queryFn: async () => {
      const response = await fetch('/api/registry/status?type=all');
      if (!response.ok) throw new Error('Failed to fetch status');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  useEffect(() => {
    if (data) {
      setLastUpdate(new Date());
    }
  }, [data]);

  const health = data?.health;
  const emergency = data?.emergency;
  const capabilities = data?.capabilities;

  const isHealthy = health?.status === 'HEALTH_SERVING';
  const isEmergency = emergency?.isLocked;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Emergency Banner */}
      {isEmergency && (
        <div className="bg-red-600 px-4 py-3 text-white">
          <div className="mx-auto flex max-w-4xl items-center gap-3">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <strong>Emergency Mode Active</strong>
              {emergency?.message && (
                <span className="ml-2">- {emergency.message}</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">CIRIS Registry Status</h1>
            <p className="text-muted-foreground">
              Real-time system health and status information
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
            <button
              onClick={() => refetch()}
              className="rounded-lg p-2 transition-colors hover:bg-gray-200"
              aria-label="Refresh status"
            >
              <RefreshCw
                className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-8 text-center">
              <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
              <h2 className="text-xl font-semibold text-red-700">
                Unable to Connect
              </h2>
              <p className="mt-2 text-red-600">
                Could not fetch status from the registry server.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Overall Status */}
            <Card className={isHealthy ? 'border-green-200' : 'border-red-200'}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon status={health?.status || ''} />
                    <div>
                      <CardTitle>
                        {isHealthy
                          ? 'All Systems Operational'
                          : 'Service Degraded'}
                      </CardTitle>
                      <CardDescription>
                        Registry v
                        {capabilities?.protocolVersion ||
                          health?.version ||
                          '1.1.0'}
                      </CardDescription>
                    </div>
                  </div>
                  <StatusBadge status={health?.status || ''} />
                </div>
              </CardHeader>
            </Card>

            {/* Component Status */}
            <Card>
              <CardHeader>
                <CardTitle>Component Status</CardTitle>
                <CardDescription>
                  Health of individual system components
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* API Server */}
                  <div className="flex items-center justify-between border-b py-3">
                    <div className="flex items-center gap-3">
                      <Server className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">API Server</div>
                        <div className="text-sm text-muted-foreground">
                          gRPC + HTTP Gateway
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusIcon status={health?.status || ''} />
                      <StatusBadge status={health?.status || ''} />
                    </div>
                  </div>

                  {/* Database */}
                  <div className="flex items-center justify-between border-b py-3">
                    <div className="flex items-center gap-3">
                      <Database className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Database</div>
                        <div className="text-sm text-muted-foreground">
                          PostgreSQL
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusIcon
                        status={
                          health?.databaseHealthy
                            ? 'HEALTH_SERVING'
                            : 'HEALTH_NOT_SERVING'
                        }
                      />
                      <Badge
                        variant={
                          health?.databaseHealthy ? 'default' : 'destructive'
                        }
                        className={
                          health?.databaseHealthy ? 'bg-green-500' : ''
                        }
                      >
                        {health?.databaseHealthy ? 'Connected' : 'Disconnected'}
                      </Badge>
                    </div>
                  </div>

                  {/* Cryptography */}
                  <div className="flex items-center justify-between border-b py-3">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Cryptography</div>
                        <div className="text-sm text-muted-foreground">
                          {capabilities?.supportedAlgorithms?.join(', ') ||
                            'Ed25519, ML-DSA-65'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <Badge variant="default" className="bg-green-500">
                        Active
                      </Badge>
                    </div>
                  </div>

                  {/* Readiness */}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Activity className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Readiness</div>
                        <div className="text-sm text-muted-foreground">
                          Traffic acceptance status
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusIcon status={health?.readiness || ''} />
                      <Badge
                        variant={
                          health?.readiness === 'READINESS_LIVE'
                            ? 'default'
                            : 'secondary'
                        }
                        className={
                          health?.readiness === 'READINESS_LIVE'
                            ? 'bg-green-500'
                            : ''
                        }
                      >
                        {health?.readiness === 'READINESS_LIVE'
                          ? 'Live'
                          : 'Not Ready'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Metrics */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">
                      {formatUptime(health?.uptimeSeconds || '0')}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Connections
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {health?.activeConnections || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Replication Lag
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {health?.replicationLagMs || 0}ms
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Capabilities */}
            <Card>
              <CardHeader>
                <CardTitle>Registry Capabilities</CardTitle>
                <CardDescription>
                  Supported features and protocols
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {capabilities?.supportsMerkleProofs && (
                    <Badge variant="secondary">Merkle Proofs</Badge>
                  )}
                  {capabilities?.supportsOfflineMode && (
                    <Badge variant="secondary">Offline Verification</Badge>
                  )}
                  {capabilities?.supportsBatchOperations && (
                    <Badge variant="secondary">Batch Operations</Badge>
                  )}
                  {capabilities?.supportsWebhooks && (
                    <Badge variant="secondary">Webhooks</Badge>
                  )}
                  {capabilities?.supportsBuildAttestation && (
                    <Badge variant="secondary">Build Attestation</Badge>
                  )}
                  <Badge variant="outline">
                    Protocol v{capabilities?.protocolVersion || '1.1.0'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Version Info */}
            <div className="text-center text-sm text-muted-foreground">
              <p>
                Server: {health?.context?.serverVersion || 'registry-v1.1.0'} |
                Environment:{' '}
                {health?.context?.environment?.replace('ENV_', '') ||
                  'Development'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
