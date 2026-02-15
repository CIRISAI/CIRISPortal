import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { listPackages } from '@/lib/packages/registry';

/**
 * GET /api/packages
 *
 * List available licensed module packages.
 * Requires NextAuth session (user must be logged in).
 *
 * Returns package metadata (name, description, version, requirements)
 * without source paths or download URLs. Use GET /api/packages/[id]
 * to download a specific package.
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const packages = listPackages();

    return NextResponse.json({
      packages,
      count: packages.length,
    });
  } catch (error) {
    console.error('[Packages] List error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
