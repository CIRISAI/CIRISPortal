import { NextResponse } from 'next/server';
import { registerBuild, listBuilds, getBuild } from '@/lib/grpc/client';

/**
 * Convert gRPC timestamp (string of unix seconds) to JS milliseconds.
 */
function toMillis(ts: any): number | undefined {
  if (ts === null || ts === undefined || ts === '' || ts === '0')
    return undefined;
  const val = typeof ts === 'number' ? ts : parseInt(ts);
  if (!val || val <= 0) return undefined;
  return val < 1e12 ? val * 1000 : val;
}

/**
 * Transform a build record from gRPC response
 */
function transformBuild(build: any): any {
  if (!build) return build;

  // Decode file_manifest_json from bytes to object
  let manifestJson = {};
  if (build.fileManifestJson) {
    try {
      const raw = build.fileManifestJson;
      if (raw?.type === 'Buffer' && Array.isArray(raw.data)) {
        manifestJson = JSON.parse(Buffer.from(raw.data).toString('utf-8'));
      } else if (Buffer.isBuffer(raw)) {
        manifestJson = JSON.parse(raw.toString('utf-8'));
      } else if (typeof raw === 'string') {
        manifestJson = JSON.parse(raw);
      }
    } catch {
      manifestJson = {};
    }
  }

  return {
    ...build,
    fileManifestJson: manifestJson,
    registeredAt: toMillis(build.registeredAt),
  };
}

/**
 * GET /api/admin/builds - List registered builds
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const pageSize = searchParams.get('page_size');
    const pageToken = searchParams.get('page_token');

    const response = await listBuilds({
      status: status || undefined,
      pageSize: pageSize ? parseInt(pageSize) : 50,
      pageToken: pageToken || undefined,
    });

    return NextResponse.json({
      builds: (response.builds || []).map(transformBuild),
      totalCount: response.totalCount || 0,
      nextPageToken: response.nextPageToken || null,
      context: response.context,
    });
  } catch (error: unknown) {
    console.error('[API] List builds error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/builds - Register a new build
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      version,
      buildHash,
      fileManifestHash,
      fileManifestCount,
      fileManifestJson,
      includesModules,
      sourceRepo,
      sourceCommit,
      registeredBy,
      notes,
    } = body;

    if (!version || !buildHash || !fileManifestHash) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: version, buildHash, fileManifestHash',
        },
        { status: 400 }
      );
    }

    const response = await registerBuild({
      version,
      buildHash,
      fileManifestHash,
      fileManifestCount: fileManifestCount || 0,
      fileManifestJson:
        typeof fileManifestJson === 'string'
          ? fileManifestJson
          : JSON.stringify(fileManifestJson || {}),
      includesModules: includesModules || ['core'],
      sourceRepo,
      sourceCommit,
      registeredBy,
      notes,
    });

    return NextResponse.json({
      success: response.success,
      message: response.message,
      context: response.context,
    });
  } catch (error: unknown) {
    console.error('[API] Register build error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
