'use client';

import { useState } from 'react';
import {
  Key,
  RefreshCw,
  Download,
  Copy,
  Shield,
  Plus,
  MoreVertical,
  CheckCircle2,
  Clock,
  XCircle,
  Lock,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useOrgKeys,
  useKey,
  useGenerateKeyPair,
  useActivateKey,
  useRotateKey,
  useRevokeKey,
  KeyStatus,
  KeyCustodyModel,
  KeyRotationMode,
  type PartnerKeyRecord,
  type RotateKeyResponse,
} from '@/lib/registry-sdk';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';

import { DEMO_ORG_ID, DEMO_USER_ID } from '@/lib/test-config';

/**
 * Status badge configuration
 */
const statusConfig: Record<
  KeyStatus,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  [KeyStatus.ACTIVE]: {
    label: 'Active',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: CheckCircle2,
  },
  [KeyStatus.PENDING]: {
    label: 'Pending',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: Clock,
  },
  [KeyStatus.ROTATED]: {
    label: 'Rotated',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: RefreshCw,
  },
  [KeyStatus.REVOKED]: {
    label: 'Revoked',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: XCircle,
  },
  [KeyStatus.ESCROWED]: {
    label: 'Escrowed',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    icon: Lock,
  },
  [KeyStatus.UNSPECIFIED]: {
    label: 'Unknown',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    icon: AlertTriangle,
  },
};

/**
 * Format date to relative time or absolute date
 */
function formatDate(timestamp?: number): string {
  if (!timestamp) return '-';

  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days < 1) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    return `${hours}h ago`;
  }
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Format remaining grace period
 */
function formatGracePeriod(expiresAt?: number): string {
  if (!expiresAt) return '-';

  const now = Date.now();
  const diff = expiresAt - now;

  if (diff < 0) return 'Expired';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  return `${hours}h`;
}

/**
 * Truncate key ID for display
 */
function truncateKeyId(keyId: string, length = 8): string {
  if (keyId.length <= length) return keyId;
  return `${keyId.substring(0, length)}...`;
}

/**
 * Truncate fingerprint for display
 */
function truncateFingerprint(fingerprint?: string, length = 16): string {
  if (!fingerprint) return '-';
  if (fingerprint.length <= length) return fingerprint;
  return fingerprint.substring(0, length);
}

/**
 * Copy to clipboard with feedback
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Key status badge component
 */
function KeyStatusBadge({ status }: { status: KeyStatus }) {
  const config = statusConfig[status] || statusConfig[KeyStatus.UNSPECIFIED];
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

/**
 * Copy button with feedback
 */
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 gap-1 px-2 text-xs"
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-green-600" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          {label || 'Copy'}
        </>
      )}
    </Button>
  );
}

/**
 * Active key card component
 */
