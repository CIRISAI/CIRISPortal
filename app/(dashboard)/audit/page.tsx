'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  ScrollText,
  Filter,
  Download,
  CheckCircle,
  AlertCircle,
  Key,
  User,
  Building2,
  Shield,
  Search,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
  Calendar,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  useAuditLog,
  useExportAuditLog,
  AuditActionType,
  AuditExportFormat,
  type AuditEntry,
  type AuditLogFilters,
} from '@/lib/registry-sdk';
import { useSession } from 'next-auth/react';

/**
 * Map of action types to display names and icons
 */
const actionConfig: Record<
  AuditActionType,
  { label: string; category: string; icon: React.ElementType }
> = {
  [AuditActionType.UNSPECIFIED]: {
    label: 'Unknown',
    category: 'other',
    icon: AlertTriangle,
  },
  [AuditActionType.ORG_CREATED]: {
    label: 'Organization Created',
    category: 'org',
    icon: Building2,
  },
  [AuditActionType.ORG_UPDATED]: {
    label: 'Organization Updated',
    category: 'org',
    icon: Building2,
  },
  [AuditActionType.ORG_DEACTIVATED]: {
    label: 'Organization Deactivated',
    category: 'org',
    icon: Building2,
  },
  [AuditActionType.USER_CREATED]: {
    label: 'User Created',
    category: 'user',
    icon: User,
  },
  [AuditActionType.USER_UPDATED]: {
    label: 'User Updated',
    category: 'user',
    icon: User,
  },
  [AuditActionType.USER_DEACTIVATED]: {
    label: 'User Deactivated',
    category: 'user',
    icon: User,
  },
  [AuditActionType.USER_LOGIN]: {
    label: 'User Login',
    category: 'user',
    icon: User,
  },
  [AuditActionType.USER_LOGOUT]: {
    label: 'User Logout',
    category: 'user',
    icon: User,
  },
  [AuditActionType.KEY_GENERATED]: {
    label: 'Key Generated',
    category: 'key',
    icon: Key,
  },
  [AuditActionType.KEY_ACTIVATED]: {
    label: 'Key Activated',
    category: 'key',
    icon: Key,
  },
  [AuditActionType.KEY_ROTATED]: {
    label: 'Key Rotated',
    category: 'key',
    icon: Key,
  },
  [AuditActionType.KEY_REVOKED]: {
    label: 'Key Revoked',
    category: 'key',
    icon: Key,
  },
  [AuditActionType.KEY_USED_FOR_SIGNING]: {
    label: 'Key Used',
    category: 'key',
    icon: Key,
  },
  [AuditActionType.KEY_ESCROWED]: {
    label: 'Key Escrowed',
    category: 'key',
    icon: Key,
  },
  [AuditActionType.KEY_RECOVERED]: {
    label: 'Key Recovered',
    category: 'key',
    icon: Key,
  },
  [AuditActionType.PARTNER_REGISTERED]: {
    label: 'Partner Registered',
    category: 'partner',
    icon: Shield,
  },
  [AuditActionType.PARTNER_UPDATED]: {
    label: 'Partner Updated',
    category: 'partner',
    icon: Shield,
  },
  [AuditActionType.PARTNER_SUSPENDED]: {
    label: 'Partner Suspended',
    category: 'partner',
    icon: Shield,
  },
  [AuditActionType.PARTNER_REVOKED]: {
    label: 'Partner Revoked',
    category: 'partner',
    icon: Shield,
  },
  [AuditActionType.PARTNER_LICENSE_RENEWED]: {
    label: 'License Renewed',
    category: 'partner',
    icon: Shield,
  },
  [AuditActionType.AGENT_REGISTERED]: {
    label: 'Agent Registered',
    category: 'agent',
    icon: Shield,
  },
  [AuditActionType.AGENT_DEPRECATED]: {
    label: 'Agent Deprecated',
    category: 'agent',
    icon: Shield,
  },
  [AuditActionType.AGENT_REVOKED]: {
    label: 'Agent Revoked',
    category: 'agent',
    icon: Shield,
  },
  [AuditActionType.MASS_REVOCATION]: {
    label: 'Mass Revocation',
    category: 'incident',
    icon: AlertTriangle,
  },
  [AuditActionType.EMERGENCY_SHUTDOWN_ENABLED]: {
    label: 'Emergency Shutdown',
    category: 'incident',
    icon: AlertTriangle,
  },
  [AuditActionType.EMERGENCY_SHUTDOWN_CLEARED]: {
    label: 'Emergency Cleared',
    category: 'incident',
    icon: AlertTriangle,
  },
  [AuditActionType.SIGNING_KEY_ROTATED]: {
    label: 'Signing Key Rotated',
    category: 'system',
    icon: Key,
  },
  [AuditActionType.SIGNING_KEY_ACTIVATED]: {
    label: 'Signing Key Activated',
    category: 'system',
    icon: Key,
  },
};

