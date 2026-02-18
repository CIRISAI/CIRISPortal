import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getByUserCode,
  updateRecord,
  completeProvisioning,
} from '@/lib/device-auth/store';
import { registerAgent, generateKeyPair } from '@/lib/grpc/client';
import { getAllowedTemplates } from '@/lib/device-auth/abac';
import { TEMPLATE_PRESETS } from '@/lib/templates';
import {
  isLicensedTemplate,
  getPackageForTemplate,
} from '@/lib/packages/registry';
import { verifyCheckoutSession } from '@/lib/stripe/verify';
import crypto from 'crypto';

/**
 * POST /api/device/complete
 *
 * Called by the Portal UI after the user authenticates, selects a
 * template + adapters, and completes payment. This endpoint:
 * 1. Validates the user owns the session (NextAuth)
 * 2. Verifies payment was completed (device record has paymentComplete flag)
 * 3. Verifies the selected template is ABAC-allowed
 * 4. Registers the agent in CIRISRegistry (CIRIS or non-CIRIS type)
 * 5. Generates a signing keypair via CIRISRegistry
 * 6. Stores the provisioned key for agent polling
 *
 * Requires NextAuth session (user must be logged in via OAuth).
 * Requires prior payment via /api/device/checkout → Stripe.
 */
export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { user_code } = body;
    // template_id and adapters can come from body or from saved device record
    let { template_id, adapters } = body;

    if (!user_code) {
      return NextResponse.json(
        { error: 'user_code is required' },
        { status: 400 }
      );
    }

    // Look up device auth record
    const record = getByUserCode(user_code);
    if (!record) {
      return NextResponse.json(
        { error: 'Invalid or expired device code' },
        { status: 404 }
      );
    }

    if (record.status !== 'pending' && record.status !== 'authorized') {
      return NextResponse.json(
        { error: `Cannot complete: status is ${record.status}` },
        { status: 409 }
      );
    }

    // Require payment before provisioning.
    // The webhook may not have arrived yet, so check Stripe directly as fallback.
    if (!record.paymentComplete) {
      if (record.stripeSessionId) {
        const paid = await verifyCheckoutSession(record.stripeSessionId);
        if (paid) {
          updateRecord(record.deviceCode, { paymentComplete: true });
        } else {
          return NextResponse.json(
            {
              error:
                'Payment not yet completed. Please complete checkout first.',
            },
            { status: 402 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Payment required. Complete checkout before provisioning.' },
          { status: 402 }
        );
      }
    }

    // CIRIS agents must complete attestation before provisioning.
    // Non-CIRIS agents skip attestation (they don't run CIRISVerify).
    if (record.agentCategory !== 'non_ciris' && !record.attestationVerified) {
      return NextResponse.json(
        {
          error:
            'Attestation required for CIRIS agents. ' +
            'Submit CIRISVerify attestation proof via POST /api/device/attest first.',
        },
        { status: 428 }
      );
    }

    // Use saved selections from device record (set during checkout) if not in body
    template_id = template_id || record.selectedTemplate;
    adapters = adapters || record.selectedAdapters;

    if (!template_id) {
      return NextResponse.json(
        {
          error:
            'template_id is required (not found in request or device record)',
        },
        { status: 400 }
      );
    }

    // Resolve user's org from session (set by JWT callback during login)
    const orgId = (session.user as any).orgId || record.orgId;
    if (!orgId) {
      return NextResponse.json(
        {
          error:
            'No organization found for user. Please contact an administrator.',
        },
        { status: 403 }
      );
    }

    // Verify template is allowed by ABAC
    const allowed = await getAllowedTemplates(orgId, record.nodeManifest);
    const isAllowed = allowed.some((t) => t.id === template_id);
    if (!isAllowed) {
      return NextResponse.json(
        {
          error: 'Template not allowed',
          allowed_templates: allowed.map((t) => t.id),
        },
        { status: 403 }
      );
    }

    const template = TEMPLATE_PRESETS[template_id];
    if (!template) {
      return NextResponse.json({ error: 'Unknown template' }, { status: 400 });
    }

    const selectedAdapters: string[] = adapters || template.adapters;

    // Mark as authorized with user info
    updateRecord(record.deviceCode, {
      status: 'authorized',
      userId: session.user.email,
      orgId,
      selectedTemplate: template_id,
      selectedAdapters,
    });

    // Use attested agent hash if available (from CIRISVerify attestation),
    // otherwise fall back to random hash for non-CIRIS agents.
    const agentHashHex =
      record.agentInfo?.agentHash && record.agentInfo.agentHash.length === 64
        ? record.agentInfo.agentHash
        : crypto.randomBytes(32).toString('hex');

    // Use agent category from device record to set agent type
    const agentType =
      record.agentCategory === 'non_ciris'
        ? 'AGENT_TYPE_CUSTOM'
        : 'AGENT_TYPE_CIRISCARE';

    try {
      // Register agent in CIRISRegistry
      await registerAgent({
        agentHash: agentHashHex,
        agentType,
        version: { major: 1, minor: 0, patch: 0 },
        capabilities: template.actions,
        identityTemplate: template_id,
        stewardshipTier: template.tier,
        permittedActions: template.actions,
        approvedAdapters: selectedAdapters,
        orgId,
      });
    } catch (regError: any) {
      console.error('[Device Auth] Agent registration failed:', regError);
      console.error(
        '[Device Auth] Registration error details:',
        regError?.message,
        'code:',
        regError?.code
      );
      // Continue anyway — key generation is more important
      // TODO: Make this atomic (register + key gen in one gRPC call)
    }

    // Generate signing keypair via Registry
    let keyData;
    try {
      keyData = await generateKeyPair({
        orgId,
        requesterUserId: session.user.email,
        activateImmediately: true,
      });
    } catch (keyError: any) {
      console.error('[Device Auth] Key generation failed:', keyError);
      updateRecord(record.deviceCode, { status: 'denied' });
      return NextResponse.json(
        {
          error: 'Key generation failed',
          details: keyError?.message || String(keyError),
          code: keyError?.code,
          grpc_url:
            process.env.REGISTRY_GRPC_URL || 'localhost:50052 (default)',
        },
        { status: 500 }
      );
    }

    // Extract key material from response
    const privateKeyBytes =
      keyData.ed25519PrivateKey || keyData.ed25519_private_key;
    const publicKeyBytes = keyData.keyRecord?.publicKeys?.ed25519PublicKey;
    const keyId = keyData.keyRecord?.keyId || '';

    function toBase64(value: any): string {
      if (value?.type === 'Buffer' && Array.isArray(value.data)) {
        return Buffer.from(value.data).toString('base64');
      }
      if (Buffer.isBuffer(value)) {
        return value.toString('base64');
      }
      if (typeof value === 'string') return value;
      return '';
    }

    // Build package download URL for licensed templates
    let packageDownloadUrl: string | undefined;
    if (isLicensedTemplate(template_id)) {
      const packageId = getPackageForTemplate(template_id);
      if (packageId) {
        // Construct absolute URL for the package download endpoint
        const origin = new URL(request.url).origin;
        packageDownloadUrl = `${origin}/api/packages/${packageId}`;
      }
    }

    // Complete provisioning — next agent poll will get the key
    completeProvisioning(
      record.deviceCode,
      {
        ed25519PrivateKey: toBase64(privateKeyBytes),
        ed25519PublicKey: toBase64(publicKeyBytes),
        keyId,
        orgId,
        agentRecordHash: agentHashHex,
      },
      {
        identityTemplate: template_id,
        stewardshipTier: template.tier,
        permittedActions: template.actions,
        approvedAdapters: selectedAdapters,
      }
    );

    // Set package download URL on the record if applicable
    if (packageDownloadUrl) {
      updateRecord(record.deviceCode, { packageDownloadUrl });
    }

    return NextResponse.json({
      success: true,
      template: template_id,
      adapters: selectedAdapters,
      licensed: isLicensedTemplate(template_id),
      package_download_url: packageDownloadUrl || null,
    });
  } catch (error) {
    console.error('[Device Auth] Complete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
