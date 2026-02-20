import { NextResponse } from 'next/server';
import {
  getByDeviceCode,
  consumeProvisionedKey,
} from '@/lib/device-auth/store';
import { isLicensedTemplate } from '@/lib/packages/registry';

/**
 * POST /api/device/token
 *
 * Agent polls this endpoint to check if the user has completed
 * the device auth flow in the browser. Returns the provisioned
 * signing key once the user selects a template and confirms.
 *
 * RFC 8628 compliant responses:
 * - 428: authorization_pending (user hasn't completed yet)
 * - 200: success (key provisioned, one-time delivery)
 * - 400: expired_token or invalid grant
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { device_code } = body;

    if (!device_code) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'device_code is required',
        },
        { status: 400 }
      );
    }

    const record = await getByDeviceCode(device_code);

    if (!record) {
      return NextResponse.json(
        {
          error: 'expired_token',
          error_description: 'Device code expired or invalid',
        },
        { status: 400 }
      );
    }

    switch (record.status) {
      case 'pending':
      case 'authorized':
        // User hasn't completed yet — keep polling
        return NextResponse.json(
          { error: 'authorization_pending' },
          { status: 428 }
        );

      case 'provisioned': {
        // Key is ready — consume it (one-time delivery)
        const result = await consumeProvisionedKey(device_code);
        if (!result) {
          return NextResponse.json(
            {
              error: 'expired_token',
              error_description: 'Key already consumed',
            },
            { status: 400 }
          );
        }

        const templateId = result.agentRecord?.identityTemplate;

        return NextResponse.json({
          status: 'provisioned',
          signing_key: {
            ed25519_private_key: result.key.ed25519PrivateKey,
            ed25519_public_key: result.key.ed25519PublicKey,
            key_id: result.key.keyId,
            org_id: result.key.orgId,
          },
          agent_record: result.agentRecord
            ? {
                identity_template: result.agentRecord.identityTemplate,
                stewardship_tier: result.agentRecord.stewardshipTier,
                permitted_actions: result.agentRecord.permittedActions,
                approved_adapters: result.agentRecord.approvedAdapters,
              }
            : undefined,
          portal_url: result.portalUrl,
          // Licensed package info — agent downloads this zip after provisioning
          licensed_package:
            templateId && isLicensedTemplate(templateId)
              ? {
                  download_url: result.packageDownloadUrl,
                  template_id: templateId,
                }
              : null,
        });
      }

      case 'denied':
        return NextResponse.json(
          {
            error: 'access_denied',
            error_description: 'User denied the request',
          },
          { status: 403 }
        );

      case 'expired':
        return NextResponse.json(
          { error: 'expired_token', error_description: 'Device code expired' },
          { status: 400 }
        );

      default:
        return NextResponse.json({ error: 'server_error' }, { status: 500 });
    }
  } catch (error) {
    console.error('[Device Auth] Token error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