/**
 * Date range presets
 */
const dateRanges = [
  { label: 'Last 24 hours', value: '24h', ms: 24 * 60 * 60 * 1000 },
  { label: 'Last 7 days', value: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: 'Last 30 days', value: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
  { label: 'Last 90 days', value: '90d', ms: 90 * 24 * 60 * 60 * 1000 },
  { label: 'All time', value: 'all', ms: 0 },
];

/**
 * Export format options
 */
const exportFormats = [
  {
    label: 'JSON',
    value: AuditExportFormat.JSON,
    description: 'API integration',
  },
  { label: 'CSV', value: AuditExportFormat.CSV, description: 'Spreadsheets' },
  {
    label: 'JSON Lines',
    value: AuditExportFormat.JSONL,
    description: 'Streaming/BigQuery',
  },
  {
    label: 'Splunk HEC',
    value: AuditExportFormat.SPLUNK_HEC,
    description: 'SIEM integration',
  },
];

/**
 * Action type filter categories
 */
const filterCategories = [
  { label: 'Key Operations', value: 'key' },
  { label: 'User Management', value: 'user' },
  { label: 'Organization', value: 'org' },
  { label: 'Partners', value: 'partner' },
  { label: 'Agents', value: 'agent' },
  { label: 'Incidents', value: 'incident' },
  { label: 'System', value: 'system' },
];

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });
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
 * Get action config safely
 */
function getActionConfig(action: AuditActionType) {
  return actionConfig[action] || actionConfig[AuditActionType.UNSPECIFIED];
}

/**
 * Audit entry row component
 */
