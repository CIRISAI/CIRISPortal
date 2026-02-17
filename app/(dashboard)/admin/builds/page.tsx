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
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  Copy,
  FileText,
  Hash,
} from 'lucide-react';
import { toast } from '@/lib/hooks/use-toast';

// Types
interface BuildRecord {
  buildId: string;
  version: string;
  buildHash: string;
  fileManifestHash: string;
  fileManifestCount: number;
  fileManifestJson: Record<string, any>;
  includesModules: string[];
  sourceRepo: string;
  sourceCommit: string;
  registeredAt: number;
  registeredBy: string;
  status: string;
  notes: string;
}

// Available modules
const MODULES = ['core', 'medical', 'legal', 'financial'] as const;

function getStatusBadge(status: string) {
  switch (status?.toLowerCase()) {
    case 'active':
      return (
        <Badge
          variant="outline"
          className="border-green-200 bg-green-50 text-green-700"
        >
          <CheckCircle2 className="mr-1 h-3 w-3" /> Active
        </Badge>
      );
    case 'deprecated':
      return (
        <Badge
          variant="outline"
          className="border-yellow-200 bg-yellow-50 text-yellow-700"
        >
          <AlertTriangle className="mr-1 h-3 w-3" /> Deprecated
        </Badge>
      );
    case 'revoked':
      return (
        <Badge
          variant="outline"
          className="border-red-200 bg-red-50 text-red-700"
        >
          <XCircle className="mr-1 h-3 w-3" /> Revoked
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status || 'Unknown'}</Badge>;
  }
}

function formatDate(timestamp: number | undefined | null): string {
  if (timestamp === undefined || timestamp === null || timestamp <= 0)
    return '-';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast({ title: 'Copied', description: 'Copied to clipboard' });
}

