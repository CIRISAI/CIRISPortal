import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
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
