'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  ShieldAlert,
  XCircle,
  Lock,
  Unlock,
  Clock,
  Search,
  Download,
  Loader2,
  AlertOctagon,
  RefreshCw,
  CheckCircle2,
  Bot,
  Building2,
  Key,
} from 'lucide-react';
import { toast } from '@/lib/hooks/use-toast';

// Types
interface EmergencyStatus {
  isLocked: boolean;
  severity: string;
  reason: string;
  lockedAt: string;
  lockedBy: string;
  unlockAt: string | null;
  allowedOperations: string[];
}

interface RevocationEntry {
  id: string;
  targetType: 'AGENT' | 'PARTNER' | 'LICENSE';
  targetId: string;
  reason: string;
  reasonCode: string;
  severity: string;
  revokedAt: string;
  revokedBy: string;
}

// Constants
const SEVERITY_LEVELS = [
  {
    value: 'LOW',
    label: 'Low',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
  },
  {
    value: 'MEDIUM',
    label: 'Medium',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  {
    value: 'HIGH',
    label: 'High',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  {
    value: 'CRITICAL',
    label: 'Critical',
    color: 'text-red-800',
    bgColor: 'bg-red-200',
  },
];

const DURATION_OPTIONS = [
  { value: '3600', label: '1 hour' },
  { value: '14400', label: '4 hours' },
  { value: '86400', label: '24 hours' },
  { value: '259200', label: '72 hours' },
  { value: 'manual', label: 'Manual unlock required' },
];

const OPERATIONS = [
  { value: 'READ', label: 'Read operations' },
  { value: 'VERIFY', label: 'Agent verification' },
  { value: 'LOOKUP', label: 'Public lookups' },
];

const REASON_CODES = [
  { value: 'SECURITY_BREACH', label: 'Security Breach' },
  { value: 'VULNERABILITY', label: 'Vulnerability Discovered' },
  { value: 'COMPLIANCE', label: 'Compliance Issue' },
  { value: 'ABUSE', label: 'Policy Abuse' },
  { value: 'KEY_COMPROMISE', label: 'Key Compromise' },
  { value: 'OTHER', label: 'Other' },
];

// Error Display Component
function ErrorBanner({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-red-300 bg-red-50">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <AlertOctagon className="h-6 w-6 flex-shrink-0 text-red-600" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-800">API Error</h3>
            <p className="mt-1 whitespace-pre-wrap font-mono text-sm text-red-700">
              {error}
            </p>
            <p className="mt-2 text-xs text-red-600">
              Check browser console and server logs for details.
            </p>
          </div>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="border-red-300"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// API fetch functions
async function fetchEmergencyStatus(): Promise<EmergencyStatus> {
  console.log(
    '[Incidents] Fetching emergency status from /api/admin/emergency'
  );
  const response = await fetch('/api/admin/emergency');
  const data = await response.json();
  console.log('[Incidents] Emergency status response:', response.status, data);

  if (!response.ok) {
    throw new Error(
      data.error || `Failed to fetch emergency status: ${response.status}`
    );
  }

  return {
    isLocked: data.isLocked || false,
    severity: data.severity || '',
    reason: data.reason || '',
    lockedAt: data.lockedAt || '',
    lockedBy: data.lockedBy || '',
    unlockAt: data.unlockAt || null,
    allowedOperations: data.allowedOperations || [],
  };
}

async function fetchRevocations(params: {
  searchQuery?: string;
  typeFilter?: string;
  severityFilter?: string;
}): Promise<{ entries: RevocationEntry[]; totalCount: number }> {
  console.log('[Incidents] Fetching revocations from /api/admin/revoke');
  const response = await fetch('/api/admin/revoke');
  const data = await response.json();
  console.log('[Incidents] Revocations response:', response.status, data);

  if (!response.ok) {
    throw new Error(
      data.error || `Failed to fetch revocations: ${response.status}`
    );
  }

  // Map backend entries to our format
  let entries: RevocationEntry[] = (data.entries || []).map(
    (entry: any, index: number) => ({
      id: entry.id || `rev_${index}`,
      targetType: entry.targetType || 'AGENT',
      targetId: entry.targetId || entry.agentHash || entry.partnerId || '',
      reason: entry.reason || '',
      reasonCode: entry.reasonCode || 'OTHER',
      severity: entry.severity || 'MEDIUM',
      revokedAt:
        entry.revokedAt ||
        entry.timestamp ||
        String(Math.floor(Date.now() / 1000)),
      revokedBy: entry.revokedBy || 'system',
    })
  );

  // Apply client-side filters
  if (params.searchQuery) {
    const query = params.searchQuery.toLowerCase();
    entries = entries.filter(
      (r) =>
        r.targetId.toLowerCase().includes(query) ||
        r.reason.toLowerCase().includes(query)
    );
  }

  if (params.typeFilter && params.typeFilter !== 'all') {
    entries = entries.filter((r) => r.targetType === params.typeFilter);
  }

  if (params.severityFilter && params.severityFilter !== 'all') {
    entries = entries.filter((r) => r.severity === params.severityFilter);
  }

  return {
    entries,
    totalCount: entries.length,
  };
}

function SeverityBadge({ severity }: { severity: string }) {
  const config = SEVERITY_LEVELS.find((s) => s.value === severity) || {
    label: severity,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  };

  return (
    <Badge className={`${config.bgColor} ${config.color}`} variant="outline">
      {config.label}
    </Badge>
  );
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'AGENT':
      return <Bot className="h-4 w-4" />;
    case 'PARTNER':
      return <Building2 className="h-4 w-4" />;
    case 'LICENSE':
      return <Key className="h-4 w-4" />;
    default:
      return <XCircle className="h-4 w-4" />;
  }
}

// Emergency Shutdown Dialog
function EmergencyShutdownDialog({ isActive }: { isActive: boolean }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    severity: '',
    reason: '',
    duration: '',
    allowedOperations: [] as string[],
    confirmText: '',
  });
  const queryClient = useQueryClient();

  const shutdownMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/admin/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SET',
          severity: data.severity,
          reason: data.reason,
          duration: data.duration === 'manual' ? null : parseInt(data.duration),
          allowedOperations: data.allowedOperations,
        }),
      });
      if (!response.ok)
        throw new Error('Failed to activate emergency shutdown');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-status'] });
      toast({
        title: 'Success',
        description: 'Emergency shutdown activated',
        variant: 'success',
      });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CLEAR' }),
      });
      if (!response.ok) throw new Error('Failed to clear emergency shutdown');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-status'] });
      toast({
        title: 'Success',
        description: 'Emergency shutdown cleared',
        variant: 'success',
      });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleOperation = (op: string) => {
    setFormData((prev) => ({
      ...prev,
      allowedOperations: prev.allowedOperations.includes(op)
        ? prev.allowedOperations.filter((o) => o !== op)
        : [...prev.allowedOperations, op],
    }));
  };

  const requiresConfirm = formData.severity === 'CRITICAL';
  const confirmValid =
    !requiresConfirm || formData.confirmText === 'CONFIRM CRITICAL';
  const isFormValid =
    formData.severity && formData.reason && formData.duration && confirmValid;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isActive ? (
          <Button variant="outline" className="border-green-500 text-green-600">
            <Unlock className="mr-2 h-4 w-4" />
            Clear Emergency
          </Button>
        ) : (
          <Button variant="destructive">
            <Lock className="mr-2 h-4 w-4" />
            Activate Emergency Shutdown
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertOctagon className="h-5 w-5" />
            {isActive
              ? 'Clear Emergency Shutdown'
              : 'Activate Emergency Shutdown'}
          </DialogTitle>
          <DialogDescription>
            {isActive
              ? 'This will restore normal registry operations.'
              : 'This will restrict registry operations to protect against threats.'}
          </DialogDescription>
        </DialogHeader>

        {isActive ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">
                  Confirm Emergency Clear
                </p>
                <p className="text-sm text-yellow-700">
                  This will re-enable all registry operations. Ensure the
                  incident has been fully resolved.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {clearMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Unlock className="mr-2 h-4 w-4" />
                    Clear Emergency
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Severity Level</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(value) =>
                    setFormData({ ...formData, severity: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        <span className={level.color}>{level.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Duration</Label>
                <Select
                  value={formData.duration}
                  onValueChange={(value) =>
                    setFormData({ ...formData, duration: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <textarea
                className="h-24 w-full resize-none rounded-md border p-3 text-sm"
                placeholder="Describe the incident and reason for emergency shutdown..."
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Allowed Operations (Empty = Read-only)</Label>
              <div className="flex flex-wrap gap-2">
                {OPERATIONS.map((op) => (
                  <Badge
                    key={op.value}
                    variant={
                      formData.allowedOperations.includes(op.value)
                        ? 'default'
                        : 'outline'
                    }
                    className="cursor-pointer"
                    onClick={() => toggleOperation(op.value)}
                  >
                    {op.label}
                  </Badge>
                ))}
              </div>
            </div>

            {requiresConfirm && (
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4">
                <Label className="text-red-800">
                  Type &quot;CONFIRM CRITICAL&quot; to proceed
                </Label>
                <Input
                  placeholder="CONFIRM CRITICAL"
                  value={formData.confirmText}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmText: e.target.value })
                  }
                  className="font-mono"
                />
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => shutdownMutation.mutate(formData)}
                disabled={!isFormValid || shutdownMutation.isPending}
              >
                {shutdownMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Activating...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Activate Shutdown
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Helper to build mass revoke request body
function buildRevokeRequest(
  formData: {
    selectionMethod: string;
    input: string;
    reason: string;
    reasonCode: string;
    severity: string;
    incidentId: string;
  },
  isDryRun: boolean
) {
  const request: Record<string, unknown> = {
    reason: formData.reason,
    reasonCode: formData.reasonCode,
    severity: formData.severity,
    isDryRun,
  };

  switch (formData.selectionMethod) {
    case 'hashes':
      request.agentHashes = formData.input
        .split('\n')
        .map((h) => h.trim())
        .filter(Boolean);
      break;
    case 'partners':
      request.partnerIds = formData.input
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean);
      break;
    case 'version':
      request.versionPattern = formData.input.trim();
      break;
    case 'type':
      request.agentType = formData.input;
      break;
    default:
      break;
  }

  return request;
}

// Mass Revocation Dialog
function MassRevocationDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'input' | 'preview' | 'confirm'>('input');
  const [formData, setFormData] = useState({
    selectionMethod: '',
    input: '',
    reason: '',
    reasonCode: '',
    severity: '',
    incidentId: '',
  });
  const [previewData, setPreviewData] = useState<{
    count: number;
    breakdown: { type: string; count: number }[];
  } | null>(null);
  const queryClient = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: async () => {
      console.log('[MassRevoke] Running dry-run preview');
      const requestBody = buildRevokeRequest(formData, true);
      console.log('[MassRevoke] Preview request:', requestBody);

      const response = await fetch('/api/admin/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      console.log('[MassRevoke] Preview response:', response.status, data);

      if (!response.ok) {
        throw new Error(data.error || `Preview failed: ${response.status}`);
      }

      return {
        count: data.revokedCount || 0,
        breakdown: [
          { type: 'Agents', count: data.affectedAgents?.length || 0 },
          { type: 'Partners', count: data.affectedPartners?.length || 0 },
        ],
        affectedAgents: data.affectedAgents || [],
        affectedPartners: data.affectedPartners || [],
      };
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setStep('preview');
    },
    onError: (error: Error) => {
      console.error('[MassRevoke] Preview error:', error);
      toast({
        title: 'Preview Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      console.log('[MassRevoke] Executing revocation');
      const requestBody = buildRevokeRequest(formData, false);
      console.log('[MassRevoke] Revoke request:', requestBody);

      const response = await fetch('/api/admin/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      console.log('[MassRevoke] Revoke response:', response.status, data);

      if (!response.ok) {
        throw new Error(data.error || `Revocation failed: ${response.status}`);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['revocations'] });
      toast({
        title: 'Revocation Complete',
        description: `Revoked ${data.revokedCount || 0} entries. Audit log: ${data.auditLogId || 'N/A'}`,
        variant: 'success',
      });
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      console.error('[MassRevoke] Revoke error:', error);
      toast({
        title: 'Revocation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setStep('input');
    setFormData({
      selectionMethod: '',
      input: '',
      reason: '',
      reasonCode: '',
      severity: '',
      incidentId: '',
    });
    setPreviewData(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="border-red-500 text-red-600">
          <XCircle className="mr-2 h-4 w-4" />
          Mass Revocation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="h-5 w-5" />
            Mass Revocation Tool
          </DialogTitle>
          <DialogDescription>
            Revoke multiple agents, partners, or licenses at once
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Selection Method</Label>
              <Select
                value={formData.selectionMethod}
                onValueChange={(value) =>
                  setFormData({ ...formData, selectionMethod: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="How to select targets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hashes">By Agent Hashes</SelectItem>
                  <SelectItem value="partners">By Partner IDs</SelectItem>
                  <SelectItem value="version">By Version Pattern</SelectItem>
                  <SelectItem value="type">By Agent Type</SelectItem>
                  <SelectItem value="date">By Registration Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {formData.selectionMethod === 'hashes'
                  ? 'Agent Hashes (one per line)'
                  : formData.selectionMethod === 'partners'
                    ? 'Partner IDs (one per line)'
                    : formData.selectionMethod === 'version'
                      ? 'Version Pattern (e.g., 2.1.*)'
                      : formData.selectionMethod === 'type'
                        ? 'Agent Type'
                        : formData.selectionMethod === 'date'
                          ? 'Before Date'
                          : 'Selection Input'}
              </Label>
              {formData.selectionMethod === 'type' ? (
                <Select
                  value={formData.input}
                  onValueChange={(value) =>
                    setFormData({ ...formData, input: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select agent type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AGENT_TYPE_CIRIS_CORE">
                      CIRIS Core
                    </SelectItem>
                    <SelectItem value="AGENT_TYPE_CIRIS_LITE">
                      CIRIS Lite
                    </SelectItem>
                    <SelectItem value="AGENT_TYPE_PARTNER">
                      Partner Agent
                    </SelectItem>
                    <SelectItem value="AGENT_TYPE_CUSTOM">
                      Custom Agent
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : formData.selectionMethod === 'date' ? (
                <Input
                  type="date"
                  value={formData.input}
                  onChange={(e) =>
                    setFormData({ ...formData, input: e.target.value })
                  }
                />
              ) : (
                <textarea
                  className="h-24 w-full resize-none rounded-md border p-3 font-mono text-sm"
                  placeholder={
                    formData.selectionMethod === 'version'
                      ? 'e.g., 2.1.* or 1.*.*'
                      : 'Enter one per line...'
                  }
                  value={formData.input}
                  onChange={(e) =>
                    setFormData({ ...formData, input: e.target.value })
                  }
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Reason Code</Label>
                <Select
                  value={formData.reasonCode}
                  onValueChange={(value) =>
                    setFormData({ ...formData, reasonCode: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASON_CODES.map((code) => (
                      <SelectItem key={code.value} value={code.value}>
                        {code.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Severity</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(value) =>
                    setFormData({ ...formData, severity: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        <span className={level.color}>{level.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason Description</Label>
              <textarea
                className="h-20 w-full resize-none rounded-md border p-3 text-sm"
                placeholder="Detailed reason for this mass revocation..."
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => previewMutation.mutate()}
                disabled={
                  !formData.selectionMethod ||
                  !formData.input ||
                  !formData.reasonCode ||
                  previewMutation.isPending
                }
              >
                {previewMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Preview Impact'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'preview' && previewData && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold text-yellow-800">
                    {previewData.count} items will be revoked
                  </p>
                  <p className="text-yellow-700">
                    This action cannot be undone automatically
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Impact Breakdown</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {previewData.breakdown.map((item) => (
                  <div
                    key={item.type}
                    className="rounded-lg bg-muted p-3 text-center"
                  >
                    <p className="text-2xl font-bold">{item.count}</p>
                    <p className="text-sm text-muted-foreground">{item.type}</p>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('input')}>
                Back
              </Button>
              <Button variant="destructive" onClick={() => setStep('confirm')}>
                Continue to Confirm
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-600" />
                <div>
                  <p className="font-medium text-red-800">
                    Final Confirmation Required
                  </p>
                  <p className="mt-1 text-sm text-red-700">
                    Enter an incident ID to proceed with the revocation. This
                    will be logged in the audit trail.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Incident ID</Label>
              <Input
                placeholder="e.g., INC-2024-0042"
                value={formData.incidentId}
                onChange={(e) =>
                  setFormData({ ...formData, incidentId: e.target.value })
                }
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Enter the tracking ID for this security incident
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('preview')}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={() => revokeMutation.mutate()}
                disabled={!formData.incidentId || revokeMutation.isPending}
              >
                {revokeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Revoking...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Execute Revocation
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function IncidentResponsePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Real API queries
  const {
    data: emergencyStatus,
    isLoading: loadingStatus,
    error: emergencyError,
    refetch: refetchEmergency,
  } = useQuery<EmergencyStatus, Error>({
    queryKey: ['emergency-status'],
    queryFn: fetchEmergencyStatus,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const {
    data: revocations,
    isLoading: loadingRevocations,
    error: revocationsError,
    refetch,
  } = useQuery<{ entries: RevocationEntry[]; totalCount: number }, Error>({
    queryKey: ['revocations', searchQuery, typeFilter, severityFilter],
    queryFn: () =>
      fetchRevocations({
        searchQuery,
        typeFilter,
        severityFilter,
      }),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const isEmergencyActive = emergencyStatus?.isLocked || false;
  const allRevocations = revocations?.entries || [];

  return (
    <div className="space-y-6 p-6">
      {/* Emergency Banner */}
      {isEmergencyActive && (
        <div className="flex items-center justify-between gap-4 rounded-lg bg-red-600 p-4 text-white">
          <div className="flex items-center gap-3">
            <AlertOctagon className="h-8 w-8" />
            <div>
              <p className="text-lg font-bold">EMERGENCY SHUTDOWN ACTIVE</p>
              <p className="text-sm opacity-90">
                {emergencyStatus?.reason || 'Registry operations restricted'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {emergencyStatus?.unlockAt && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                Auto-unlock:{' '}
                {new Date(
                  parseInt(emergencyStatus.unlockAt) * 1000
                ).toLocaleString()}
              </div>
            )}
            <EmergencyShutdownDialog isActive={true} />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Incident Response Console</h1>
          <p className="text-muted-foreground">
            Rapid response tools for security incidents
          </p>
        </div>
        <div className="flex gap-2">
          <MassRevocationDialog />
          {!isEmergencyActive && <EmergencyShutdownDialog isActive={false} />}
        </div>
      </div>

      {/* Error Banners */}
      {emergencyError && (
        <ErrorBanner
          error={emergencyError.message}
          onRetry={() => refetchEmergency()}
        />
      )}
      {revocationsError && (
        <ErrorBanner
          error={revocationsError.message}
          onRetry={() => refetch()}
        />
      )}

      {/* Status Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Registry Status</p>
                {loadingStatus ? (
                  <Skeleton className="mt-1 h-6 w-24" />
                ) : (
                  <p
                    className={`text-lg font-bold ${isEmergencyActive ? 'text-red-600' : 'text-green-600'}`}
                  >
                    {isEmergencyActive ? 'LOCKED' : 'OPERATIONAL'}
                  </p>
                )}
              </div>
              {isEmergencyActive ? (
                <Lock className="h-8 w-8 text-red-600" />
              ) : (
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Revocations
                </p>
                <p className="text-2xl font-bold">
                  {loadingRevocations ? '-' : allRevocations.length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-600">
                  {loadingRevocations
                    ? '-'
                    : allRevocations.filter((r) => r.severity === 'CRITICAL')
                        .length}
                </p>
              </div>
              <AlertOctagon className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last 24h</p>
                <p className="text-2xl font-bold">
                  {loadingRevocations
                    ? '-'
                    : allRevocations.filter(
                        (r) => Date.now() / 1000 - parseInt(r.revokedAt) < 86400
                      ).length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-[200px] flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search revocations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="AGENT">Agent</SelectItem>
                <SelectItem value="PARTNER">Partner</SelectItem>
                <SelectItem value="LICENSE">License</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                {SEVERITY_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Revocation List */}
      <Card>
        <CardHeader>
          <CardTitle>Revocation History</CardTitle>
          <CardDescription>
            {revocations?.entries.length || 0} revocation
            {(revocations?.entries.length || 0) !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRevocations ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (revocations?.entries.length || 0) === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ShieldAlert className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No revocations found matching your criteria</p>
            </div>
          ) : (
            <div className="space-y-4">
              {revocations?.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-4 rounded-lg border p-4"
                >
                  <div
                    className={`rounded-lg p-2 ${
                      entry.targetType === 'AGENT'
                        ? 'bg-blue-100 text-blue-600'
                        : entry.targetType === 'PARTNER'
                          ? 'bg-purple-100 text-purple-600'
                          : 'bg-orange-100 text-orange-600'
                    }`}
                  >
                    <TypeIcon type={entry.targetType} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{entry.targetType}</Badge>
                      <SeverityBadge severity={entry.severity} />
                      <Badge variant="secondary">
                        {REASON_CODES.find((c) => c.value === entry.reasonCode)
                          ?.label || entry.reasonCode}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate font-mono text-sm">
                      {entry.targetId}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {entry.reason}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Revoked by {entry.revokedBy} on{' '}
                      {new Date(
                        parseInt(entry.revokedAt) * 1000
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
