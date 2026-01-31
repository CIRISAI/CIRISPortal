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
import {
  Plus,
  Shield,
  Users,
  Search,
  Upload,
  RefreshCw,
  UserPlus,
  UserSearch,
} from 'lucide-react';
import { useSession } from 'next-auth/react';

interface OrgMembership {
  orgId: string;
  orgName: string;
  orgType: string;
  role: string;
  invitedBy?: string;
  createdAtIso?: string;
}

interface OrgUser {
  userId: string;
  orgId: string;
  email: string;
  displayName: string;
  name?: string; // v1.2.0 uses name
  role: string;
  mfaEnabled: boolean;
  active: boolean;
  lastLoginAt: string;
  createdAt: string;
  memberships?: OrgMembership[]; // v1.2.0 multi-org memberships
}

const ROLES = [
  {
    value: 'ORG_ADMIN',
    label: 'Administrator',
    description: 'Full access to all features',
  },
  {
    value: 'ORG_KEY_MANAGER',
    label: 'Key Manager',
    description: 'Manage keys, no user management',
  },
  {
    value: 'ORG_OPERATOR',
    label: 'Operator',
    description: 'View and limited actions',
  },
  { value: 'ORG_VIEWER', label: 'Viewer', description: 'Read-only access' },
];

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case 'ORG_ADMIN':
      return 'destructive';
    case 'ORG_KEY_MANAGER':
      return 'default';
    case 'ORG_OPERATOR':
      return 'secondary';
    default:
      return 'outline';
  }
};

const formatRole = (role: string) => {
  const found = ROLES.find((r) => r.value === role);
  return found?.label || role.replace('ORG_', '');
};

