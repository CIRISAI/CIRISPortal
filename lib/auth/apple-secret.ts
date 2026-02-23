/**
 * Generate Apple client secret JWT using Web Crypto API.
 * Compatible with Cloudflare Workers (no Node crypto dependency).
 *
 * Apple requires the client_secret to be a JWT signed with ES256
 * using the private key (.p8) from the Apple Developer Console.
 * The JWT is valid for up to 6 months.
 */

/** Base64url encode a buffer */
function base64url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Import a PEM-encoded PKCS#8 private key for ES256 signing */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Strip PEM headers and whitespace, decode base64
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binaryString = atob(pemBody);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

/**
 * Generate an Apple client secret JWT.
 * Valid for 180 days (Apple's maximum).
 */
export async function generateAppleClientSecret(opts: {
  teamId: string;
  clientId: string;
  keyId: string;
  privateKey: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'ES256',
    kid: opts.keyId,
  };

  const payload = {
    iss: opts.teamId,
    iat: now,
    exp: now + 86400 * 180, // 6 months
    aud: 'https://appleid.apple.com',
    sub: opts.clientId,
  };

  const encodedHeader = base64url(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const encodedPayload = base64url(
    new TextEncoder().encode(JSON.stringify(payload))
  );

  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Handle newlines that may be escaped in env vars
  const pemKey = opts.privateKey.replace(/\\n/g, '\n');
  const key = await importPrivateKey(pemKey);

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput)
  );

  // Convert DER signature to raw r||s format expected by JWS
  const rawSignature = derToRaw(new Uint8Array(signature));

  return `${signingInput}.${base64url(rawSignature)}`;
}

/**
 * Convert a DER-encoded ECDSA signature to raw r||s format.
 * Web Crypto may return either format depending on the platform.
 */
function derToRaw(der: Uint8Array): Uint8Array {
  // If already 64 bytes, it's already raw format
  if (der.length === 64) return der;

  // DER format: 0x30 <len> 0x02 <rlen> <r> 0x02 <slen> <s>
  if (der[0] !== 0x30) return der; // Not DER, return as-is

  let offset = 2; // skip 0x30 and total length

  // Read r
  if (der[offset] !== 0x02) return der;
  offset++;
  const rLen = der[offset];
  offset++;
  let r = der.slice(offset, offset + rLen);
  offset += rLen;

  // Read s
  if (der[offset] !== 0x02) return der;
  offset++;
  const sLen = der[offset];
  offset++;
  let s = der.slice(offset, offset + sLen);

  // Pad or trim to 32 bytes each
  if (r.length > 32) r = r.slice(r.length - 32);
  if (s.length > 32) s = s.slice(s.length - 32);

  const raw = new Uint8Array(64);
  raw.set(r, 32 - r.length);
  raw.set(s, 64 - s.length);
  return raw;
}

// Cache the generated secret (valid for 180 days, regenerate after 170)
let _cachedSecret: string | null = null;
let _cachedAt = 0;
const CACHE_DURATION_MS = 170 * 86400 * 1000; // 170 days

/**
 * Get or generate the Apple client secret.
 * Caches the result to avoid regenerating on every request.
 * Returns empty string if Apple env vars are not configured.
 */
export async function getAppleClientSecret(): Promise<string> {
  const teamId = process.env.APPLE_TEAM_ID;
  const clientId = process.env.APPLE_CLIENT_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;

  if (!teamId || !clientId || !keyId || !privateKey) {
    return '';
  }

  if (_cachedSecret && Date.now() - _cachedAt < CACHE_DURATION_MS) {
    return _cachedSecret;
  }

  _cachedSecret = await generateAppleClientSecret({
    teamId,
    clientId,
    keyId,
    privateKey,
  });
  _cachedAt = Date.now();

  return _cachedSecret;
}