export default function BuildsPage() {
  const queryClient = useQueryClient();
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isViewManifestOpen, setIsViewManifestOpen] = useState(false);
  const [selectedBuild, setSelectedBuild] = useState<BuildRecord | null>(null);
  const [formData, setFormData] = useState({
    version: '',
    buildHash: '',
    fileManifestHash: '',
    fileManifestCount: 0,
    fileManifestJson: '',
    includesModules: ['core'] as string[],
    sourceRepo: '',
    sourceCommit: '',
    notes: '',
  });

  // Fetch builds
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['builds'],
    queryFn: async () => {
      const res = await fetch('/api/admin/builds');
      if (!res.ok) throw new Error('Failed to fetch builds');
      return res.json();
    },
  });

  // Register build mutation
  const registerMutation = useMutation({
    mutationFn: async (buildData: typeof formData) => {
      const res = await fetch('/api/admin/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: buildData.version,
          buildHash: buildData.buildHash,
          fileManifestHash: buildData.fileManifestHash,
          fileManifestCount: buildData.fileManifestCount,
          fileManifestJson: buildData.fileManifestJson,
          includesModules: buildData.includesModules,
          sourceRepo: buildData.sourceRepo || undefined,
          sourceCommit: buildData.sourceCommit || undefined,
          notes: buildData.notes || undefined,
          registeredBy: 'portal-admin',
        }),
      });
      if (!res.ok) throw new Error('Failed to register build');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Build Registered',
        description: 'Build registered successfully',
      });
      setIsRegisterOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['builds'] });
    },
    onError: (err: Error) => {
      toast({
        title: 'Registration Failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  function resetForm() {
    setFormData({
      version: '',
      buildHash: '',
      fileManifestHash: '',
      fileManifestCount: 0,
      fileManifestJson: '',
      includesModules: ['core'],
      sourceRepo: '',
      sourceCommit: '',
      notes: '',
    });
  }

  function handleManifestUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const manifest = JSON.parse(text);

        // Extract manifest data
        const files = manifest.files || {};
        const fileCount = Object.keys(files).length;

        setFormData((prev) => ({
          ...prev,
          fileManifestJson: text,
          fileManifestCount: fileCount,
          fileManifestHash: manifest.manifest_hash || prev.fileManifestHash,
          buildHash: manifest.build_hash || prev.buildHash,
          version: manifest.version || prev.version,
          includesModules: manifest.includes_modules || prev.includesModules,
        }));

        toast({
          title: 'Manifest Loaded',
          description: `Loaded manifest with ${fileCount} files`,
        });
      } catch {
        toast({
          title: 'Invalid Manifest',
          description: 'Could not parse JSON manifest file',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
  }

  function toggleModule(mod: string) {
    setFormData((prev) => ({
      ...prev,
      includesModules: prev.includesModules.includes(mod)
        ? prev.includesModules.filter((m) => m !== mod)
        : [...prev.includesModules, mod],
    }));
  }

  const isFormValid =
    formData.version.trim() !== '' &&
    formData.buildHash.trim() !== '' &&
    formData.fileManifestHash.trim() !== '' &&
    formData.fileManifestCount > 0;

  const builds: BuildRecord[] = data?.builds || [];
  const totalCount = data?.totalCount || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Build Registry</h1>
          <p className="text-gray-500">
            Registered agent builds with Tripwire file integrity manifests
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Register Build
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Register New Build</DialogTitle>
                <DialogDescription>
                  Register a new agent build with its file integrity manifest.
                  Upload a manifest JSON or fill in the fields manually.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Manifest Upload */}
                <div className="rounded-lg border-2 border-dashed border-gray-200 p-4 text-center">
                  <FileText className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">
                    Upload a manifest JSON file to auto-fill fields
                  </p>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleManifestUpload}
                    className="mt-2 text-sm"
                  />
                </div>

                {/* Version */}
                <div className="space-y-2">
                  <Label htmlFor="version">Version *</Label>
                  <Input
                    id="version"
                    placeholder="e.g., 2.0.0"
                    value={formData.version}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        version: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Build Hash */}
                <div className="space-y-2">
                  <Label htmlFor="buildHash">Build Hash (SHA-256) *</Label>
                  <Input
                    id="buildHash"
                    placeholder="SHA-256 hash of concatenated source files"
                    value={formData.buildHash}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        buildHash: e.target.value,
                      }))
                    }
                    className="font-mono text-xs"
                  />
                </div>

                {/* Manifest Hash */}
                <div className="space-y-2">
                  <Label htmlFor="manifestHash">
                    Manifest Hash (SHA-256) *
                  </Label>
                  <Input
                    id="manifestHash"
                    placeholder="SHA-256 hash of the manifest JSON"
                    value={formData.fileManifestHash}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        fileManifestHash: e.target.value,
                      }))
                    }
                    className="font-mono text-xs"
                  />
                </div>

                {/* File Count */}
                <div className="space-y-2">
                  <Label htmlFor="fileCount">File Count</Label>
                  <Input
                    id="fileCount"
                    type="number"
                    value={formData.fileManifestCount}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        fileManifestCount: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>

                {/* Modules */}
                <div className="space-y-2">
                  <Label>Included Modules</Label>
                  <div className="flex flex-wrap gap-2">
                    {MODULES.map((mod) => (
                      <Badge
                        key={mod}
                        variant={
                          formData.includesModules.includes(mod)
                            ? 'default'
                            : 'outline'
                        }
                        className="cursor-pointer select-none"
                        onClick={() => toggleModule(mod)}
                      >
                        {mod}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Source Repo */}
                <div className="space-y-2">
                  <Label htmlFor="sourceRepo">Source Repository</Label>
                  <Input
                    id="sourceRepo"
                    placeholder="e.g., https://github.com/CIRISAI/CIRISAgent"
                    value={formData.sourceRepo}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        sourceRepo: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Source Commit */}
                <div className="space-y-2">
                  <Label htmlFor="sourceCommit">Source Commit</Label>
                  <Input
                    id="sourceCommit"
                    placeholder="Git commit hash"
                    value={formData.sourceCommit}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        sourceCommit: e.target.value,
                      }))
                    }
                    className="font-mono text-xs"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Optional notes about this build"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsRegisterOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => registerMutation.mutate(formData)}
                  disabled={!isFormValid || registerMutation.isPending}
                >
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <Package className="mr-2 h-4 w-4" />
                      Register Build
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Builds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Active Builds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {builds.filter((b) => b.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Latest Version
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {builds.length > 0 ? builds[0].version : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Builds Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Builds</CardTitle>
          <CardDescription>
            All registered agent builds with their file integrity manifests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-500">
              Failed to load builds. Check registry connection.
            </div>
          ) : builds.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              No builds registered yet. Click &quot;Register Build&quot; to add
              one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="pb-3 pr-4">Version</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Modules</th>
                    <th className="pb-3 pr-4">Files</th>
                    <th className="pb-3 pr-4">Build Hash</th>
                    <th className="pb-3 pr-4">Registered</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {builds.map((build) => (
                    <tr key={build.buildId} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <span className="font-mono font-medium">
                          v{build.version}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {getStatusBadge(build.status)}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {(build.includesModules || []).map((mod) => (
                            <Badge
                              key={mod}
                              variant="outline"
                              className="text-xs"
                            >
                              {mod}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-sm">
                        {build.fileManifestCount}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1">
                          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                            {build.buildHash?.substring(0, 12)}...
                          </code>
                          <button
                            onClick={() => copyToClipboard(build.buildHash)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-sm text-gray-500">
                        {formatDate(build.registeredAt)}
                      </td>
                      <td className="py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBuild(build);
                            setIsViewManifestOpen(true);
                          }}
                        >
                          <Hash className="mr-1 h-3 w-3" />
                          View Manifest
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Manifest Dialog */}
      <Dialog open={isViewManifestOpen} onOpenChange={setIsViewManifestOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Build Manifest — v{selectedBuild?.version}
            </DialogTitle>
            <DialogDescription>
              File integrity manifest with per-file SHA-256 hashes
            </DialogDescription>
          </DialogHeader>
          {selectedBuild && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Build Hash</Label>
                  <div className="flex items-center gap-1">
                    <code className="break-all rounded bg-gray-100 px-2 py-1 text-xs">
                      {selectedBuild.buildHash}
                    </code>
                    <button
                      onClick={() => copyToClipboard(selectedBuild.buildHash)}
                    >
                      <Copy className="h-3 w-3 text-gray-400" />
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Manifest Hash</Label>
                  <div className="flex items-center gap-1">
                    <code className="break-all rounded bg-gray-100 px-2 py-1 text-xs">
                      {selectedBuild.fileManifestHash}
                    </code>
                    <button
                      onClick={() =>
                        copyToClipboard(selectedBuild.fileManifestHash)
                      }
                    >
                      <Copy className="h-3 w-3 text-gray-400" />
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">File Count</Label>
                  <p className="font-mono">{selectedBuild.fileManifestCount}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Modules</Label>
                  <div className="flex gap-1">
                    {(selectedBuild.includesModules || []).map((mod) => (
                      <Badge key={mod} variant="outline" className="text-xs">
                        {mod}
                      </Badge>
                    ))}
                  </div>
                </div>
                {selectedBuild.sourceRepo && (
                  <div>
                    <Label className="text-xs text-gray-500">Source Repo</Label>
                    <p className="text-sm">{selectedBuild.sourceRepo}</p>
                  </div>
                )}
                {selectedBuild.sourceCommit && (
                  <div>
                    <Label className="text-xs text-gray-500">
                      Source Commit
                    </Label>
                    <code className="text-xs">
                      {selectedBuild.sourceCommit}
                    </code>
                  </div>
                )}
              </div>

              {/* File manifest preview */}
              <div>
                <Label className="text-xs text-gray-500">
                  File Manifest ({selectedBuild.fileManifestCount} files)
                </Label>
                <div className="mt-1 max-h-96 overflow-y-auto rounded border bg-gray-50 p-3">
                  {selectedBuild.fileManifestJson?.files ? (
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-gray-500">
                          <th className="pb-1 pr-4">File Path</th>
                          <th className="pb-1">SHA-256</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(
                          selectedBuild.fileManifestJson.files as Record<
                            string,
                            string
                          >
                        )
                          .slice(0, 50)
                          .map(([path, hash]) => (
                            <tr key={path} className="border-t border-gray-200">
                              <td className="py-1 pr-4 font-mono text-xs">
                                {path}
                              </td>
                              <td className="py-1 font-mono text-xs text-gray-500">
                                {(hash as string).substring(0, 16)}...
                              </td>
                            </tr>
                          ))}
                        {Object.keys(selectedBuild.fileManifestJson.files || {})
                          .length > 50 && (
                          <tr>
                            <td
                              colSpan={2}
                              className="py-2 text-center text-xs text-gray-400"
                            >
                              ... and{' '}
                              {Object.keys(
                                selectedBuild.fileManifestJson.files || {}
                              ).length - 50}{' '}
                              more files
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No file manifest data available
                    </p>
                  )}
                </div>
              </div>

              {selectedBuild.notes && (
                <div>
                  <Label className="text-xs text-gray-500">Notes</Label>
                  <p className="text-sm">{selectedBuild.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
