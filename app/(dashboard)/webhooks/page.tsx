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
import { Checkbox } from '@/components/ui/checkbox';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Webhook,
  Plus,
  Trash2,
  TestTube,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  AlertOctagon,
} from 'lucide-react';
import { TEST_ORG_ID } from '@/lib/test-config';
import { toast } from '@/lib/hooks/use-toast';

interface WebhookConfig {
  id: string;
  url: string;
  subscribedEvents: string[];
  active: boolean;
  signingSecret: string;
  lastTriggeredAt?: string;
  consecutiveFailures: number;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  event: string;
  status: 'success' | 'failed';
  statusCode?: number;
  timestamp: string;
  duration?: number;
}

const EVENT_CATEGORIES = [
  {
    name: 'Agent Events',
    events: [
      {
        id: 'agent.registered',
        label: 'Agent Registered',
        description: 'When a new agent is registered',
      },
      {
        id: 'agent.deprecated',
        label: 'Agent Deprecated',
        description: 'When an agent is marked deprecated',
      },
      {
        id: 'agent.revoked',
        label: 'Agent Revoked',
        description: 'When an agent is revoked',
      },
    ],
  },
  {
    name: 'Partner Events',
    events: [
      {
        id: 'partner.suspended',
        label: 'Partner Suspended',
        description: 'When a partner is suspended',
      },
      {
        id: 'partner.revoked',
        label: 'Partner Revoked',
        description: 'When a partner is revoked',
      },
      {
        id: 'partner.license_renewed',
        label: 'License Renewed',
        description: 'When a license is renewed',
      },
    ],
  },
  {
    name: 'Key Events',
    events: [
      {
        id: 'key.generated',
        label: 'Key Generated',
        description: 'When a new key is generated',
      },
      {
        id: 'key.rotated',
        label: 'Key Rotated',
        description: 'When a key is rotated',
      },
      {
        id: 'key.revoked',
        label: 'Key Revoked',
        description: 'When a key is revoked',
      },
      {
        id: 'key.escrowed',
        label: 'Key Escrowed',
        description: 'When a key is escrowed',
      },
    ],
  },
  {
    name: 'System Events',
    events: [
      {
        id: 'emergency.shutdown',
        label: 'Emergency Shutdown',
        description: 'When emergency shutdown is activated',
      },
      {
        id: 'emergency.cleared',
        label: 'Emergency Cleared',
        description: 'When emergency shutdown is cleared',
      },
    ],
  },
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
async function fetchWebhooks(orgId: string): Promise<WebhookConfig[]> {
  console.log(
    '[Webhooks] Fetching webhooks from /api/webhooks for org:',
    orgId
  );
  const response = await fetch(
    `/api/webhooks?org_id=${encodeURIComponent(orgId)}`
  );
  const data = await response.json();
  console.log('[Webhooks] Response:', response.status, data);

  if (!response.ok) {
    throw new Error(
      data.error || `Failed to fetch webhooks: ${response.status}`
    );
  }

  // Map backend response to our interface
  return (data.webhooks || []).map((wh: any) => ({
    id: wh.webhookId || wh.id || '',
    url: wh.url || '',
    subscribedEvents: wh.events || wh.subscribedEvents || [],
    active: wh.active !== false,
    signingSecret: wh.signingSecret || wh.secret || '',
    lastTriggeredAt: wh.lastTriggeredAt,
    consecutiveFailures: wh.consecutiveFailures || 0,
    createdAt: wh.createdAt || String(Math.floor(Date.now() / 1000)),
  }));
}

function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path =
      parsed.pathname.length > 20
        ? parsed.pathname.substring(0, 20) + '...'
        : parsed.pathname;
    return `${parsed.hostname}${path}`;
  } catch {
    return url.substring(0, 30) + '...';
  }
}

