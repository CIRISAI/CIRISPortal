import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getByUserCode, updateRecord } from '@/lib/device-auth/store';
import { getAllowedTemplates } from '@/lib/device-auth/abac';
import { TEMPLATE_PRESETS } from '@/lib/templates';
import { isStripeConfigured } from '@/lib/stripe/config';
import {
  createActivationCheckout,
  getCustomerByEmail,
  createCustomer,
} from '@/lib/stripe/service';

/**
 * POST /api/device/checkout
 *
 * Saves agent registration selections to the device auth record, then
 * creates a Stripe checkout session for identity activation payment.
 *
 * After payment, Stripe redirects back to /device?code=XXXX&paid=true
 * and the frontend auto-completes provisioning via /api/device/complete.
 *
 * Body: {
 *   user_code: string,
 *   template_id: string,
 *   adapters: string[],
 *   agent_category: 'ciris' | 'non_ciris'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Billing not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { user_code, template_id, adapters, agent_category } = body as {
      user_code: string;
      template_id: string;
      adapters: string[];
      agent_category: 'ciris' | 'non_ciris';
    };

    if (!user_code || !template_id || !agent_category) {
      return NextResponse.json(
        { error: 'user_code, template_id, and agent_category are required' },
        { status: 400 }
      );
    }

    if (agent_category !== 'ciris' && agent_category !== 'non_ciris') {
      return NextResponse.json(
        { error: 'agent_category must be "ciris" or "non_ciris"' },
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
        { error: `Cannot checkout: status is ${record.status}` },
        { status: 409 }
      );
    }

    // Resolve org from session
    const orgId = (session.user as any).orgId;
    if (!orgId) {
      return NextResponse.json(
        { error: 'No organization found for user.' },
        { status: 403 }
      );
    }

    // Verify template is ABAC-allowed
    const allowed = await getAllowedTemplates(orgId, record.nodeManifest);
    if (!allowed.some((t) => t.id === template_id)) {
      return NextResponse.json(
        { error: 'Template not allowed for your organization' },
        { status: 403 }
      );
    }

    const template = TEMPLATE_PRESETS[template_id];
    if (!template) {
      return NextResponse.json({ error: 'Unknown template' }, { status: 400 });
    }

    const selectedAdapters: string[] = adapters || template.adapters;

    // Save selections to device record (persisted across Stripe redirect)
    updateRecord(record.deviceCode, {
      userId: session.user.email,
      orgId,
      selectedTemplate: template_id,
      selectedAdapters,
      agentCategory: agent_category,
    });

    // Get or create Stripe customer
    const email = session.user.email;
    let customer = await getCustomerByEmail(email);
    if (!customer) {
      customer = await createCustomer(
        email,
        session.user.name || undefined,
        'community'
      );
    }

    const baseUrl = request.nextUrl.origin;
    const hardwareKeyHash =
      record.agentInfo.agentHash || `device-auth-${Date.now()}`;

    const checkoutSession = await createActivationCheckout(
      customer.id,
      'community',
      hardwareKeyHash,
      `${baseUrl}/device?code=${encodeURIComponent(user_code)}&paid=true`,
      `${baseUrl}/device?code=${encodeURIComponent(user_code)}&canceled=true`,
      { orgId, userId: session.user.email, agentCategory: agent_category }
    );

    // Store Stripe session ID on the device record
    updateRecord(record.deviceCode, {
      stripeSessionId: checkoutSession.id,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('[Device Checkout] Error:', error);
    const message = error instanceof Error ? error.message : 'Checkout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
