import { NextResponse } from 'next/server';
import {
  getByDeviceCode,
  consumeProvisionedKey,
  updateRecord,
} from '@/lib/device-auth/store';
import { isLicensedTemplate } from '@/lib/packages/registry';
import { getRegistrationChallenge } from '@/lib/grpc/client';

/**
 * POST /api/device/token
 *
 * Agent polls this endpoint to check if the user has completed
 * the device auth flow in the browser.
 *
 * SELF-CUSTODY FLOW (recommended):
 * - 428: pending (user hasn't authenticated yet)
 * - 200 status=authorized: user authenticated, agent must register its public key
 * - 200 status=provisioned: key activated, registration complete
 *
 * LEGACY CUSTODIED FLOW (deprecated):
 * - 428: authorization_pending (user hasn't completed yet)
 * - 200: success (key provisioned, one-time delivery with private key)
 *
 * RFC 8628 compliant error responses:
 * - 400: expired_token or invalid grant
 * - 403: access_denied
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
        // User hasn't authenticated yet — keep polling
        return NextResponse.json(
          { error: 'authorization_pending' },
          { status: 428 }
        );

      case 'authorized': {
        // User authenticated and paid — agent must now register its public key
        // SELF-CUSTODY: Agent generates keypair locally, registers PUBLIC KEY only

        // Fetch registration challenge from Registry and store it
        let registrationChallenge: string | undefined;
        if (record.orgId) {
          try {
            const { challenge } = await getRegistrationChallenge({
              orgId: record.orgId,
            });
            registrationChallenge = Buffer.from(challenge).toString('hex');

            // Store challenge in device record for verification in register-key
            await updateRecord(device_code, {
              registrationChallenge,
            });
          } catch (err) {
            console.error(
              '[Device Token] Failed to get registration challenge:',
              err
            );
            // Continue without challenge - register-key will fetch its own
          }
        }

        return NextResponse.json({
          status: 'authorized',
          custody_model: 'SELF_SOVEREIGN',
          next_step: 'register_key',
          device_code: device_code,
          org_id: record.orgId,
          registration_challenge: registrationChallenge,
          agent_record: record.agentRecord
            ? {
                identity_template: record.agentRecord.identityTemplate,
                stewardship_tier: record.agentRecord.stewardshipTier,
                permitted_actions: record.agentRecord.permittedActions,
                approved_adapters: record.agentRecord.approvedAdapters,
              }
            : undefined,
          instructions: {
            step_1:
              'Generate Ed25519 keypair locally (or use CIRISVerify ephemeral key)',
            step_2: 'Sign the registration_challenge with your private key',
            step_3:
              'POST /api/device/register-key with device_code, ed25519_public_key, ed25519_signature',
            step_4:
              'POST /api/device/activate-key with signed activation_challenge',
            note: 'Private key NEVER leaves your device. CIRIS stores only your public key fingerprint.',
          },
        });
      }

      case 'provisioned': {
        // SELF-CUSTODY: Key registered and activated — return confirmation (no private key!)
        if (record.selfCustodyKey) {
          const templateId = record.agentRecord?.identityTemplate;
          return NextResponse.json({
            status: 'provisioned',
            custody_model: 'SELF_SOVEREIGN',
            key_info: {
              key_id: record.selfCustodyKey.keyId,
              public_key_fingerprint:
                record.selfCustodyKey.ed25519PublicKeyFingerprint,
              activated: record.selfCustodyKey.activated,
              org_id: record.orgId,
            },
            agent_record: record.agentRecord
              ? {
                  identity_template: record.agentRecord.identityTemplate,
                  stewardship_tier: record.agentRecord.stewardshipTier,
                  permitted_actions: record.agentRecord.permittedActions,
                  approved_adapters: record.agentRecord.approvedAdapters,
                }
              : undefined,
            portal_url: record.portalUrl,
            licensed_package:
              templateId && isLicensedTemplate(templateId)
                ? {
                    download_url: record.packageDownloadUrl,
                    template_id: templateId,
                  }
                : null,
            message: 'Self-custody key activated. You control the private key.',
          });
        }

        // LEGACY CUSTODIED FLOW: Key is ready — consume it (one-time delivery)
        // This path is deprecated; new agents should use self-custody
        const result = await consumeProvisionedKey(device_code);
        if (!result) {
          return NextResponse.json(
            {
              error: 'expired_token',
              error_description: 'Key already consumed or not provisioned',
            },
            { status: 400 }
          );
        }

        const templateId = result.agentRecord?.identityTemplate;

        return NextResponse.json({
          status: 'provisioned',
          custody_model: 'CUSTODIED',
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
          licensed_package:
            templateId && isLicensedTemplate(templateId)
              ? {
                  download_url: result.packageDownloadUrl,
                  template_id: templateId,
                }
              : null,
          _deprecated:
            'Custodied key delivery is deprecated. Use self-custody flow instead.',
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
