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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Shield, Users, RefreshCw, AlertTriangle } from 'lucide-react';

interface SystemUser {
  userId: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt?: string;
  createdAtIso?: string;
}

const SYSTEM_ROLES = [
  {
    value: 'SYSTEM_ADMIN',
    label: 'System Admin',
    description: 'Full system access. Requires @ciris.ai email.',
    requiresCirisEmail: true,
  },
  {
    value: 'SYSTEM_AUDITOR',
    label: 'Auditor',
    description: 'Read-only access across all organizations.',
    requiresCirisEmail: false,
  },
  {
    value: 'WISE_AUTHORITY',
    label: 'Wise Authority',
    description: 'Governance access. Maximum 9 users.',
    requiresCirisEmail: false,
  },
];

const getRoleBadgeClass = (role: string) => {
  switch (role) {
    case 'SYSTEM_ADMIN':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'SYSTEM_AUDITOR':
      return 'bg-teal-100 text-teal-700 border-teal-200';
    case 'WISE_AUTHORITY':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    default:
      return '';
  }
};

const formatRole = (role: string) => {
  const found = SYSTEM_ROLES.find((r) => r.value === role);
  return found?.label || role.replace('SYSTEM_', '');
};

export default function SystemUsersPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    role: 'SYSTEM_AUDITOR',
  });
  const [createError, setCreateError] = useState<string | null>(null);

  // Fetch system users
  const {
    data: usersData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['system-users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/system-users');
      if (!response.ok) throw new Error('Failed to fetch system users');
      return response.json();
    },
  });

  // Create system user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const response = await fetch('/api/admin/system-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...userData,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create system user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
      setIsCreateOpen(false);
      setNewUser({ email: '', name: '', role: 'SYSTEM_AUDITOR' });
      setCreateError(null);
    },
    onError: (err: Error) => {
      setCreateError(err.message);
    },
  });

  // Update system user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (params: {
      userId: string;
      role?: string;
      active?: boolean;
    }) => {
      const response = await fetch('/api/admin/system-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          user_id: params.userId,
          role: params.role,
          active: params.active,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update system user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
    },
  });

  const users: SystemUser[] = usersData?.data || [];
  const adminCount = users.filter((u) => u.role === 'SYSTEM_ADMIN').length;
  const auditorCount = users.filter((u) => u.role === 'SYSTEM_AUDITOR').length;
  const wiseCount = users.filter((u) => u.role === 'WISE_AUTHORITY').length;

  // Check if email is valid for selected role
  const emailValidForRole = () => {
    if (newUser.role === 'SYSTEM_ADMIN') {
      return newUser.email.endsWith('@ciris.ai');
    }
    return true;
  };

  const handleSubmit = () => {
    if (!emailValidForRole()) {
      setCreateError('SYSTEM_ADMIN role requires @ciris.ai email');
      return;
    }
    setCreateError(null);
    createUserMutation.mutate(newUser);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Users</h1>
          <p className="text-muted-foreground">
            Manage global administrators and governance authorities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add System User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create System User</DialogTitle>
                <DialogDescription>
                  Add a new global administrator or governance authority.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {createError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={newUser.name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                  />
                  {newUser.role === 'SYSTEM_ADMIN' &&
                    !newUser.email.endsWith('@ciris.ai') &&
                    newUser.email && (
                      <p className="text-xs text-destructive">
                        SYSTEM_ADMIN requires @ciris.ai email
                      </p>
                    )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value) =>
                      setNewUser({ ...newUser, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {SYSTEM_ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {
                      SYSTEM_ROLES.find((r) => r.value === newUser.role)
                        ?.description
                    }
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setCreateError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    !newUser.email ||
                    !newUser.name ||
                    createUserMutation.isPending ||
                    !emailValidForRole()
                  }
                >
                  {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">System users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">
              System Admins
            </CardTitle>
            <Shield className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adminCount}</div>
            <p className="text-xs text-muted-foreground">Full access</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-teal-700">
              Auditors
            </CardTitle>
            <Shield className="h-4 w-4 text-teal-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{auditorCount}</div>
            <p className="text-xs text-muted-foreground">Read-only access</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-700">
              Wise Authorities
            </CardTitle>
            <Shield className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wiseCount}</div>
            <p className="text-xs text-muted-foreground">Max 9 allowed</p>
          </CardContent>
        </Card>
      </div>

      {/* System Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>System Users</CardTitle>
          <CardDescription>
            Global administrators and governance authorities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading system users...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-500">
              Error loading system users: {(error as Error).message}
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No system users found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.userId || user.email}>
                    <TableCell className="font-medium">
                      {user.name || '-'}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getRoleBadgeClass(user.role)}
                      >
                        {formatRole(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.active ? 'default' : 'outline'}>
                        {user.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={user.role}
                        onValueChange={(value) =>
                          updateUserMutation.mutate({
                            userId: user.userId,
                            role: value,
                          })
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SYSTEM_ROLES.map((role) => (
                            <SelectItem
                              key={role.value}
                              value={role.value}
                              disabled={
                                role.requiresCirisEmail &&
                                !user.email.endsWith('@ciris.ai')
                              }
                            >
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
