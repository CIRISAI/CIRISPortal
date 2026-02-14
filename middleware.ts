import { withAuth } from 'next-auth/middleware';
import { NextRequest, NextResponse } from 'next/server';

// Note: Can't import from lib/env here due to Edge runtime limitations
// APP_ENV is checked at runtime in the auth callbacks instead

// Public API routes that don't require authentication
const PUBLIC_API_ROUTES = [
  '/api/registry/health', // Health check for monitoring
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '?')
  );
}

// Wrap withAuth to allow public routes through
const authMiddleware = withAuth(
  function middleware(req) {
    const response = NextResponse.next();
    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow public routes without token
        if (isPublicRoute(req.nextUrl.pathname)) {
          return true;
        }
        // Token exists = user is authenticated (via OAuth or test credentials)
        return !!token;
      },
    },
    pages: {
      signIn: '/login',
    },
  }
);

export default function middleware(req: NextRequest) {
  return authMiddleware(req as any, {} as any);
}

export const config = {
  matcher: [
    /*
     * Match all dashboard routes
     * This protects all routes under /(dashboard)/*
     */
    '/dashboard/:path*',
    '/organizations/:path*',
    '/partners/:path*',
    '/keys/:path*',
    '/audit/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/webhooks/:path*',
    /*
     * Protect all API routes EXCEPT:
     * - /api/auth/* (NextAuth endpoints must be public, not matched here)
     */
    '/api/admin/:path*',
    '/api/registry/:path*',
    '/api/webhooks/:path*',
  ],
};
