import { NextResponse } from 'next/server';
import { healthCheck } from '@/lib/grpc/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDiagnostics =
      searchParams.get('include_diagnostics') === 'true';

    const response = await healthCheck(includeDiagnostics);
    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('[API] Health check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
