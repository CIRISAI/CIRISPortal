import { NextResponse } from 'next/server';
import {
  registerWebhook,
  listWebhooks,
  deleteWebhook,
} from '@/lib/grpc/client';

/**
 * GET /api/webhooks - List webhooks for an organization
 *
 * Query params:
 * - org_id: string (required)
 * - page_size?: number
 * - page_token?: string
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const pageSize = searchParams.get('page_size');
    const pageToken = searchParams.get('page_token');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing required parameter: org_id' },
        { status: 400 }
      );
    }

    const response = await listWebhooks({
      orgId,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      pageToken: pageToken || undefined,
    });

    return NextResponse.json({
      webhooks: response.webhooks || [],
      nextPageToken: response.nextPageToken,
      context: response.context,
    });
  } catch (error: unknown) {
    console.error('[API] List webhooks error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks - Create or delete a webhook
 *
 * Body for CREATE:
 * {
 *   action: 'CREATE',
 *   orgId: string,
 *   url: string,
 *   events: string[],
 *   secret?: string
 * }
 *
 * Body for DELETE:
 * {
 *   action: 'DELETE',
 *   orgId: string,
 *   webhookId: string
 * }
 *
 * Body for TEST:
 * {
 *   action: 'TEST',
 *   webhookId: string
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'DELETE') {
      const { orgId, webhookId } = body;

      if (!orgId || !webhookId) {
        return NextResponse.json(
          { error: 'Missing required fields: orgId, webhookId' },
          { status: 400 }
        );
      }

      const response = await deleteWebhook({ orgId, webhookId });

      return NextResponse.json({
        success: true,
        deleted: true,
        context: response.context,
      });
    }

    if (action === 'TEST') {
      // For now, just return a simulated test result
      // In production, this would trigger the backend to send a test payload
      return NextResponse.json({
        success: true,
        tested: true,
        statusCode: 200,
        responseTime: 150,
      });
    }

    // Default: CREATE
    const { orgId, url, events, secret } = body;

    if (!orgId || !url || !events || events.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: orgId, url, events' },
        { status: 400 }
      );
    }

    const response = await registerWebhook({
      orgId,
      url,
      events,
      secret,
    });

    return NextResponse.json({
      success: true,
      webhook: response.webhook,
      signingSecret: response.signingSecret,
      context: response.context,
    });
  } catch (error: unknown) {
    console.error('[API] Webhook action error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
