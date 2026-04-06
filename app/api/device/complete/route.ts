import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getByUserCode, updateRecord } from '@/lib/device-auth/store';
import { registerAgent } from '@/lib/grpc/client';
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
 * 5. Marks device as authorized for self-custody key registration
 *
 * SELF-CUSTODY MODEL: No keys are generated server-side.
 * After this endpoint returns success, the agent must call
 * POST /api/device/register-key with its locally-generated public key.
 * Private keys NEVER leave the agent device.
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
    const record = await getByUserCode(user_code);
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
          await updateRecord(record.deviceCode, { paymentComplete: true });
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

    // Agent identity ID: for CIRIS agents, use the attested build hash from
    // CIRISVerify (links identity to a verified binary for inspection).
    // For non-CIRIS agents, generate a random identity ID (no build linkage;
    // build inspection is a separate concern handled by the build registry).
    const agentIdentityId =
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
        agentHash: agentIdentityId,
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
      // Continue anyway — self-custody key registration can still proceed
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

    // Mark as authorized with user info and agent metadata
    // SELF-CUSTODY: No keys generated here. Agent will register its public key
    // via /api/device/register-key using the device_code.
    await updateRecord(record.deviceCode, {
      status: 'authorized',
      userId: session.user.email,
      orgId,
      selectedTemplate: template_id,
      selectedAdapters,
      agentRecord: {
        identityTemplate: template_id,
        stewardshipTier: template.tier,
        permittedActions: template.actions,
        approvedAdapters: selectedAdapters,
      },
      agentRecordHash: agentIdentityId,
      packageDownloadUrl,
    });

    console.log(
      `[Device Auth] Authorized ${record.userCode} for self-custody. ` +
        `Agent should call /api/device/register-key with device_code=${record.deviceCode}`
    );

    return NextResponse.json({
      success: true,
      template: template_id,
      adapters: selectedAdapters,
      licensed: isLicensedTemplate(template_id),
      package_download_url: packageDownloadUrl || null,
      custody_model: 'SELF_SOVEREIGN',
      next_step:
        'Agent must call POST /api/device/register-key with its public key',
      device_code: record.deviceCode,
    });
  } catch (error) {
    console.error('[Device Auth] Complete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
