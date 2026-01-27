'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Building2,
  Search,
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  Calendar,
  Activity,
  Shield,
  Key,
} from 'lucide-react';

interface PartnerRecord {
  partnerId: string;
  orgId: string;
  organizationName: string;
  licenseType: string;
  status: string;
  expiresAt: string;
  grantedCapabilities: string[];
  deniedCapabilities: string[];
  createdAt: string;
  lastActivityAt?: string;
}

interface PartnerActivity {
  totalLookups: number;
  recentLookups: number;
  activeAgents: number;
  healthScore: number;
  recommendations: string[];
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  PARTNER_STATUS_ACTIVE: {
    label: 'Active',
    color: 'bg-green-100 text-green-700',
    icon: CheckCircle2,
  },
  PARTNER_STATUS_SUSPENDED: {
    label: 'Suspended',
    color: 'bg-yellow-100 text-yellow-700',
    icon: AlertTriangle,
  },
  PARTNER_STATUS_REVOKED: {
    label: 'Revoked',
    color: 'bg-red-100 text-red-700',
    icon: XCircle,
  },
  PARTNER_STATUS_PENDING: {
    label: 'Pending',
    color: 'bg-blue-100 text-blue-700',
    icon: Clock,
  },
};

const LICENSE_TYPES: Record<string, string> = {
  LICENSE_TRIAL: 'Trial',
  LICENSE_BASIC: 'Basic',
  LICENSE_PROFESSIONAL: 'Professional',
  LICENSE_ENTERPRISE: 'Enterprise',
};

function getDaysRemaining(expiresAt: string): number {
  const expires = parseInt(expiresAt) * 1000;
  const now = Date.now();
  return Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
}

