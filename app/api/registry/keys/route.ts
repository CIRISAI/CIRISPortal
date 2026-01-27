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
    custodyModel: key.custodyModel,
    status: key.status,
    createdAt: parseInt(key.createdAt) || 0,
    activatedAt: parseInt(key.activatedAt) || 0,
    rotatedAt: parseInt(key.rotatedAt) || 0,
    revokedAt: parseInt(key.revokedAt) || 0,
    gracePeriodExpiresAt: parseInt(key.gracePeriodExpiresAt) || 0,
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
  } catch (error: any) {
    console.error('[API] List keys error:', error.message);
    return NextResponse.json(
      { error: error.message, code: error.code },
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
      case 'generate':
        response = await generateKeyPair({
          orgId: params.org_id,
          requesterUserId: params.requester_user_id,
          activateImmediately: params.activate_immediately,
        });
        break;

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
  } catch (error: any) {
    console.error('[API] Key action error:', error.message);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }
}
