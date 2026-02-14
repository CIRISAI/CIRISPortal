import { NextResponse } from 'next/server';
import { generateComplianceReport } from '@/lib/grpc/client';

/**
 * POST /api/registry/compliance - Generate compliance report
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { org_id, framework, period_start, period_end, sections } = body;

    if (!org_id) {
      return NextResponse.json(
        { error: 'org_id is required' },
        { status: 400 }
      );
    }

    const response = await generateComplianceReport({
      orgId: org_id,
      framework,
      periodStart: period_start,
      periodEnd: period_end,
      sections,
    });

    return NextResponse.json({
      data: response,
      context: response.context,
    });
  } catch (error: unknown) {
    console.error('[API] Compliance report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
