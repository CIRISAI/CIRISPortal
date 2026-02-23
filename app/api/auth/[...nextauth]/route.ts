import NextAuth from 'next-auth';
import { getAuthOptions } from '@/lib/auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (...args: any[]) => any;

// Cache the initialized handler — resolves once on first request
let _handler: Handler | null = null;

async function getHandler(): Promise<Handler> {
  if (_handler) return _handler;
  const authOptions = await getAuthOptions();
  _handler = NextAuth(authOptions) as Handler;
  return _handler;
}

// NextAuth(options) returns a handler compatible with App Router exports.
// We wrap it to await the async provider initialization (Apple secret).
export async function GET(
  req: Request,
  ctx: { params: Promise<{ nextauth: string[] }> }
) {
  const handler = await getHandler();
  return handler(req, ctx);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ nextauth: string[] }> }
) {
  const handler = await getHandler();
  return handler(req, ctx);
}