function formatDate(timestamp: string): string {
  if (!timestamp || timestamp === '0') return '-';
  return new Date(parseInt(timestamp) * 1000).toLocaleDateString();
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    color: 'bg-gray-100 text-gray-700',
    icon: AlertTriangle,
  };
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} gap-1`} variant="outline">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function DaysRemainingBadge({ days }: { days: number }) {
  if (days < 0) {
    return <Badge variant="destructive">Expired</Badge>;
  }
  if (days < 7) {
    return <Badge variant="destructive">{days}d</Badge>;
  }
  if (days < 30) {
    return (
      <Badge className="bg-yellow-100 text-yellow-700" variant="outline">
        {days}d
      </Badge>
    );
  }
  if (days < 90) {
    return (
      <Badge className="bg-blue-100 text-blue-700" variant="outline">
        {days}d
      </Badge>
    );
  }
  return <Badge variant="secondary">{days}d</Badge>;
}

export default function AdminPartnersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPartner, setSelectedPartner] = useState<PartnerRecord | null>(
    null
  );

  // Fetch partners
  const {
    data: partnersData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin-partners'],
    queryFn: async () => {
      // Mock data - replace with actual API call
      const partners: PartnerRecord[] = [
        {
          partnerId: 'ptr_001',
          orgId: 'org_acme',
          organizationName: 'Acme Corporation',
          licenseType: 'LICENSE_ENTERPRISE',
          status: 'PARTNER_STATUS_ACTIVE',
          expiresAt: String(Math.floor(Date.now() / 1000) + 86400 * 180),
          grantedCapabilities: [
            'CAP_AGENT_MANAGEMENT',
            'CAP_AUDIT_ACCESS',
            'CAP_USER_MANAGEMENT',
          ],
          deniedCapabilities: [],
          createdAt: String(Math.floor(Date.now() / 1000) - 86400 * 365),
          lastActivityAt: String(Math.floor(Date.now() / 1000) - 3600),
        },
        {
          partnerId: 'ptr_002',
          orgId: 'org_beta',
          organizationName: 'Beta Industries',
          licenseType: 'LICENSE_PROFESSIONAL',
          status: 'PARTNER_STATUS_ACTIVE',
          expiresAt: String(Math.floor(Date.now() / 1000) + 86400 * 15),
          grantedCapabilities: ['CAP_AGENT_MANAGEMENT', 'CAP_AUDIT_ACCESS'],
          deniedCapabilities: [],
          createdAt: String(Math.floor(Date.now() / 1000) - 86400 * 200),
          lastActivityAt: String(Math.floor(Date.now() / 1000) - 86400),
        },
        {
          partnerId: 'ptr_003',
          orgId: 'org_gamma',
          organizationName: 'Gamma Solutions',
          licenseType: 'LICENSE_TRIAL',
          status: 'PARTNER_STATUS_ACTIVE',
          expiresAt: String(Math.floor(Date.now() / 1000) + 86400 * 5),
          grantedCapabilities: ['CAP_AGENT_MANAGEMENT'],
          deniedCapabilities: ['CAP_USER_MANAGEMENT'],
          createdAt: String(Math.floor(Date.now() / 1000) - 86400 * 25),
          lastActivityAt: String(Math.floor(Date.now() / 1000) - 86400 * 3),
        },
        {
          partnerId: 'ptr_004',
          orgId: 'org_delta',
          organizationName: 'Delta Technologies',
          licenseType: 'LICENSE_BASIC',
          status: 'PARTNER_STATUS_SUSPENDED',
          expiresAt: String(Math.floor(Date.now() / 1000) - 86400 * 10),
          grantedCapabilities: ['CAP_AGENT_MANAGEMENT'],
          deniedCapabilities: [],
          createdAt: String(Math.floor(Date.now() / 1000) - 86400 * 100),
        },
      ];
      return { partners };
    },
  });

  const partners = partnersData?.partners || [];

  // Filter partners
  const filteredPartners = partners.filter((partner) => {
    const matchesSearch =
      partner.organizationName
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      partner.partnerId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || partner.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate expiration stats
  const expiringCritical = partners.filter(
    (p) =>
      getDaysRemaining(p.expiresAt) < 7 && getDaysRemaining(p.expiresAt) >= 0
  ).length;
  const expiringWarning = partners.filter(
    (p) =>
      getDaysRemaining(p.expiresAt) >= 7 && getDaysRemaining(p.expiresAt) < 30
  ).length;
  const expired = partners.filter(
    (p) => getDaysRemaining(p.expiresAt) < 0
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Partner Management
          </h1>
          <p className="text-muted-foreground">
            Manage licensed partners and monitor license status
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* License Expiration Dashboard */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className={expired > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${expired > 0 ? 'text-red-600' : ''}`}
            >
              {expired}
            </div>
            <p className="text-xs text-muted-foreground">
              Requires immediate action
            </p>
          </CardContent>
        </Card>
        <Card
          className={expiringCritical > 0 ? 'border-red-200 bg-red-50' : ''}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Expiring &lt; 7 days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${expiringCritical > 0 ? 'text-red-600' : ''}`}
            >
              {expiringCritical}
            </div>
            <p className="text-xs text-muted-foreground">Critical priority</p>
          </CardContent>
        </Card>
        <Card
          className={
            expiringWarning > 0 ? 'border-yellow-200 bg-yellow-50' : ''
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Expiring &lt; 30 days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${expiringWarning > 0 ? 'text-yellow-600' : ''}`}
            >
              {expiringWarning}
            </div>
            <p className="text-xs text-muted-foreground">
              Send renewal reminders
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Partners
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partners.length}</div>
            <p className="text-xs text-muted-foreground">
              {
                partners.filter((p) => p.status === 'PARTNER_STATUS_ACTIVE')
                  .length
              }{' '}
              active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Partners List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Partners</CardTitle>
              <CardDescription>
                All registered partners and their license status
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search partners..."
                  className="w-[250px] pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PARTNER_STATUS_ACTIVE">Active</SelectItem>
                  <SelectItem value="PARTNER_STATUS_SUSPENDED">
                    Suspended
                  </SelectItem>
                  <SelectItem value="PARTNER_STATUS_REVOKED">
                    Revoked
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading partners...
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {searchQuery || statusFilter !== 'all'
                ? 'No partners match your filters'
                : 'No partners found'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Days Left</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPartners.map((partner) => (
                  <TableRow key={partner.partnerId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-muted p-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {partner.organizationName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {partner.partnerId}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {LICENSE_TYPES[partner.licenseType] ||
                          partner.licenseType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={partner.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(partner.expiresAt)}
                    </TableCell>
                    <TableCell>
                      <DaysRemainingBadge
                        days={getDaysRemaining(partner.expiresAt)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPartner(partner)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Partner Details Dialog */}
      <Dialog
        open={!!selectedPartner}
        onOpenChange={() => setSelectedPartner(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedPartner?.organizationName}
            </DialogTitle>
            <DialogDescription>
              Partner ID: {selectedPartner?.partnerId}
            </DialogDescription>
          </DialogHeader>
          {selectedPartner && (
            <div className="space-y-6 py-4">
              {/* Status and License */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Status
                    </span>
                    <StatusBadge status={selectedPartner.status} />
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      License
                    </span>
                    <Badge variant="outline">
                      {LICENSE_TYPES[selectedPartner.licenseType] ||
                        selectedPartner.licenseType}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {formatDate(selectedPartner.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expires</p>
                  <p className="font-medium">
                    {formatDate(selectedPartner.expiresAt)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Activity</p>
                  <p className="font-medium">
                    {formatDate(selectedPartner.lastActivityAt || '0')}
                  </p>
                </div>
              </div>

              {/* Capabilities */}
              <div>
                <p className="mb-2 text-sm font-medium">Granted Capabilities</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPartner.grantedCapabilities.map((cap) => (
                    <Badge
                      key={cap}
                      variant="secondary"
                      className="bg-green-100 text-green-700"
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      {cap.replace('CAP_', '').toLowerCase().replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>

              {selectedPartner.deniedCapabilities.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Denied Capabilities
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedPartner.deniedCapabilities.map((cap) => (
                      <Badge
                        key={cap}
                        variant="secondary"
                        className="bg-red-100 text-red-700"
                      >
                        <XCircle className="mr-1 h-3 w-3" />
                        {cap
                          .replace('CAP_', '')
                          .toLowerCase()
                          .replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex gap-3 border-t pt-4">
                <Button variant="outline" className="gap-2">
                  <Mail className="h-4 w-4" />
                  Send Reminder
                </Button>
                <Button variant="outline" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Extend License
                </Button>
                {selectedPartner.status === 'PARTNER_STATUS_ACTIVE' && (
                  <Button
                    variant="outline"
                    className="gap-2 text-yellow-600 hover:text-yellow-700"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Suspend
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