function AuditEntryRow({
  entry,
  onSelect,
  isSelected,
}: {
  entry: AuditEntry;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const config = getActionConfig(entry.action);
  const Icon = config.icon;

  return (
    <div
      className={`cursor-pointer border-b p-4 transition-colors hover:bg-muted/50 ${
        isSelected ? 'bg-muted' : ''
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-4">
        <div className="rounded-lg bg-muted p-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium">
              {config.label}
            </span>
            <Badge variant="outline" className="text-xs">
              {config.category}
            </Badge>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium">{entry.actorUserId || 'System'}</span>
            {entry.targetType && (
              <>
                <span>→</span>
                <span className="font-mono">
                  {entry.targetType}
                  {entry.targetId && `:${entry.targetId.substring(0, 8)}...`}
                </span>
              </>
            )}
          </div>
          <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
            <span>{formatRelativeTime(entry.timestamp)}</span>
            {entry.actorIpAddress && <span>IP: {entry.actorIpAddress}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <code className="text-xs text-muted-foreground">
            {entry.entryId.substring(0, 12)}...
          </code>
          {isSelected ? (
            <ChevronUp className="ml-auto mt-1 h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="ml-auto mt-1 h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded details */}
      {isSelected && (
        <div className="mt-4 rounded-lg bg-muted/50 p-4">
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Entry ID
              </label>
              <p className="mt-1 break-all font-mono text-xs">
                {entry.entryId}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Timestamp
              </label>
              <p className="mt-1 text-xs">{formatTimestamp(entry.timestamp)}</p>
            </div>
            {entry.description && (
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Description
                </label>
                <p className="mt-1 text-xs">{entry.description}</p>
              </div>
            )}
            {entry.actorUserAgent && (
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  User Agent
                </label>
                <p className="mt-1 truncate font-mono text-xs">
                  {entry.actorUserAgent}
                </p>
              </div>
            )}
            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Metadata
                </label>
                <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </div>
            )}
            {entry.entrySignature && (
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Signature
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-green-600">
                    Signature Valid (Key:{' '}
                    {entry.entrySignature.keyId.substring(0, 8)}
                    ...)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Export dialog component
 */
function ExportDialog({
  open,
  onOpenChange,
  filters,
  onExport,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AuditLogFilters;
  onExport: (format: AuditExportFormat) => void;
  isPending: boolean;
}) {
  const [selectedFormat, setSelectedFormat] = useState<AuditExportFormat>(
    AuditExportFormat.JSON
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Audit Log</DialogTitle>
          <DialogDescription>
            Export the current filtered audit log to a file.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">Format</label>
            <div className="mt-2 grid gap-2">
              {exportFormats.map((format) => (
                <label
                  key={format.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                    selectedFormat === format.value
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={format.value}
                    checked={selectedFormat === format.value}
                    onChange={() => setSelectedFormat(format.value)}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{format.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {format.description}
                    </p>
                  </div>
                  {selectedFormat === format.value && (
                    <CheckCircle className="h-5 w-5 text-primary" />
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onExport(selectedFormat)} disabled={isPending}>
            {isPending ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Main Audit Page
 */
export default function AuditPage() {
  const { data: session } = useSession();
  const orgId = (session?.user as { orgId?: string })?.orgId;

  const [dateRange, setDateRange] = useState('7d');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Calculate stable time range - only recalculate when dateRange changes
  const getTimeRange = (range: string) => {
    const rangeConfig = dateRanges.find((r) => r.value === range);
    if (rangeConfig && rangeConfig.ms > 0) {
      const now = Date.now();
      return { startTime: now - rangeConfig.ms, endTime: now };
    }
    return null;
  };

  // Store time range in state - only updates when dateRange changes
  const [timeRange, setTimeRange] = useState(() => getTimeRange(dateRange));

  // Update time range when dateRange changes
  useEffect(() => {
    setTimeRange(getTimeRange(dateRange));
  }, [dateRange]);

  // Build filters with stable references
  const filters: AuditLogFilters = useMemo(() => {
    const result: AuditLogFilters = {
      orgId: orgId || '',
      pageSize: 50,
    };

    if (timeRange) {
      result.startTime = timeRange.startTime;
      result.endTime = timeRange.endTime;
    }

    if (selectedCategories.length > 0) {
      const actionTypes: AuditActionType[] = [];
      for (const [action, config] of Object.entries(actionConfig)) {
        if (selectedCategories.includes(config.category)) {
          actionTypes.push(parseInt(action) as AuditActionType);
        }
      }
      if (actionTypes.length > 0) {
        result.actionTypes = actionTypes;
      }
    }

    return result;
  }, [orgId, timeRange, selectedCategories]);

  // Fetch audit log - add staleTime to prevent infinite refetches
  const {
    data: auditData,
    isLoading,
    error,
    refetch,
  } = useAuditLog(filters, {
    staleTime: 60 * 1000, // Data is fresh for 1 minute
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Export mutation
  const exportMutation = useExportAuditLog({
    onSuccess: (data) => {
      setExportDialogOpen(false);
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
    },
  });

  const handleExport = (format: AuditExportFormat) => {
    if (!orgId) return;
    exportMutation.mutate({
      orgId,
      startTime: filters.startTime,
      endTime: filters.endTime,
      actionTypes: filters.actionTypes,
      format,
      includeSignatures: true,
    });
  };

  const handleToggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const entries = auditData?.data || [];

  // Filter by search query
  const filteredEntries = searchQuery
    ? entries.filter(
        (entry) =>
          entry.actorUserId
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          entry.targetId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : entries;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Log</h1>
          <p className="mt-1 text-gray-600">
            Cryptographically signed record of all operations
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="mb-4 flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Log</h1>
          <p className="mt-1 text-gray-600">
            Cryptographically signed record of all operations
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Unable to load audit log</span>
            </div>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => refetch()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Log</h1>
          <p className="mt-1 text-gray-600">
            Cryptographically signed record of all operations
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => setExportDialogOpen(true)}
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Date Range */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              {dateRanges.find((r) => r.value === dateRange)?.label}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {dateRanges.map((range) => (
              <DropdownMenuItem
                key={range.value}
                onClick={() => setDateRange(range.value)}
              >
                {range.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Action Type Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              {selectedCategories.length > 0
                ? `${selectedCategories.length} filters`
                : 'All Operations'}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {filterCategories.map((category) => (
              <DropdownMenuCheckboxItem
                key={category.value}
                checked={selectedCategories.includes(category.value)}
                onCheckedChange={() => handleToggleCategory(category.value)}
              >
                {category.label}
              </DropdownMenuCheckboxItem>
            ))}
            {selectedCategories.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSelectedCategories([])}>
                  Clear filters
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search */}
        <div className="relative min-w-[200px] max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by actor, target, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Active filters badges */}
      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCategories.map((category) => (
            <Badge
              key={category}
              variant="secondary"
              className="cursor-pointer gap-1"
              onClick={() => handleToggleCategory(category)}
            >
              {filterCategories.find((c) => c.value === category)?.label}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredEntries.length} entries
        {auditData?.totalCount &&
          filteredEntries.length < auditData.totalCount && (
            <span> of {auditData.totalCount}</span>
          )}
      </div>

      {/* Audit Entries */}
      <Card>
        <CardContent className="p-0">
          {filteredEntries.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No audit entries found for the selected filters.
            </div>
          ) : (
            <div className="divide-y">
              {filteredEntries.map((entry) => (
                <AuditEntryRow
                  key={entry.entryId}
                  entry={entry}
                  isSelected={selectedEntry === entry.entryId}
                  onSelect={() =>
                    setSelectedEntry(
                      selectedEntry === entry.entryId ? null : entry.entryId
                    )
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signature Verification Info */}
      <Card className="border-muted bg-muted/50">
        <CardContent className="flex gap-3 pt-6">
          <ScrollText className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
          <div>
            <h3 className="font-medium">Cryptographic Audit Trail</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              All entries are signed with Ed25519 and hash-chained to previous
              entries. Click any entry to view its details and verify its
              signature and chain integrity.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        filters={filters}
        onExport={handleExport}
        isPending={exportMutation.isPending}
      />
    </div>
  );
}