function ActiveKeyCard({
  activeKey,
  onRotate,
}: {
  activeKey?: PartnerKeyRecord;
  onRotate?: () => void;
}) {
  if (!activeKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            No Active Key
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Generate a new key pair to start signing operations.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-100 p-2">
            <Key className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <CardTitle className="text-lg">Active Key Pair</CardTitle>
            <p className="text-sm text-muted-foreground">
              Created: {formatDate(activeKey.createdAt)} | Key ID:{' '}
              <span className="font-mono">
                {truncateKeyId(activeKey.keyId)}
              </span>
            </p>
          </div>
        </div>
        <KeyStatusBadge status={activeKey.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ed25519 Public Key */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium">
              Public Key (Ed25519 - Classical)
            </label>
            <CopyButton
              text={activeKey.publicKeys.ed25519PublicKey || ''}
              label="Copy"
            />
          </div>
          <div className="rounded-lg bg-muted p-3 font-mono text-sm">
            {activeKey.publicKeys.ed25519PublicKey
              ? `${activeKey.publicKeys.ed25519PublicKey.substring(0, 64)}...`
              : 'Not available'}
          </div>
        </div>

        {/* ML-DSA-65 Public Key */}
        {activeKey.publicKeys.mlDsa65PublicKey && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">
                Public Key (ML-DSA-65 - Post-Quantum)
              </label>
              <CopyButton
                text={activeKey.publicKeys.mlDsa65PublicKey}
                label="Copy"
              />
            </div>
            <div className="max-h-24 overflow-hidden rounded-lg bg-muted p-3 font-mono text-sm">
              {activeKey.publicKeys.mlDsa65PublicKey.substring(0, 100)}...
            </div>
          </div>
        )}

        {/* Fingerprints */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Ed25519 Fingerprint
            </label>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 text-xs">
                {truncateFingerprint(activeKey.ed25519Fingerprint, 20)}
              </code>
              <CopyButton text={activeKey.ed25519Fingerprint} />
            </div>
          </div>
          {activeKey.mlDsa65Fingerprint && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                ML-DSA-65 Fingerprint
              </label>
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 text-xs">
                  {truncateFingerprint(activeKey.mlDsa65Fingerprint, 20)}
                </code>
                <CopyButton text={activeKey.mlDsa65Fingerprint} />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Download Public Keys
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
            onClick={onRotate}
          >
            <RefreshCw className="h-4 w-4" />
            Rotate Keys
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Custody info card
 */
function CustodyInfoCard({ custodyModel }: { custodyModel?: KeyCustodyModel }) {
  const isCustodied = custodyModel === KeyCustodyModel.CUSTODIED;

  return (
    <Card className={isCustodied ? 'border-blue-200 bg-blue-50' : ''}>
      <CardContent className="flex gap-3 pt-6">
        <Shield
          className={`mt-0.5 h-5 w-5 flex-shrink-0 ${isCustodied ? 'text-blue-600' : 'text-gray-600'}`}
        />
        <div>
          <h3
            className={`font-medium ${isCustodied ? 'text-blue-900' : 'text-gray-900'}`}
          >
            {isCustodied ? 'Custodied Keys' : 'Self-Custody Keys'}
          </h3>
          <p
            className={`mt-1 text-sm ${isCustodied ? 'text-blue-700' : 'text-gray-700'}`}
          >
            {isCustodied
              ? 'Your private keys are securely stored and managed by CIRIS. All signing operations are authenticated and logged. You can download your public keys at any time.'
              : 'You manage your own private keys. Only public keys are registered with CIRIS for verification purposes.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Key history table
 */
function KeyHistoryTable({
  keys,
  onActivate,
  onRevoke,
}: {
  keys: PartnerKeyRecord[];
  onActivate: (keyId: string) => void;
  onRevoke: (keyId: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Key History</CardTitle>
        <Badge variant="outline">{keys.length} keys</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                  Key ID
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                  Fingerprint
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                  Activated
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                  Grace Period
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {keys.map((key) => (
                <tr key={key.keyId} className="hover:bg-muted/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-2 py-0.5 text-sm">
                        {truncateKeyId(key.keyId)}
                      </code>
                      <CopyButton text={key.keyId} />
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-muted-foreground">
                    {truncateFingerprint(key.ed25519Fingerprint)}
                  </td>
                  <td className="px-6 py-4">
                    <KeyStatusBadge status={key.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {formatDate(key.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {key.status === KeyStatus.PENDING
                      ? 'Pending'
                      : formatDate(key.activatedAt)}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {key.gracePeriodExpiresAt
                      ? formatGracePeriod(key.gracePeriodExpiresAt)
                      : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Copy Public Key</DropdownMenuItem>
                        {key.status === KeyStatus.PENDING && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onActivate(key.keyId)}
                              className="text-green-600"
                            >
                              Activate Key
                            </DropdownMenuItem>
                          </>
                        )}
                        {(key.status === KeyStatus.ACTIVE ||
                          key.status === KeyStatus.PENDING) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onRevoke(key.keyId)}
                              className="text-red-600"
                            >
                              Revoke Key
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Generate key dialog
 */
function GenerateKeyDialog({
  open,
  onOpenChange,
  onGenerate,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (activateImmediately: boolean) => void;
  isPending: boolean;
}) {
  const [activateImmediately, setActivateImmediately] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate New Key Pair</DialogTitle>
          <DialogDescription>
            This will create a new Ed25519 + ML-DSA-65 hybrid key pair for your
            organization.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={activateImmediately}
              onChange={(e) => setActivateImmediately(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm">Activate immediately</span>
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            If unchecked, the key will be created in &quot;Pending&quot; status
            and must be manually activated.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onGenerate(activateImmediately)}
            disabled={isPending}
          >
            {isPending ? 'Generating...' : 'Generate Key'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Rotation mode configuration
 */
const rotationModeConfig: Record<
  KeyRotationMode,
  {
    label: string;
    icon: React.ElementType;
    description: string;
    recommended?: boolean;
  }
> = {
  [KeyRotationMode.IMMEDIATE]: {
    label: 'Immediate',
    icon: AlertTriangle,
    description:
      'New key active immediately. Old key valid for 24h grace period.',
  },
  [KeyRotationMode.STAGED]: {
    label: 'Staged',
    icon: Clock,
    description:
      'Both keys active during configurable grace period. Recommended for production.',
    recommended: true,
  },
  [KeyRotationMode.DUAL_SIGN]: {
    label: 'Dual Sign',
    icon: Shield,
    description:
      'New key signs, old key validates. Strongest security during transition.',
  },
  [KeyRotationMode.UNSPECIFIED]: {
    label: 'Unspecified',
    icon: AlertTriangle,
    description: 'Default rotation behavior.',
  },
};

/**
 * Rotation wizard steps
 */
type RotationStep = 'mode' | 'grace' | 'confirm' | 'result';

/**
 * Key Rotation Dialog - Multi-step wizard
 */
function RotateKeyDialog({
  open,
  onOpenChange,
  activeKey,
  onRotate,
  isPending,
  result,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeKey: PartnerKeyRecord;
  onRotate: (
    mode: KeyRotationMode,
    gracePeriodHours?: number,
    reason?: string
  ) => void;
  isPending: boolean;
  result?: RotateKeyResponse | null;
}) {
  const [step, setStep] = useState<RotationStep>('mode');
  const [selectedMode, setSelectedMode] = useState<KeyRotationMode>(
    KeyRotationMode.STAGED
  );
  const [gracePeriodHours, setGracePeriodHours] = useState(72);
  const [confirmText, setConfirmText] = useState('');
  const [understood, setUnderstood] = useState(false);

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setStep('mode');
      setSelectedMode(KeyRotationMode.STAGED);
      setGracePeriodHours(72);
      setConfirmText('');
      setUnderstood(false);
    }
    onOpenChange(newOpen);
  };

  // Handle rotation result
  if (result && step !== 'result') {
    setStep('result');
  }

  const canProceedFromMode = selectedMode !== KeyRotationMode.UNSPECIFIED;
  const canProceedFromGrace = gracePeriodHours >= 24 && gracePeriodHours <= 168;
  const canConfirm = confirmText === 'ROTATE' && understood;

  const handleNext = () => {
    if (step === 'mode') {
      if (selectedMode === KeyRotationMode.STAGED) {
        setStep('grace');
      } else {
        setStep('confirm');
      }
    } else if (step === 'grace') {
      setStep('confirm');
    } else if (step === 'confirm') {
      onRotate(
        selectedMode,
        selectedMode === KeyRotationMode.STAGED ? gracePeriodHours : undefined,
        'Key rotation via portal'
      );
    }
  };

  const handleBack = () => {
    if (step === 'grace') {
      setStep('mode');
    } else if (step === 'confirm') {
      if (selectedMode === KeyRotationMode.STAGED) {
        setStep('grace');
      } else {
        setStep('mode');
      }
    }
  };

  const getStepNumber = () => {
    switch (step) {
      case 'mode':
        return 1;
      case 'grace':
        return 2;
      case 'confirm':
        return selectedMode === KeyRotationMode.STAGED ? 3 : 2;
      case 'result':
        return selectedMode === KeyRotationMode.STAGED ? 4 : 3;
    }
  };

  const getTotalSteps = () => (selectedMode === KeyRotationMode.STAGED ? 4 : 3);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Key Rotation
          </DialogTitle>
          <DialogDescription>
            {step === 'result'
              ? 'Rotation completed successfully'
              : `Step ${getStepNumber()} of ${getTotalSteps()}: ${
                  step === 'mode'
                    ? 'Select rotation mode'
                    : step === 'grace'
                      ? 'Configure grace period'
                      : 'Confirm rotation'
                }`}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        {step !== 'result' && (
          <Progress
            value={(getStepNumber() / getTotalSteps()) * 100}
            className="h-1"
          />
        )}

        {/* Step 1: Select Mode */}
        {step === 'mode' && (
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              {[
                KeyRotationMode.IMMEDIATE,
                KeyRotationMode.STAGED,
                KeyRotationMode.DUAL_SIGN,
              ].map((mode) => {
                const config = rotationModeConfig[mode];
                const Icon = config.icon;
                const isSelected = selectedMode === mode;

                return (
                  <button
                    key={mode}
                    onClick={() => setSelectedMode(mode)}
                    className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        className={`mt-0.5 h-5 w-5 ${
                          isSelected ? 'text-blue-600' : 'text-gray-500'
                        }`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{config.label}</span>
                          {config.recommended && (
                            <Badge variant="secondary" className="text-xs">
                              Recommended
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {config.description}
                        </p>
                      </div>
                      <div
                        className={`h-4 w-4 rounded-full border-2 ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {isSelected && (
                          <Check className="h-full w-full p-0.5 text-white" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Grace Period (STAGED mode only) */}
        {step === 'grace' && (
          <div className="space-y-6 py-4">
            <div>
              <Label htmlFor="grace-period" className="text-sm font-medium">
                Grace Period Duration
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Both old and new keys will be valid during this period.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">24h</span>
                <span className="text-2xl font-bold text-blue-600">
                  {gracePeriodHours}h
                </span>
                <span className="text-sm">168h</span>
              </div>
              <input
                id="grace-period"
                type="range"
                min={24}
                max={168}
                step={24}
                value={gracePeriodHours}
                onChange={(e) => setGracePeriodHours(parseInt(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 day</span>
                <span>1 week</span>
              </div>
            </div>

            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm">
                <span className="font-medium">
                  Old key will stop working on:{' '}
                </span>
                <span className="text-muted-foreground">
                  {new Date(
                    Date.now() + gracePeriodHours * 60 * 60 * 1000
                  ).toLocaleString()}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirm' && (
          <div className="space-y-6 py-4">
            {/* Current key info */}
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium">Current Key Fingerprint</p>
              <code className="mt-1 block text-xs text-muted-foreground">
                {activeKey.ed25519Fingerprint}
              </code>
            </div>

            {/* Rotation summary */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mode:</span>
                <span className="font-medium">
                  {rotationModeConfig[selectedMode].label}
                </span>
              </div>
              {selectedMode === KeyRotationMode.STAGED && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Grace Period:</span>
                  <span className="font-medium">{gracePeriodHours} hours</span>
                </div>
              )}
            </div>

            {/* Confirmation input */}
            <div className="space-y-2">
              <Label htmlFor="confirm-rotate" className="text-sm font-medium">
                Type ROTATE to confirm
              </Label>
              <Input
                id="confirm-rotate"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="ROTATE"
                className="font-mono"
              />
            </div>

            {/* Understanding checkbox */}
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
                className="mt-1 rounded border-gray-300"
              />
              <span className="text-sm text-muted-foreground">
                I understand that in-flight requests may need retry during the
                transition period.
              </span>
            </label>
          </div>
        )}

        {/* Step 4: Result */}
        {step === 'result' && result && (
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-lg font-semibold">
                Key Rotated Successfully
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Your new key is now active.
              </p>
            </div>

            {/* New key fingerprint */}
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">New Key Fingerprint</p>
                  <code className="mt-1 block text-xs text-muted-foreground">
                    {result.newKey.ed25519Fingerprint}
                  </code>
                </div>
                <CopyButton text={result.newKey.ed25519Fingerprint || ''} />
              </div>
            </div>

            {/* Grace period timeline */}
            {result.gracePeriodExpiresAt && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Grace Period Timeline</p>
                <div className="relative h-2 rounded-full bg-gray-200">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full bg-blue-500"
                    style={{ width: '0%' }}
                  />
                  <div className="absolute -top-1 left-0 h-4 w-4 rounded-full border-2 border-blue-500 bg-white" />
                  <div className="absolute -top-1 right-0 h-4 w-4 rounded-full border-2 border-gray-300 bg-white" />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Now</span>
                  <span>
                    {new Date(result.gracePeriodExpiresAt).toLocaleDateString()}{' '}
                    {new Date(result.gracePeriodExpiresAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            )}

            {/* Reminder */}
            <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">
                  Remember to update deployments
                </p>
                <p className="mt-1 text-yellow-700">
                  Update your applications with the new public key to ensure
                  uninterrupted service.
                </p>
              </div>
            </div>

            {/* Download new public key */}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 gap-2">
                <Download className="h-4 w-4" />
                Download Public Keys
              </Button>
              <CopyButton
                text={result.newKey.publicKeys?.ed25519PublicKey || ''}
                label="Copy Ed25519"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'result' ? (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          ) : (
            <>
              {step !== 'mode' && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={isPending}
                >
                  Back
                </Button>
              )}
              <Button
                onClick={step === 'confirm' ? handleNext : handleNext}
                disabled={
                  (step === 'mode' && !canProceedFromMode) ||
                  (step === 'grace' && !canProceedFromGrace) ||
                  (step === 'confirm' && !canConfirm) ||
                  isPending
                }
              >
                {isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Rotating...
                  </>
                ) : step === 'confirm' ? (
                  'Rotate Key'
                ) : (
                  'Next'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Main Keys Page
 */
export default function KeysPage() {
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);
  const [rotateResult, setRotateResult] = useState<RotateKeyResponse | null>(
    null
  );

  // Fetch keys
  const {
    data: keysData,
    isLoading,
    error,
    refetch,
  } = useOrgKeys({ orgId: DEMO_ORG_ID, includeRevoked: true });

  // Mutations
  const generateMutation = useGenerateKeyPair({
    onSuccess: () => {
      setGenerateDialogOpen(false);
      refetch();
    },
  });

  const activateMutation = useActivateKey({
    onSuccess: () => {
      refetch();
    },
  });

  const rotateMutation = useRotateKey({
    onSuccess: (data) => {
      setRotateResult(data);
      refetch();
    },
  });

  const revokeMutation = useRevokeKey({
    onSuccess: () => {
      refetch();
    },
  });

  const handleGenerateKey = (activateImmediately: boolean) => {
    generateMutation.mutate({
      orgId: DEMO_ORG_ID,
      requesterUserId: DEMO_USER_ID,
      activateImmediately,
    });
  };

  const handleActivateKey = (keyId: string) => {
    activateMutation.mutate({
      orgId: DEMO_ORG_ID,
      keyId,
      requesterUserId: DEMO_USER_ID,
    });
  };

  const handleRevokeKey = (keyId: string) => {
    if (
      confirm(
        'Are you sure you want to revoke this key? This action cannot be undone.'
      )
    ) {
      revokeMutation.mutate({
        orgId: DEMO_ORG_ID,
        keyId,
        reason: 'Manual revocation',
        requesterUserId: DEMO_USER_ID,
      });
    }
  };

  const handleRotateKey = (
    mode: KeyRotationMode,
    gracePeriodHours?: number,
    reason?: string
  ) => {
    rotateMutation.mutate({
      orgId: DEMO_ORG_ID,
      requesterUserId: DEMO_USER_ID,
      mode,
      gracePeriodHours,
      reason,
    });
  };

  const handleRotateDialogClose = (open: boolean) => {
    if (!open) {
      setRotateResult(null);
    }
    setRotateDialogOpen(open);
  };

  const keys = keysData?.data || [];
  const activeKey = keys.find((k) => k.status === KeyStatus.ACTIVE);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Key Management</h1>
          <p className="mt-1 text-gray-600">
            Manage cryptographic signing keys for your organization
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="mb-4 h-8 w-48" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Key Management</h1>
          <p className="mt-1 text-gray-600">
            Manage cryptographic signing keys for your organization
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Unable to load keys</span>
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
          <h1 className="text-3xl font-bold text-gray-900">Key Management</h1>
          <p className="mt-1 text-gray-600">
            Manage cryptographic signing keys for your organization
          </p>
        </div>
        <Button className="gap-2" onClick={() => setGenerateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Generate New Key
        </Button>
      </div>

      {/* Active Key */}
      <ActiveKeyCard
        activeKey={activeKey}
        onRotate={() => setRotateDialogOpen(true)}
      />

      {/* Custody Info */}
      <CustodyInfoCard custodyModel={activeKey?.custodyModel} />

      {/* Key History */}
      {keys.length > 0 && (
        <KeyHistoryTable
          keys={keys}
          onActivate={handleActivateKey}
          onRevoke={handleRevokeKey}
        />
      )}

      {/* Generate Dialog */}
      <GenerateKeyDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
        onGenerate={handleGenerateKey}
        isPending={generateMutation.isPending}
      />

      {/* Rotate Dialog */}
      {activeKey && (
        <RotateKeyDialog
          open={rotateDialogOpen}
          onOpenChange={handleRotateDialogClose}
          activeKey={activeKey}
          onRotate={handleRotateKey}
          isPending={rotateMutation.isPending}
          result={rotateResult}
        />
      )}
    </div>
  );
}
