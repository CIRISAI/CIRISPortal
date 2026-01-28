'use client';

import { useState } from 'react';
import {
  Building2,
  Users,
  Key,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Activity,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useHealthCheck,
  useOrganization,
  useOrgKeys,
  usePartner,
  usePartnerActivity,
  useExpiringLicenses,
  useAuditLog,
  HealthStatus,
  KeyStatus,
  PartnerStatus,
  AuditActionType,
} from '@/lib/registry-sdk';
import { useSession } from 'next-auth/react';

/**
 * Compute health status from various data points
 */
function computeHealthStatus(data: {
  licenseStatus?: PartnerStatus;
  licenseExpiresAt?: number;
  keyStatus?: KeyStatus;
  daysSinceKeyRotation?: number;
  isActive?: boolean;
}): 'healthy' | 'warning' | 'critical' {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  // Critical conditions
  if (
    data.licenseStatus === PartnerStatus.SUSPENDED ||
    data.licenseStatus === PartnerStatus.REVOKED
  ) {
    return 'critical';
  }
  if (data.keyStatus === KeyStatus.REVOKED) {
    return 'critical';
  }
  if (data.licenseExpiresAt && data.licenseExpiresAt < now) {
    return 'critical';
  }

  // Warning conditions
  if (data.licenseExpiresAt && data.licenseExpiresAt - now < thirtyDaysMs) {
    return 'warning';
  }
  if (data.daysSinceKeyRotation && data.daysSinceKeyRotation > 90) {
    return 'warning';
  }
  if (data.keyStatus === KeyStatus.PENDING) {
    return 'warning';
  }

  return 'healthy';
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Format days remaining
 */
function formatDaysRemaining(expiresAt: number): string {
  const now = Date.now();
  const diff = expiresAt - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return 'Expired';
  if (days === 0) return 'Expires today';
  if (days === 1) return '1 day remaining';
  return `${days} days remaining`;
}

/**
 * Map audit action type to human-readable string
 */
function formatAuditAction(action: AuditActionType): string {
  const mapping: Record<AuditActionType, string> = {
    [AuditActionType.UNSPECIFIED]: 'Unknown',
    [AuditActionType.ORG_CREATED]: 'Organization Created',
    [AuditActionType.ORG_UPDATED]: 'Organization Updated',
    [AuditActionType.ORG_DEACTIVATED]: 'Organization Deactivated',
    [AuditActionType.USER_CREATED]: 'User Created',
    [AuditActionType.USER_UPDATED]: 'User Updated',
    [AuditActionType.USER_DEACTIVATED]: 'User Deactivated',
    [AuditActionType.USER_LOGIN]: 'User Login',
    [AuditActionType.USER_LOGOUT]: 'User Logout',
    [AuditActionType.KEY_GENERATED]: 'Key Generated',
    [AuditActionType.KEY_ACTIVATED]: 'Key Activated',
    [AuditActionType.KEY_ROTATED]: 'Key Rotated',
    [AuditActionType.KEY_REVOKED]: 'Key Revoked',
    [AuditActionType.KEY_USED_FOR_SIGNING]: 'Key Used',
    [AuditActionType.KEY_ESCROWED]: 'Key Escrowed',
    [AuditActionType.KEY_RECOVERED]: 'Key Recovered',
    [AuditActionType.PARTNER_REGISTERED]: 'Partner Registered',
    [AuditActionType.PARTNER_UPDATED]: 'Partner Updated',
    [AuditActionType.PARTNER_SUSPENDED]: 'Partner Suspended',
    [AuditActionType.PARTNER_REVOKED]: 'Partner Revoked',
    [AuditActionType.PARTNER_LICENSE_RENEWED]: 'License Renewed',
    [AuditActionType.AGENT_REGISTERED]: 'Agent Registered',
    [AuditActionType.AGENT_DEPRECATED]: 'Agent Deprecated',
    [AuditActionType.AGENT_REVOKED]: 'Agent Revoked',
    [AuditActionType.MASS_REVOCATION]: 'Mass Revocation',
    [AuditActionType.EMERGENCY_SHUTDOWN_ENABLED]: 'Emergency Shutdown',
    [AuditActionType.EMERGENCY_SHUTDOWN_CLEARED]: 'Emergency Cleared',
    [AuditActionType.SIGNING_KEY_ROTATED]: 'Signing Key Rotated',
    [AuditActionType.SIGNING_KEY_ACTIVATED]: 'Signing Key Activated',
  };
  return mapping[action] || 'Unknown Action';
}

/**
 * Status indicator component
 */
function StatusIndicator({
  status,
  size = 'default',
}: {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  size?: 'default' | 'large';
}) {
  const colors = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500',
    unknown: 'bg-gray-400',
  };

  const sizeClasses = {
    default: 'h-2 w-2',
    large: 'h-3 w-3',
  };

  return (
    <span
      className={`inline-block rounded-full ${colors[status]} ${sizeClasses[size]}`}
      aria-label={`Status: ${status}`}
    />
  );
}