function formatDate(timestamp?: string): string {
  if (!timestamp || timestamp === '0') return 'Never';
  const date = new Date(parseInt(timestamp) * 1000);
  return date.toLocaleString();
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function SecretDisplay({ secret }: { secret: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <code className="rounded bg-muted px-2 py-1 text-xs">
        {visible ? secret : '••••••••••••••••'}
      </code>
      <Button variant="ghost" size="sm" onClick={() => setVisible(!visible)}>
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
      {visible && <CopyButton text={secret} />}
    </div>
  );
}

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(
    null
  );
  const [newWebhook, setNewWebhook] = useState({
    url: '',
    events: [] as string[],
    active: true,
  });

  // Fetch webhooks from real API
  const {
    data: webhooks,
    isLoading,
    error,
    refetch,
  } = useQuery<WebhookConfig[], Error>({
    queryKey: ['webhooks', TEST_ORG_ID],
    queryFn: () => fetchWebhooks(TEST_ORG_ID),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Create webhook mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof newWebhook) => {
      console.log('[Webhooks] Creating webhook:', data);
      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE',
          orgId: TEST_ORG_ID,
          url: data.url,
          events: data.events,
        }),
      });
      const result = await response.json();
      console.log('[Webhooks] Create response:', response.status, result);

      if (!response.ok) {
        throw new Error(
          result.error || `Failed to create webhook: ${response.status}`
        );
      }
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setIsCreateOpen(false);
      setNewWebhook({ url: '', events: [], active: true });
      toast({
        title: 'Webhook Created',
        description: data.signingSecret
          ? "Save your signing secret - it won't be shown again!"
          : 'Webhook endpoint registered',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      console.error('[Webhooks] Create error:', error);
      toast({
        title: 'Create Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete webhook mutation
  const deleteMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      console.log('[Webhooks] Deleting webhook:', webhookId);
      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE',
          orgId: TEST_ORG_ID,
          webhookId,
        }),
      });
      const result = await response.json();
      console.log('[Webhooks] Delete response:', response.status, result);

      if (!response.ok) {
        throw new Error(
          result.error || `Failed to delete webhook: ${response.status}`
        );
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast({
        title: 'Webhook Deleted',
        description: 'Endpoint removed',
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      console.error('[Webhooks] Delete error:', error);
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Test webhook mutation
  const testMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      console.log('[Webhooks] Testing webhook:', webhookId);
      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TEST',
          webhookId,
        }),
      });
      const result = await response.json();
      console.log('[Webhooks] Test response:', response.status, result);

      if (!response.ok) {
        throw new Error(result.error || `Test failed: ${response.status}`);
      }
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: 'Test Sent',
        description: `Response: ${data.statusCode || 200} (${data.responseTime || 0}ms)`,
        variant: 'success',
      });
    },
    onError: (error: Error) => {
      console.error('[Webhooks] Test error:', error);
      toast({
        title: 'Test Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleEvent = (eventId: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId],
    }));
  };

  const totalEvents = EVENT_CATEGORIES.reduce(
    (sum, cat) => sum + cat.events.length,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
          <p className="text-muted-foreground">
            Configure event notifications for your organization
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
              <DialogDescription>
                Configure a new webhook endpoint to receive event notifications
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="webhook-url">Endpoint URL</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  placeholder="https://your-server.com/webhooks/ciris"
                  value={newWebhook.url}
                  onChange={(e) =>
                    setNewWebhook({ ...newWebhook, url: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Must be HTTPS. We&apos;ll send POST requests to this URL.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Subscribe to Events</Label>
                <Accordion type="multiple" className="w-full">
                  {EVENT_CATEGORIES.map((category) => (
                    <AccordionItem key={category.name} value={category.name}>
                      <AccordionTrigger className="text-sm">
                        {category.name}
                        <Badge variant="secondary" className="ml-2">
                          {
                            category.events.filter((e) =>
                              newWebhook.events.includes(e.id)
                            ).length
                          }
                          /{category.events.length}
                        </Badge>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pl-1">
                          {category.events.map((event) => (
                            <div
                              key={event.id}
                              className="flex items-start space-x-3"
                            >
                              <Checkbox
                                id={event.id}
                                checked={newWebhook.events.includes(event.id)}
                                onCheckedChange={() => toggleEvent(event.id)}
                              />
                              <div className="grid gap-0.5 leading-none">
                                <Label
                                  htmlFor={event.id}
                                  className="cursor-pointer font-medium"
                                >
                                  {event.label}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  {event.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="webhook-active"
                  checked={newWebhook.active}
                  onCheckedChange={(checked) =>
                    setNewWebhook({ ...newWebhook, active: !!checked })
                  }
                />
                <Label htmlFor="webhook-active">
                  Enable webhook immediately
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate(newWebhook)}
                disabled={
                  !newWebhook.url ||
                  newWebhook.events.length === 0 ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending ? 'Creating...' : 'Create Webhook'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error Banner */}
      {error && <ErrorBanner error={error.message} onRetry={() => refetch()} />}

      {/* Webhooks List */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Webhooks</CardTitle>
          <CardDescription>
            Manage your webhook endpoints and view delivery history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading webhooks...
            </div>
          ) : !webhooks || webhooks.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Webhook className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No webhooks configured</p>
              <p className="text-sm">
                Create a webhook to receive event notifications
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Triggered</TableHead>
                  <TableHead>Failures</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Webhook className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">
                          {maskUrl(webhook.url)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {webhook.subscribedEvents.length} events
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {webhook.active ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(webhook.lastTriggeredAt)}
                    </TableCell>
                    <TableCell>
                      {webhook.consecutiveFailures > 0 ? (
                        <Badge variant="destructive">
                          {webhook.consecutiveFailures}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => testMutation.mutate(webhook.id)}
                          disabled={testMutation.isPending}
                        >
                          <TestTube className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedWebhook(webhook)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(webhook.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Webhook Details Dialog */}
      <Dialog
        open={!!selectedWebhook}
        onOpenChange={() => setSelectedWebhook(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Webhook Details</DialogTitle>
            <DialogDescription>
              {selectedWebhook && maskUrl(selectedWebhook.url)}
            </DialogDescription>
          </DialogHeader>
          {selectedWebhook && (
            <div className="space-y-6 py-4">
              <div>
                <Label className="text-muted-foreground">Full URL</Label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-sm">
                    {selectedWebhook.url}
                  </code>
                  <CopyButton text={selectedWebhook.url} />
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Signing Secret</Label>
                <div className="mt-1">
                  <SecretDisplay secret={selectedWebhook.signingSecret} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use this secret to verify webhook signatures
                </p>
              </div>

              <div>
                <Label className="text-muted-foreground">
                  Subscribed Events
                </Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedWebhook.subscribedEvents.map((event) => (
                    <Badge key={event} variant="secondary">
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">
                  Recent Deliveries
                </Label>
                <div className="mt-2 rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-muted-foreground"
                        >
                          No recent deliveries
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedWebhook(null)}>
              Close
            </Button>
            {selectedWebhook && (
              <Button
                onClick={() => testMutation.mutate(selectedWebhook.id)}
                disabled={testMutation.isPending}
              >
                <TestTube className="mr-2 h-4 w-4" />
                Send Test Event
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Documentation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Webhook Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            All webhook payloads are signed using HMAC-SHA256 with your signing
            secret. Verify the{' '}
            <code className="rounded bg-muted px-1">X-CIRIS-Signature</code>{' '}
            header to ensure the request came from CIRIS.
          </p>
          <div className="rounded-lg bg-muted p-4">
            <pre className="overflow-x-auto text-xs">
              {`const signature = req.headers['x-ciris-signature'];
const timestamp = req.headers['x-ciris-timestamp'];
const payload = JSON.stringify(req.body);
const expected = crypto
  .createHmac('sha256', signingSecret)
  .update(\`\${timestamp}.\${payload}\`)
  .digest('hex');

if (signature !== expected) {
  throw new Error('Invalid signature');
}`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
