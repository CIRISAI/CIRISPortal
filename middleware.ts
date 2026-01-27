import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Note: Can't import from lib/env here due to Edge runtime limitations
// APP_ENV is checked at runtime in the auth callbacks instead

export default withAuth(
  function middleware(req) {
    // Add environment info to response headers for debugging
    const response = NextResponse.next();
    response.headers.set('x-app-env', process.env.APP_ENV || 'unknown');
    return response;
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // Token exists = user is authenticated (via OAuth or test credentials)
        return !!token;
      },
    },
    pages: {
      signIn: '/login',
    },
  }
);

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
  ],
};