const formatDate = (timestamp: string) => {
  if (!timestamp || timestamp === '0') return 'Never';
  const date = new Date(parseInt(timestamp) * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Get count of other orgs this user belongs to (excluding current org)
const getOtherOrgsCount = (user: OrgUser, currentOrgId?: string) => {
  if (!user.memberships || user.memberships.length <= 1) return 0;
  return user.memberships.filter((m) => m.orgId !== currentOrgId).length;
};

export default function UsersPage() {
  const { data: session } = useSession();
  const orgId = (session?.user as { orgId?: string })?.orgId;

  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'new' | 'existing'>('new');
  const [newUser, setNewUser] = useState({
    email: '',
    display_name: '',
    role: 'ORG_VIEWER',
  });
  const [existingUserSearch, setExistingUserSearch] = useState('');
  const [foundUser, setFoundUser] = useState<OrgUser | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Fetch users with v1.2.0 membership data
  const {
    data: usersData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['users', orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('No organization');
      // TODO: Use members=true when registry implements ListOrgMembers
      const response = await fetch(`/api/registry/users?org_id=${orgId}`);
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    enabled: !!orgId,
  });

  // Search for existing user by email
  const searchExistingUser = async (email: string) => {
    setIsSearching(true);
    setSearchError(null);
    setFoundUser(null);
    try {
      const response = await fetch(
        `/api/registry/users?email=${encodeURIComponent(email)}&org_id=${orgId}`
      );
      const data = await response.json();
      if (data.data) {
        setFoundUser(data.data);
      } else {
        setSearchError('No user found with this email');
      }
    } catch {
      setSearchError('Error searching for user');
    } finally {
      setIsSearching(false);
    }
  };

  // Create user mutation (v1.2.0: creates User + membership)
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      if (!orgId) throw new Error('No organization');
      const response = await fetch('/api/registry/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_with_membership',
          org_id: orgId,
          email: userData.email,
          name: userData.display_name,
          role: userData.role,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreateOpen(false);
      setNewUser({ email: '', display_name: '', role: 'ORG_VIEWER' });
    },
  });

  // Add existing user to org mutation
  const addUserToOrgMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      if (!orgId) throw new Error('No organization');
      const response = await fetch('/api/registry/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_to_org',
          org_id: orgId,
          user_id: userId,
          role,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add user to organization');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreateOpen(false);
      setFoundUser(null);
      setExistingUserSearch('');
      setNewUser({ email: '', display_name: '', role: 'ORG_VIEWER' });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (params: {
      userId: string;
      role?: string;
      active?: boolean;
    }) => {
      if (!orgId) throw new Error('No organization');
      const response = await fetch('/api/registry/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          org_id: orgId,
          user_id: params.userId,
          role: params.role,
          active: params.active,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const users: OrgUser[] = usersData?.data || [];
  const filteredUsers = users.filter(
    (user) =>
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = users.filter((u) => u.active).length;
  const adminCount = users.filter((u) => u.role === 'ORG_ADMIN').length;
  const mfaCount = users.filter((u) => u.mfaEnabled).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage organization users and their access roles
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
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add User to Organization</DialogTitle>
                <DialogDescription>
                  Create a new user or add an existing user to this
                  organization.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Mode Toggle */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={createMode === 'new' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => {
                      setCreateMode('new');
                      setFoundUser(null);
                      setSearchError(null);
                    }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create new user
                  </Button>
                  <Button
                    type="button"
                    variant={createMode === 'existing' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => {
                      setCreateMode('existing');
                    }}
                  >
                    <UserSearch className="mr-2 h-4 w-4" />
                    Add existing user
                  </Button>
                </div>

                {createMode === 'new' ? (
                  <>
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
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Display Name</Label>
                      <Input
                        id="name"
                        placeholder="John Doe"
                        value={newUser.display_name}
                        onChange={(e) =>
                          setNewUser({
                            ...newUser,
                            display_name: e.target.value,
                          })
                        }
                      />
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
                          {ROLES.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {
                          ROLES.find((r) => r.value === newUser.role)
                            ?.description
                        }
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="search-email">Search by Email</Label>
                      <div className="flex gap-2">
                        <Input
                          id="search-email"
                          type="email"
                          placeholder="user@example.com"
                          value={existingUserSearch}
                          onChange={(e) =>
                            setExistingUserSearch(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && existingUserSearch) {
                              e.preventDefault();
                              searchExistingUser(existingUserSearch);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => searchExistingUser(existingUserSearch)}
                          disabled={!existingUserSearch || isSearching}
                        >
                          {isSearching ? 'Searching...' : 'Search'}
                        </Button>
                      </div>
                    </div>

                    {searchError && (
                      <p className="text-sm text-destructive">{searchError}</p>
                    )}

                    {foundUser && (
                      <div className="rounded-lg border bg-muted/50 p-4">
                        <div className="font-medium">
                          {foundUser.displayName ||
                            foundUser.name ||
                            foundUser.email}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {foundUser.email}
                        </div>
                        {foundUser.memberships &&
                          foundUser.memberships.length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              Current memberships:{' '}
                              {foundUser.memberships
                                .map(
                                  (m) => `${m.orgName} (${formatRole(m.role)})`
                                )
                                .join(', ')}
                            </div>
                          )}
                      </div>
                    )}

                    {foundUser && (
                      <div className="space-y-2">
                        <Label htmlFor="existing-role">
                          Role in this organization
                        </Label>
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
                            {ROLES.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setFoundUser(null);
                    setSearchError(null);
                    setExistingUserSearch('');
                    setCreateMode('new');
                  }}
                >
                  Cancel
                </Button>
                {createMode === 'new' ? (
                  <Button
                    onClick={() => createUserMutation.mutate(newUser)}
                    disabled={!newUser.email || createUserMutation.isPending}
                  >
                    {createUserMutation.isPending
                      ? 'Creating...'
                      : 'Create User'}
                  </Button>
                ) : (
                  <Button
                    onClick={() =>
                      foundUser &&
                      addUserToOrgMutation.mutate({
                        userId: foundUser.userId,
                        role: newUser.role,
                      })
                    }
                    disabled={!foundUser || addUserToOrgMutation.isPending}
                  >
                    {addUserToOrgMutation.isPending
                      ? 'Adding...'
                      : 'Add to Organization'}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeCount} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Administrators
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adminCount}</div>
            <p className="text-xs text-muted-foreground">Full access users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">MFA Enabled</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.length > 0
                ? Math.round((mfaCount / users.length) * 100)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">
              {mfaCount} of {users.length} users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Organization Users</CardTitle>
              <CardDescription>
                Users with access to this organization
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="w-[250px] pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading users...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-500">
              Error loading users: {(error as Error).message}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {searchQuery ? 'No users match your search' : 'No users found'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>MFA</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.userId || user.email}>
                    <TableCell className="font-medium">
                      {user.displayName || user.name || '-'}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {formatRole(user.role)}
                        </Badge>
                        {getOtherOrgsCount(user, orgId) > 0 && (
                          <Badge variant="outline" className="text-xs">
                            +{getOtherOrgsCount(user, orgId)} other org
                            {getOtherOrgsCount(user, orgId) > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.mfaEnabled ? (
                        <Badge variant="secondary">
                          <Shield className="mr-1 h-3 w-3" />
                          Enabled
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.active ? 'default' : 'outline'}>
                        {user.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(user.lastLoginAt)}
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
                          {ROLES.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
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