/**
 * License Status Card
 */
function LicenseStatusCard({ orgId }: { orgId?: string }) {
  const { data: partner, isLoading, error } = usePartner(orgId || '');

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">License Status</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Skeleton className="mb-2 h-8 w-24" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (error || !partner) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">License Status</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-400">--</div>
          <p className="text-xs text-muted-foreground">Unable to load</p>
        </CardContent>
      </Card>
    );
  }

  const healthStatus = computeHealthStatus({
    licenseStatus: partner.status,
    licenseExpiresAt: partner.expiresAt,
  });

  const statusColors = {
    [PartnerStatus.ACTIVE]: 'text-green-600',
    [PartnerStatus.SUSPENDED]: 'text-red-600',
    [PartnerStatus.REVOKED]: 'text-red-600',
    [PartnerStatus.UNSPECIFIED]: 'text-gray-600',
  };

  const statusLabels = {
    [PartnerStatus.ACTIVE]: 'Active',
    [PartnerStatus.SUSPENDED]: 'Suspended',
    [PartnerStatus.REVOKED]: 'Revoked',
    [PartnerStatus.UNSPECIFIED]: 'Unknown',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">License Status</CardTitle>
        <div className="flex items-center gap-2">
          <StatusIndicator status={healthStatus} />
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${statusColors[partner.status]}`}>
          {statusLabels[partner.status]}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDaysRemaining(partner.expiresAt)}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Key Health Card
 */
function KeyHealthCard({ orgId }: { orgId?: string }) {
  const { data: keys, isLoading, error } = useOrgKeys({ orgId: orgId || '' });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Key Health</CardTitle>
          <Key className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Skeleton className="mb-2 h-8 w-16" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (error || !keys) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Key Health</CardTitle>
          <Key className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-400">--</div>
          <p className="text-xs text-muted-foreground">Unable to load</p>
        </CardContent>
      </Card>
    );
  }

  const activeKeys =
    keys.data?.filter((k) => k.status === KeyStatus.ACTIVE) || [];
  const pendingKeys =
    keys.data?.filter((k) => k.status === KeyStatus.PENDING) || [];
  const totalKeys = keys.data?.length || 0;

  // Calculate days since last rotation for active key
  const newestActiveKey = activeKeys.sort(
    (a, b) => (b.activatedAt || 0) - (a.activatedAt || 0)
  )[0];
  const daysSinceRotation = newestActiveKey?.activatedAt
    ? Math.floor(
        (Date.now() - newestActiveKey.activatedAt) / (1000 * 60 * 60 * 24)
      )
    : undefined;

  const healthStatus = computeHealthStatus({
    keyStatus: newestActiveKey?.status,
    daysSinceKeyRotation: daysSinceRotation,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Key Health</CardTitle>
        <div className="flex items-center gap-2">
          <StatusIndicator status={healthStatus} />
          <Key className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {activeKeys.length}/{totalKeys}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {pendingKeys.length > 0 && (
            <span className="text-yellow-600">
              {pendingKeys.length} pending
            </span>
          )}
          {daysSinceRotation !== undefined && (
            <span>Rotated {daysSinceRotation}d ago</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Registry Health Card
 */
function RegistryHealthCard() {
  const { data: health, isLoading, error, refetch } = useHealthCheck(true);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Registry Status</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Skeleton className="mb-2 h-8 w-20" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (error || !health) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Registry Status</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">Offline</div>
          <p className="text-xs text-muted-foreground">Unable to connect</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-6 px-2"
            onClick={() => refetch()}
          >
            <RefreshCw className="mr-1 h-3 w-3" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const statusText = {
    [HealthStatus.SERVING]: 'Healthy',
    [HealthStatus.DEGRADED]: 'Degraded',
    [HealthStatus.NOT_SERVING]: 'Offline',
    [HealthStatus.UNSPECIFIED]: 'Unknown',
  };

  const statusColor = {
    [HealthStatus.SERVING]: 'text-green-600',
    [HealthStatus.DEGRADED]: 'text-yellow-600',
    [HealthStatus.NOT_SERVING]: 'text-red-600',
    [HealthStatus.UNSPECIFIED]: 'text-gray-600',
  };

  const healthIndicator =
    health.status === HealthStatus.SERVING
      ? 'healthy'
      : health.status === HealthStatus.DEGRADED
        ? 'warning'
        : 'critical';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Registry Status</CardTitle>
        <div className="flex items-center gap-2">
          <StatusIndicator status={healthIndicator} />
          <Shield className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${statusColor[health.status]}`}>
          {statusText[health.status]}
        </div>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {health.version && <span>v{health.version}</span>}
          {health.databaseHealthy !== undefined && (
            <span className="flex items-center gap-1">
              Database:{' '}
              {health.databaseHealthy ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-red-500" />
              )}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Activity Summary Card
 */
function ActivitySummaryCard({ orgId }: { orgId?: string }) {
  const { data: activity, isLoading, error } = usePartnerActivity(orgId || '');

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Activity</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Skeleton className="mb-2 h-8 w-20" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (error || !activity) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Activity</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-400">--</div>
          <p className="text-xs text-muted-foreground">Unable to load</p>
        </CardContent>
      </Card>
    );
  }

  const healthIndicator =
    activity.healthStatus === 'HEALTHY'
      ? 'healthy'
      : activity.healthStatus === 'IDLE'
        ? 'warning'
        : activity.healthStatus === 'INACTIVE'
          ? 'critical'
          : 'unknown';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Activity</CardTitle>
        <div className="flex items-center gap-2">
          <StatusIndicator status={healthIndicator} />
          <Activity className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {activity.lookupsLast30Days || 0}
        </div>
        <p className="text-xs text-muted-foreground">Lookups in last 30 days</p>
        {activity.recommendations && (
          <p className="mt-2 text-xs text-blue-600">
            {activity.recommendations}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Expiration Alert Banner
 */
function ExpirationAlertBanner() {
  const { data: expiring, isLoading } = useExpiringLicenses({
    expiringWithinDays: 90,
    includeExpired: false,
  });

  if (isLoading || !expiring) {
    return null;
  }

  if (expiring.countExpiringSoon === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600" />
        <div>
          <h3 className="font-medium text-yellow-800">
            {expiring.countExpiringSoon} License
            {expiring.countExpiringSoon > 1 ? 's' : ''} Expiring Soon
          </h3>
          <p className="text-sm text-yellow-700">
            Review and renew licenses to maintain uninterrupted service.
          </p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto">
          View Details
        </Button>
      </div>
    </div>
  );
}

/**
 * Recent Activity List
 */
function RecentActivityList({ orgId }: { orgId?: string }) {
  const {
    data: auditLog,
    isLoading,
    error,
  } = useAuditLog({
    pageSize: 10,
    orgId: orgId || '',
  });

  if (isLoading) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-4">
                <Skeleton className="mt-2 h-2 w-2 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Unable to load activity</p>
        </CardContent>
      </Card>
    );
  }

  const entries = auditLog?.data || [];

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground">No recent activity</p>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <div
                key={entry.entryId}
                className="flex items-start gap-4 border-b pb-4 last:border-0 last:pb-0"
              >
                <div className="mt-2 h-2 w-2 rounded-full bg-emerald-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {formatAuditAction(entry.action)}
                  </p>
                  {entry.description && (
                    <p className="text-sm text-gray-600">{entry.description}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {formatRelativeTime(entry.timestamp)}
                  </p>
                </div>
                {entry.targetType && (
                  <Badge variant="outline" className="text-xs">
                    {entry.targetType}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Quick Links Card
 */
function QuickLinksCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Quick Links
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <a
            href="/organizations"
            className="block text-sm text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            → New Organization
          </a>
          <a
            href="/keys"
            className="block text-sm text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            → Manage Keys
          </a>
          <a
            href="/audit"
            className="block text-sm text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            → View Audit Log
          </a>
          <a
            href="/settings"
            className="block text-sm text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            → Settings
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Main Dashboard Page
 */
export default function DashboardPage() {
  const { data: session } = useSession();
  const orgId = (session?.user as { orgId?: string })?.orgId;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-gray-600">CIRIS Partner Portal overview</p>
      </div>

      {/* Expiration Alert Banner */}
      <ExpirationAlertBanner />

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <LicenseStatusCard orgId={orgId} />
        <KeyHealthCard orgId={orgId} />
        <RegistryHealthCard />
        <ActivitySummaryCard orgId={orgId} />
      </div>

      {/* Recent Activity and Quick Links */}
      <div className="grid gap-6 lg:grid-cols-3">
        <RecentActivityList orgId={orgId} />
        <QuickLinksCard />
      </div>
    </div>
  );
}
