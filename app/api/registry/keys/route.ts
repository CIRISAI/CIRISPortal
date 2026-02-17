import { NextResponse } from 'next/server';
import {
  listKeys,
  generateKeyPair,
  activateKey,
  rotateKey,
  revokeKey,
} from '@/lib/grpc/client';

/**
 * Convert Buffer data to base64 string
 */
function bufferToBase64(value: any): string {
  if (value?.type === 'Buffer' && Array.isArray(value.data)) {
    return Buffer.from(value.data).toString('base64');
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('base64');
  }
  return value;
}

/**
 * Normalize gRPC string enum to numeric KeyStatus value.
 * proto-loader with `enums: String` returns e.g. "KEY_ACTIVE" not 1.
 */
function normalizeKeyStatus(status: any): number {
  if (typeof status === 'number') return status;
  const mapping: Record<string, number> = {
    KEY_STATUS_UNSPECIFIED: 0,
    KEY_ACTIVE: 1,
    KEY_ROTATED: 2,
    KEY_REVOKED: 3,
    KEY_PENDING: 4,
    KEY_ESCROWED: 5,
  };
  return mapping[String(status)] ?? 0;
}

/**
 * Normalize gRPC string enum to numeric KeyCustodyModel value.
 */
function normalizeCustodyModel(model: any): number {
  if (typeof model === 'number') return model;
  const mapping: Record<string, number> = {
    KEY_CUSTODY_UNSPECIFIED: 0,
    CUSTODIED: 1,
    SELF_SOVEREIGN: 2,
  };
  return mapping[String(model)] ?? 0;
}

/**
 * Convert gRPC timestamp (string of unix seconds) to JS milliseconds.
 * Returns undefined for empty/zero timestamps so the UI shows '-'.
 */
function toMillis(ts: any): number | undefined {
  if (ts === null || ts === undefined || ts === '' || ts === '0')
    return undefined;
  const val = typeof ts === 'number' ? ts : parseInt(ts);
  if (!val || val <= 0) return undefined;
  // Unix seconds are < 1e12, JS milliseconds are >= 1e12
  return val < 1e12 ? val * 1000 : val;
}

/**
 * Transform key record to ensure proper encoding
 */
function transformKeyRecord(key: any): any {
  if (!key) return key;
  return {
    ...key,
    publicKeys: key.publicKeys
      ? {
          ed25519PublicKey: bufferToBase64(key.publicKeys.ed25519PublicKey),
          mlDsa65PublicKey: bufferToBase64(
            key.publicKeys.mlDsa_65PublicKey || key.publicKeys.mlDsa65PublicKey
          ),
        }
      : undefined,
    ed25519Fingerprint: key.ed25519Fingerprint,
    mlDsa65Fingerprint: key.mlDsa_65Fingerprint || key.mlDsa65Fingerprint,
    custodyModel: normalizeCustodyModel(key.custodyModel),
    status: normalizeKeyStatus(key.status),
    createdAt: toMillis(key.createdAt),
    activatedAt: toMillis(key.activatedAt),
    rotatedAt: toMillis(key.rotatedAt),
    revokedAt: toMillis(key.revokedAt),
    gracePeriodExpiresAt: toMillis(key.gracePeriodExpiresAt),
  };
}

/**
 * GET /api/registry/keys - List keys for an organization
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    if (!orgId) {
      return NextResponse.json(
        { error: 'org_id is required' },
        { status: 400 }
      );
    }

    const response = await listKeys({
      orgId,
      includeRevoked: searchParams.get('include_revoked') === 'true',
      pageSize: searchParams.get('page_size')
        ? parseInt(searchParams.get('page_size')!)
        : undefined,
      pageToken: searchParams.get('page_token') || undefined,
    });

    // Transform response to match SDK expected format
    return NextResponse.json({
      data: (response.keys || []).map(transformKeyRecord),
      totalCount: response.totalCount,
      nextPageToken: response.nextPageToken,
      context: response.context,
    });
  } catch (error: unknown) {
    console.error('[API] List keys error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/registry/keys - Generate, activate, rotate, or revoke keys
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    let response;
    switch (action) {
      case 'generate': {
        const genResponse = await generateKeyPair({
          orgId: params.org_id,
          requesterUserId: params.requester_user_id,
          activateImmediately: params.activate_immediately,
        });
        // Include the one-time private key (base64) in the response
        const privateKeyBytes =
          genResponse.ed25519PrivateKey || genResponse.ed25519_private_key;
        response = {
          ...genResponse,
          ed25519PrivateKey: privateKeyBytes
            ? bufferToBase64(privateKeyBytes)
            : undefined,
          keyRecord: transformKeyRecord(
            genResponse.keyRecord || genResponse.key_record
          ),
        };
        break;
      }

      case 'activate':
        response = await activateKey({
          orgId: params.org_id,
          keyId: params.key_id,
          requesterUserId: params.requester_user_id,
        });
        break;

      case 'rotate':
        response = await rotateKey({
          orgId: params.org_id,
          requesterUserId: params.requester_user_id,
          reason: params.reason,
          mode: params.mode,
          gracePeriodHours: params.grace_period_hours,
        });
        break;

      case 'revoke':
        response = await revokeKey({
          orgId: params.org_id,
          keyId: params.key_id,
          requesterUserId: params.requester_user_id,
          reason: params.reason,
        });
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('[API] Key action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
