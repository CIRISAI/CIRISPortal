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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bot,
  Plus,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Search,
  Upload,
  Eye,
  Copy,
  Loader2,
  RefreshCw,
  ExternalLink,
  AlertOctagon,
} from 'lucide-react';
import { toast } from '@/lib/hooks/use-toast';
import { ALL_ACTIONS, TEMPLATE_PRESETS, KNOWN_ADAPTERS } from '@/lib/templates';

// Types
interface AgentRecord {
  agentHash: string;
  agentHashHex?: string; // New field from backend
  agentType: string;
  version: {
    major: number;
    minor: number;
    patch: number;
  };
  status: string;
  capabilities: string[];
  maxAutonomyTier: string;
  registeredAt: string;
  hasAttestation: boolean;
  attestation?: BuildAttestation;
  identityTemplate?: string;
  stewardshipTier?: number;
  permittedActions?: string[];
  approvedAdapters?: string[];
  templateHash?: string;
}

// Helper to extract hex hash from various formats
function getAgentHashHex(agent: any): string {
  // Prefer agentHashHex if available
  if (agent.agentHashHex && typeof agent.agentHashHex === 'string') {
    return agent.agentHashHex;
  }
  // Handle Buffer format from gRPC
  if (
    agent.agentHash?.type === 'Buffer' &&
    Array.isArray(agent.agentHash.data)
  ) {
    return agent.agentHash.data
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // String format
  if (typeof agent.agentHash === 'string') {
    return agent.agentHash;
  }
  return '';
}

interface BuildAttestation {
  buildType: string;
  sourceRepo: string;
  commitHash: string;
  builderId: string;
  slsaLevel: number;
  signature: string;
  createdAt: string;
}

interface AgentsResponse {
  agents: AgentRecord[];
  totalCount: number;
  stats?: {
    registered: number;
    deprecated: number;
    revoked: number;
    attested: number;
  };
}

// Error Display Component
function ErrorBanner({
  error,
  onRetry,
  testId = 'error-banner',
}: {
  error: string;
  onRetry?: () => void;
  testId?: string;
}) {
  return (
    <Card className="border-red-300 bg-red-50" data-testid={testId}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <AlertOctagon className="h-6 w-6 flex-shrink-0 text-red-600" />
          <div className="flex-1">
            <h3
              className="font-semibold text-red-800"
              data-testid={`${testId}-title`}
            >
              API Error
            </h3>
            <p
              className="mt-1 whitespace-pre-wrap font-mono text-sm text-red-700"
              data-testid={`${testId}-message`}
            >
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
              data-testid={`${testId}-retry`}
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

// Agent types and status mappings
const AGENT_TYPES: Record<string, string> = {
  CIRISCARE: 'CIRIS Care',
  CIRISMEDICAL: 'CIRIS Medical',
  CIRISLEGAL: 'CIRIS Legal',
  CIRISFINANCIAL: 'CIRIS Financial',
  CUSTOM: 'Custom Agent',
};

const AGENT_TYPES_OPTIONS = [
  { value: 'CIRISCARE', label: 'CIRIS Care' },
  { value: 'CIRISMEDICAL', label: 'CIRIS Medical' },
  { value: 'CIRISLEGAL', label: 'CIRIS Legal' },
  { value: 'CIRISFINANCIAL', label: 'CIRIS Financial' },
  { value: 'CUSTOM', label: 'Custom Agent' },
];

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  AGENT_ACTIVE: {
    label: 'Active',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  AGENT_DEPRECATED: {
    label: 'Deprecated',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
  },
  AGENT_REVOKED: {
    label: 'Revoked',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
};

const AUTONOMY_TIERS = [
  { value: 'A0_ADVISORY', label: 'A0 - Advisory' },
  { value: 'A1_LIMITED', label: 'A1 - Limited' },
  { value: 'A2_MODERATE', label: 'A2 - Moderate' },
  { value: 'A3_HIGH', label: 'A3 - High Autonomy' },
  { value: 'A4_CRITICAL', label: 'A4 - Critical' },
];

const CAPABILITIES = [
  'CAP_TEXT_GENERATION',
  'CAP_CODE_EXECUTION',
  'CAP_FILE_SYSTEM',
  'CAP_NETWORK_ACCESS',
  'CAP_TOOL_USE',
  'CAP_MEMORY_PERSISTENCE',
  'CAP_MULTI_MODAL',
  'CAP_REASONING',
];

// ALL_ACTIONS, TEMPLATE_PRESETS, KNOWN_ADAPTERS imported from @/lib/templates

function formatVersion(version?: {
  major: number;
  minor: number;
  patch: number;
}) {
  if (!version) return '-';
  return `v${version.major}.${version.minor}.${version.patch}`;
}

function truncateHash(hash: string, length = 16) {
  if (!hash) return '-';
  if (hash.length <= length) return hash;
  return `${hash.slice(0, length / 2)}...${hash.slice(-length / 2)}`;
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || {
    label: status?.replace('AGENT_', '') || 'Unknown',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  };

  return (
    <Badge className={`${config.bgColor} ${config.color}`} variant="outline">
      {config.label}
    </Badge>
  );
}

// Agent Registration Dialog
function RegisterAgentDialog() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    agentHash: '',
    agentType: '',
    versionMajor: '1',
    versionMinor: '0',
    versionPatch: '0',
    capabilities: [] as string[],
    maxAutonomyTier: '',
    identityTemplate: '',
    stewardshipTier: 0,
    permittedActions: [] as string[],
    approvedAdapters: [] as string[],
  });
  const queryClient = useQueryClient();

  const [registrationError, setRegistrationError] = useState<string | null>(
    null
  );

  const registerMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      setRegistrationError(null);
      console.log('[RegisterAgent] Sending request:', data);
      const payload = {
        agentHash: data.agentHash,
        agentType: data.agentType,
        version: {
          major: parseInt(data.versionMajor),
          minor: parseInt(data.versionMinor),
          patch: parseInt(data.versionPatch),
        },
        capabilities: data.capabilities,
        maxAutonomyTier: data.maxAutonomyTier,
        identityTemplate: data.identityTemplate || undefined,
        stewardshipTier: data.stewardshipTier || undefined,
        permittedActions:
          data.permittedActions.length > 0 ? data.permittedActions : undefined,
        approvedAdapters:
          data.approvedAdapters.length > 0 ? data.approvedAdapters : undefined,
      };
      console.log('[RegisterAgent] Payload:', JSON.stringify(payload));
      const response = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      console.log('[RegisterAgent] Response:', response.status, result);
      if (!response.ok) {
        const errMsg =
          result.error || `Registration failed with status ${response.status}`;
        throw new Error(errMsg);
      }
      if (!result.success) {
        throw new Error(
          result.error || 'Registration returned without success flag'
        );
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
      toast({
        title: 'Success',
        description: 'Agent registered successfully',
        variant: 'success',
      });
      setRegistrationError(null);
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      console.error('[RegisterAgent] Error:', error);
      setRegistrationError(error.message);
      toast({
        title: 'Registration Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      agentHash: '',
      agentType: '',
      versionMajor: '1',
      versionMinor: '0',
      versionPatch: '0',
      capabilities: [],
      maxAutonomyTier: '',
      identityTemplate: '',
      stewardshipTier: 0,
      permittedActions: [],
      approvedAdapters: [],
    });
  };

  const toggleCapability = (cap: string) => {
    setFormData((prev) => ({
      ...prev,
      capabilities: prev.capabilities.includes(cap)
        ? prev.capabilities.filter((c) => c !== cap)
        : [...prev.capabilities, cap],
    }));
  };

  const isValidHash = /^[a-fA-F0-9]{64}$/.test(formData.agentHash);
  const isFormValid =
    isValidHash &&
    formData.agentType &&
    formData.capabilities.length > 0 &&
    formData.maxAutonomyTier;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setRegistrationError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button data-testid="register-agent-btn">
          <Plus className="mr-2 h-4 w-4" />
          Register Agent
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[90vh] max-w-2xl flex-col"
        data-testid="register-agent-dialog"
      >
        <DialogHeader>
          <DialogTitle>Register New Agent</DialogTitle>
          <DialogDescription>
            Add a new agent build to the registry
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 overflow-y-auto py-4 pr-1">
          <div className="space-y-2">
            <Label htmlFor="agentHash">Agent Hash (SHA-256)</Label>
            <Input
              id="agentHash"
              data-testid="input-agent-hash"
              placeholder="64-character hex hash"
              value={formData.agentHash}
              onChange={(e) =>
                setFormData({ ...formData, agentHash: e.target.value })
              }
              className="font-mono text-sm"
            />
            {formData.agentHash && !isValidHash && (
              <p className="text-xs text-red-500">
                Must be exactly 64 hexadecimal characters
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Agent Type</Label>
              <Select
                value={formData.agentType}
                onValueChange={(value) =>
                  setFormData({ ...formData, agentType: value })
                }
              >
                <SelectTrigger data-testid="select-agent-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_TYPES_OPTIONS.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Max Autonomy Tier</Label>
              <Select
                value={formData.maxAutonomyTier}
                onValueChange={(value) =>
                  setFormData({ ...formData, maxAutonomyTier: value })
                }
              >
                <SelectTrigger data-testid="select-autonomy-tier">
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  {AUTONOMY_TIERS.map((tier) => (
                    <SelectItem key={tier.value} value={tier.value}>
                      {tier.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Version</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                data-testid="input-version-major"
                value={formData.versionMajor}
                onChange={(e) =>
                  setFormData({ ...formData, versionMajor: e.target.value })
                }
                className="w-20"
              />
              <span className="text-muted-foreground">.</span>
              <Input
                type="number"
                min="0"
                data-testid="input-version-minor"
                value={formData.versionMinor}
                onChange={(e) =>
                  setFormData({ ...formData, versionMinor: e.target.value })
                }
                className="w-20"
              />
              <span className="text-muted-foreground">.</span>
              <Input
                type="number"
                min="0"
                data-testid="input-version-patch"
                value={formData.versionPatch}
                onChange={(e) =>
                  setFormData({ ...formData, versionPatch: e.target.value })
                }
                className="w-20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Capabilities</Label>
            <div className="flex flex-wrap gap-2">
              {CAPABILITIES.map((cap) => (
                <Badge
                  key={cap}
                  data-testid={`cap-${cap.replace('CAP_', '').toLowerCase()}`}
                  variant={
                    formData.capabilities.includes(cap) ? 'default' : 'outline'
                  }
                  className="cursor-pointer"
                  onClick={() => toggleCapability(cap)}
                >
                  {cap.replace('CAP_', '').toLowerCase().replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Identity Template</Label>
              <Select
                value={formData.identityTemplate}
                onValueChange={(value) => {
                  const preset = TEMPLATE_PRESETS[value];
                  if (preset) {
                    setFormData({
                      ...formData,
                      identityTemplate: value,
                      stewardshipTier: preset.tier,
                      permittedActions: [...preset.actions],
                      approvedAdapters: [...preset.adapters],
                    });
                  } else {
                    setFormData({
                      ...formData,
                      identityTemplate: value,
                      stewardshipTier: 0,
                      permittedActions: [],
                      approvedAdapters: [],
                    });
                  }
                }}
              >
                <SelectTrigger data-testid="select-identity-template">
                  <SelectValue placeholder="Select template (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TEMPLATE_PRESETS).map(([key, preset]) => (
                    <SelectItem key={key} value={key}>
                      {preset.label} — Tier {preset.tier}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.identityTemplate && (
              <div className="space-y-2">
                <Label>Stewardship Tier</Label>
                <Select
                  value={formData.stewardshipTier.toString()}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      stewardshipTier: parseInt(value),
                    })
                  }
                  disabled={formData.identityTemplate !== 'custom'}
                >
                  <SelectTrigger data-testid="select-stewardship-tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((tier) => (
                      <SelectItem key={tier} value={tier.toString()}>
                        Tier {tier}{' '}
                        {tier === 1
                          ? '(Highest Autonomy)'
                          : tier === 5
                            ? '(Most Restricted)'
                            : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {formData.identityTemplate && (
            <div className="space-y-2">
              <Label>
                Permitted Actions
                {formData.identityTemplate !== 'custom' && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (from preset)
                  </span>
                )}
              </Label>
              <p className="text-xs text-muted-foreground">
                {TEMPLATE_PRESETS[formData.identityTemplate]?.description ||
                  'Custom template configuration'}
              </p>
              <div
                className="flex flex-wrap gap-2"
                data-testid="permitted-actions"
              >
                {formData.permittedActions.map((action) => (
                  <Badge
                    key={action}
                    variant="secondary"
                    className="font-mono text-xs"
                    data-testid={`action-${action.toLowerCase()}`}
                  >
                    {action}
                  </Badge>
                ))}
                {formData.permittedActions.length === 0 && (
                  <span className="text-sm text-muted-foreground">
                    No actions configured
                  </span>
                )}
              </div>
            </div>
          )}

          {formData.identityTemplate && (
            <div className="space-y-2">
              <Label>
                Approved Adapters
                {formData.identityTemplate !== 'custom' && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (click to toggle)
                  </span>
                )}
              </Label>
              <p className="text-xs text-muted-foreground">
                Adapters this agent build is permitted to load at runtime
              </p>
              <div className="max-h-48 overflow-y-auto rounded-md border p-3">
                {Array.from(new Set(KNOWN_ADAPTERS.map((a) => a.category))).map(
                  (category) => (
                    <div key={category} className="mb-2">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        {category}
                      </p>
                      <div
                        className="flex flex-wrap gap-1"
                        data-testid={`adapter-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {KNOWN_ADAPTERS.filter(
                          (a) => a.category === category
                        ).map((adapter) => (
                          <Badge
                            key={adapter.name}
                            variant={
                              formData.approvedAdapters.includes(adapter.name)
                                ? 'default'
                                : 'outline'
                            }
                            className="cursor-pointer font-mono text-xs"
                            data-testid={`adapter-${adapter.name}`}
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                approvedAdapters:
                                  prev.approvedAdapters.includes(adapter.name)
                                    ? prev.approvedAdapters.filter(
                                        (a) => a !== adapter.name
                                      )
                                    : [...prev.approvedAdapters, adapter.name],
                              }));
                            }}
                          >
                            {adapter.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formData.approvedAdapters.length} adapter
                {formData.approvedAdapters.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          )}
        </div>
        {/* Inline error display */}
        {registrationError && (
          <div
            className="flex items-start gap-3 rounded-md border border-red-300 bg-red-50 p-3"
            data-testid="register-error"
          >
            <AlertOctagon className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="flex-1">
              <p
                className="text-sm font-medium text-red-800"
                data-testid="register-error-title"
              >
                Registration Failed
              </p>
              <p
                className="mt-1 whitespace-pre-wrap font-mono text-xs text-red-700"
                data-testid="register-error-message"
              >
                {registrationError}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
              onClick={() => setRegistrationError(null)}
              data-testid="register-error-dismiss"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            data-testid="register-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={() => registerMutation.mutate(formData)}
            disabled={!isFormValid || registerMutation.isPending}
            data-testid="register-submit-btn"
          >
            {registerMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registering...
              </>
            ) : (
              'Register Agent'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Batch Registration Dialog
function BatchRegisterDialog() {
  const [open, setOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [preview, setPreview] = useState<AgentRecord[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonInput(content);
      parseJson(content);
    };
    reader.readAsText(file);
  };

  const parseJson = (content: string) => {
    try {
      const data = JSON.parse(content);
      if (!Array.isArray(data.agents)) {
        throw new Error('JSON must contain an "agents" array');
      }
      setPreview(data.agents);
      setParseError(null);
    } catch (err: unknown) {
      setPreview(null);
      setParseError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  const batchMutation = useMutation({
    mutationFn: async (agents: AgentRecord[]) => {
      console.log(
        '[BatchRegister] Sending request with',
        agents.length,
        'agents'
      );
      const response = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: true, agents }),
      });
      const result = await response.json();
      console.log('[BatchRegister] Response:', response.status, result);
      if (!response.ok) {
        throw new Error(
          result.error || `Batch registration failed: ${response.status}`
        );
      }
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
      toast({
        title: 'Batch Complete',
        description: `Registered ${data.successCount} agents${data.failureCount > 0 ? `, ${data.failureCount} failed` : ''}`,
        variant: data.failureCount > 0 ? 'default' : 'success',
      });
      setOpen(false);
      setJsonInput('');
      setPreview(null);
    },
    onError: (error: Error) => {
      console.error('[BatchRegister] Error:', error);
      toast({
        title: 'Batch Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="batch-register-btn">
          <Upload className="mr-2 h-4 w-4" />
          Batch Register
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-auto">
        <DialogHeader>
          <DialogTitle>Batch Register Agents</DialogTitle>
          <DialogDescription>
            Upload a JSON file to register multiple agents at once
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Upload JSON File</Label>
            <Input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <Label>Or paste JSON</Label>
            <textarea
              className="h-32 w-full rounded-md border p-2 font-mono text-sm"
              placeholder='{"agents": [{"agentHash": "...", "agentType": "...", ...}]}'
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                parseJson(e.target.value);
              }}
            />
          </div>

          {parseError && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <XCircle className="h-4 w-4" />
              {parseError}
            </div>
          )}

          {preview && preview.length > 0 && (
            <div className="space-y-2">
              <Label>Preview ({preview.length} agents)</Label>
              <div className="max-h-48 overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Hash</th>
                      <th className="p-2 text-left">Type</th>
                      <th className="p-2 text-left">Version</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((agent, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-mono text-xs">
                          {truncateHash(agent.agentHash || '')}
                        </td>
                        <td className="p-2">
                          {AGENT_TYPES[agent.agentType] || agent.agentType}
                        </td>
                        <td className="p-2">
                          {agent.version ? formatVersion(agent.version) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 10 && (
                  <p className="border-t p-2 text-center text-muted-foreground">
                    ...and {preview.length - 10} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => preview && batchMutation.mutate(preview)}
            disabled={
              !preview || preview.length === 0 || batchMutation.isPending
            }
          >
            {batchMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registering...
              </>
            ) : (
              `Register ${preview?.length || 0} Agents`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Build Attestation Dialog
function AttestationDialog({ agent }: { agent: AgentRecord }) {
  const [open, setOpen] = useState(false);
  const attestation = agent.attestation;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Build Attestation
          </DialogTitle>
          <DialogDescription>
            Cryptographic proof of build provenance
          </DialogDescription>
        </DialogHeader>
        {attestation ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Build Type</Label>
                <p className="font-medium">{attestation.buildType}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">SLSA Level</Label>
                <Badge variant="outline" className="mt-1">
                  Level {attestation.slsaLevel}
                </Badge>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  Source Repository
                </Label>
                <a
                  href={attestation.sourceRepo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-emerald-600 hover:underline"
                >
                  {attestation.sourceRepo.replace('https://github.com/', '')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div>
                <Label className="text-muted-foreground">Builder ID</Label>
                <p className="font-mono text-sm">{attestation.builderId}</p>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Commit Hash</Label>
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
                  {attestation.commitHash}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(attestation.commitHash);
                    toast({
                      title: 'Copied',
                      description: 'Hash copied to clipboard',
                    });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">
                Attestation Signature
              </Label>
              <div className="mt-1 overflow-x-auto rounded-md bg-muted p-3">
                <code className="break-all font-mono text-xs">
                  {attestation.signature}
                </code>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <Shield className="mx-auto mb-2 h-12 w-12 opacity-50" />
            <p>No attestation data available for this agent</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Agent Details Dialog
function AgentDetailsDialog({ agent }: { agent: AgentRecord }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Agent Details
          </DialogTitle>
          <DialogDescription>
            {AGENT_TYPES[agent.agentType] || agent.agentType} -{' '}
            {formatVersion(agent.version)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={agent.status} />
            <Badge variant="outline">
              {agent.maxAutonomyTier?.replace('AUTONOMY_TIER_', '') ||
                'Unknown Tier'}
            </Badge>
            {agent.hasAttestation && (
              <Badge
                className="bg-emerald-100 text-emerald-700"
                variant="outline"
              >
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Attested Build
              </Badge>
            )}
          </div>

          <div>
            <Label className="text-muted-foreground">Agent Hash</Label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-sm">
                {agent.agentHash}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(agent.agentHash);
                  toast({
                    title: 'Copied',
                    description: 'Hash copied to clipboard',
                  });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Registered</Label>
              <p className="font-medium">
                {agent.registeredAt
                  ? new Date(
                      parseInt(agent.registeredAt) * 1000
                    ).toLocaleDateString()
                  : '-'}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Version</Label>
              <p className="font-medium">{formatVersion(agent.version)}</p>
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground">Capabilities</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {agent.capabilities?.map((cap) => (
                <Badge key={cap} variant="secondary">
                  {cap.replace('CAP_', '').toLowerCase().replace(/_/g, ' ')}
                </Badge>
              )) || <span className="text-muted-foreground">None</span>}
            </div>
          </div>

          {agent.identityTemplate && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">
                    Identity Template
                  </Label>
                  <p className="font-medium capitalize">
                    {agent.identityTemplate}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    Stewardship Tier
                  </Label>
                  <Badge variant="outline" className="mt-1">
                    Tier {agent.stewardshipTier || '-'}
                  </Badge>
                </div>
              </div>
              {agent.permittedActions && agent.permittedActions.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">
                    Permitted Actions
                  </Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {agent.permittedActions.map((action) => (
                      <Badge
                        key={action}
                        variant="secondary"
                        className="font-mono text-xs"
                      >
                        {action}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {agent.approvedAdapters && agent.approvedAdapters.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">
                    Approved Adapters
                  </Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {agent.approvedAdapters.map((adapter) => (
                      <Badge
                        key={adapter}
                        variant="outline"
                        className="font-mono text-xs"
                      >
                        {adapter}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Fetch agents from API
async function fetchAgents(): Promise<AgentsResponse> {
  console.log('[AdminAgents] Fetching agents from /api/admin/agents');
  const response = await fetch('/api/admin/agents');
  const data = await response.json();
  console.log('[AdminAgents] Response:', response.status, data);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `Failed to fetch agents: ${response.status} ${response.statusText}`
    );
  }

  // Normalize agent data - convert hash to hex string
  const agents = (data.agents || []).map((agent: any) => ({
    ...agent,
    agentHash: getAgentHashHex(agent),
    status: agent.status || 'AGENT_ACTIVE',
    capabilities: agent.capabilities || agent.baseCapabilities || [],
    identityTemplate: agent.identityTemplate || '',
    stewardshipTier: agent.stewardshipTier || 0,
    permittedActions: agent.permittedActions || [],
    approvedAdapters: agent.approvedAdapters || [],
  }));

  return {
    agents,
    totalCount: data.totalCount || agents.length,
    stats: data.stats,
  };
}

export default function AdminAgentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data, isLoading, error, refetch } = useQuery<AgentsResponse, Error>({
    queryKey: ['admin-agents'],
    queryFn: fetchAgents,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Filter agents client-side
  const filteredAgents = (data?.agents || []).filter((agent) => {
    if (
      searchQuery &&
      !agent.agentHash?.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    if (statusFilter !== 'all' && agent.status !== statusFilter) {
      return false;
    }
    if (typeFilter !== 'all' && agent.agentType !== typeFilter) {
      return false;
    }
    return true;
  });

  // Calculate stats from real data
  const allAgents = data?.agents || [];
  const stats = data?.stats || {
    registered: allAgents.filter((a) => a.status === 'AGENT_ACTIVE').length,
    deprecated: allAgents.filter((a) => a.status === 'AGENT_DEPRECATED').length,
    revoked: allAgents.filter((a) => a.status === 'AGENT_REVOKED').length,
    attested: allAgents.filter((a) => a.hasAttestation).length,
  };

  return (
    <div className="space-y-6 p-6" data-testid="agents-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="agents-page-title">
            Agent Registry
          </h1>
          <p className="text-muted-foreground">
            Manage registered agent builds and attestations
          </p>
        </div>
        <div className="flex gap-2">
          <BatchRegisterDialog />
          <RegisterAgentDialog />
        </div>
      </div>

      {/* Error Banner */}
      {error && <ErrorBanner error={error.message} onRetry={() => refetch()} />}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Agents</p>
                <p className="text-2xl font-bold">
                  {isLoading ? '-' : allAgents.length}
                </p>
              </div>
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Registered</p>
                <p className="text-2xl font-bold text-green-600">
                  {isLoading ? '-' : stats.registered}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Deprecated</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {isLoading ? '-' : stats.deprecated}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revoked</p>
                <p className="text-2xl font-bold text-red-600">
                  {isLoading ? '-' : stats.revoked}
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
                <p className="text-sm text-muted-foreground">
                  With Attestation
                </p>
                <p className="text-2xl font-bold text-emerald-600">
                  {isLoading ? '-' : stats.attested}
                </p>
              </div>
              <Shield className="h-8 w-8 text-emerald-600" />
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
                  placeholder="Search by hash..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 font-mono"
                  data-testid="search-agents"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="AGENT_ACTIVE">Registered</SelectItem>
                <SelectItem value="AGENT_DEPRECATED">Deprecated</SelectItem>
                <SelectItem value="AGENT_REVOKED">Revoked</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {AGENT_TYPES_OPTIONS.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              data-testid="refresh-agents-btn"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Agent List */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Agents</CardTitle>
          <CardDescription>
            {filteredAgents.length} agent
            {filteredAgents.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Bot className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>{error ? 'Failed to load agents' : 'No agents found'}</p>
              {!error && allAgents.length === 0 && (
                <p className="mt-2 text-sm">
                  Register your first agent to get started
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Hash</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Version</th>
                    <th className="pb-3 font-medium">Template</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Registered</th>
                    <th className="pb-3 font-medium">Attestation</th>
                    <th className="sr-only pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAgents.map((agent) => (
                    <tr
                      key={agent.agentHash}
                      className="border-b last:border-0"
                    >
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-sm">
                            {truncateHash(agent.agentHash)}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              navigator.clipboard.writeText(agent.agentHash);
                              toast({
                                title: 'Copied',
                                description: 'Hash copied to clipboard',
                              });
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                      <td className="py-4">
                        {AGENT_TYPES[agent.agentType] || agent.agentType}
                      </td>
                      <td className="py-4 font-mono">
                        {formatVersion(agent.version)}
                      </td>
                      <td className="py-4">
                        {agent.identityTemplate ? (
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className="font-mono text-xs capitalize"
                            >
                              {agent.identityTemplate}
                            </Badge>
                            {agent.stewardshipTier ? (
                              <span className="text-xs text-muted-foreground">
                                T{agent.stewardshipTier}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            -
                          </span>
                        )}
                      </td>
                      <td className="py-4">
                        <StatusBadge status={agent.status} />
                      </td>
                      <td className="py-4 text-muted-foreground">
                        {agent.registeredAt
                          ? new Date(
                              parseInt(agent.registeredAt) * 1000
                            ).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="py-4">
                        {agent.hasAttestation ? (
                          <AttestationDialog agent={agent} />
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            -
                          </span>
                        )}
                      </td>
                      <td className="py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <AgentDetailsDialog agent={agent} />
                            <DropdownMenuItem
                              onClick={() => {
                                navigator.clipboard.writeText(agent.agentHash);
                                toast({
                                  title: 'Copied',
                                  description: 'Hash copied to clipboard',
                                });
                              }}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Copy Hash
                            </DropdownMenuItem>
                            {agent.status === 'AGENT_ACTIVE' && (
                              <>
                                <DropdownMenuItem className="text-yellow-600">
                                  <AlertTriangle className="mr-2 h-4 w-4" />
                                  Deprecate
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600">
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Revoke
                                </DropdownMenuItem>
                              </>
                            )}
                            {agent.status === 'AGENT_DEPRECATED' && (
                              <DropdownMenuItem className="text-red-600">
                                <XCircle className="mr-2 h-4 w-4" />
                                Revoke
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
