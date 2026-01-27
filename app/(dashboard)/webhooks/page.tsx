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
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { TEST_ORG_ID } from '@/lib/test-config';

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

  // Fetch webhooks (mock data for now)
  const { data: webhooks, isLoading } = useQuery<WebhookConfig[]>({
    queryKey: ['webhooks', TEST_ORG_ID],
    queryFn: async () => {
      // Mock data - replace with actual API call
      return [
        {
          id: 'wh_1',
          url: 'https://api.example.com/webhooks/ciris',
          subscribedEvents: ['key.generated', 'key.rotated', 'key.revoked'],
          active: true,
          signingSecret: 'whsec_abc123xyz789',
          lastTriggeredAt: String(Math.floor(Date.now() / 1000) - 3600),
          consecutiveFailures: 0,
          createdAt: String(Math.floor(Date.now() / 1000) - 86400 * 30),
        },
        {
          id: 'wh_2',
          url: 'https://slack.com/api/webhooks/T123/B456/abcdef',
          subscribedEvents: ['emergency.shutdown', 'emergency.cleared'],
          active: true,
          signingSecret: 'whsec_def456abc123',
          lastTriggeredAt: undefined,
          consecutiveFailures: 0,
          createdAt: String(Math.floor(Date.now() / 1000) - 86400 * 7),
        },
      ];
    },
  });

  // Create webhook mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof newWebhook) => {
      // TODO: Call actual API
      console.log('Creating webhook:', data);
      return {
        id: 'wh_new',
        ...data,
        signingSecret: 'whsec_new123',
        consecutiveFailures: 0,
        createdAt: String(Date.now() / 1000),
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setIsCreateOpen(false);
      setNewWebhook({ url: '', events: [], active: true });
    },
  });

  // Delete webhook mutation
  const deleteMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      // TODO: Call actual API
      console.log('Deleting webhook:', webhookId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });

  // Test webhook mutation
  const testMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      // TODO: Call actual API
      console.log('Testing webhook:', webhookId);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true };
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
