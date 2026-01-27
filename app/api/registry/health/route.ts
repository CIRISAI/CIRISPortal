import { NextResponse } from 'next/server';
import { healthCheck } from '@/lib/grpc/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDiagnostics =
      searchParams.get('include_diagnostics') === 'true';

    const response = await healthCheck(includeDiagnostics);
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API] Health check error:', error.message);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }
}
