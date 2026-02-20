/**
 * PostgreSQL client for CIRISPortal.
 *
 * Uses a connection pool for efficient database access.
 * Connection string from DATABASE_URL environment variable.
 */

import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

/**
 * Get the database connection pool.
 * Creates the pool on first call (lazy initialization).
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    pool = new Pool({
      connectionString,
      max: 10, // Maximum connections in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Log connection errors
    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error:', err);
    });
  }

  return pool;
}

/**
 * Execute a query with automatic connection handling.
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(text, params);
  return result.rows as T[];
}

/**
 * Execute a query and return the first row (or undefined).
 */
export async function queryOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

/**
 * Get a client from the pool for transactions.
 */
export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

/**
 * Initialize the database (run migrations, etc.).
 * Called on app startup.
 */
export async function initializeDatabase(): Promise<void> {
  const pool = getPool();

  // Create device_auth_sessions table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS device_auth_sessions (
      device_code TEXT PRIMARY KEY,
      user_code TEXT UNIQUE NOT NULL,
      data JSONB NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_device_auth_user_code
      ON device_auth_sessions(user_code);
    CREATE INDEX IF NOT EXISTS idx_device_auth_expires
      ON device_auth_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_device_auth_stripe_session
      ON device_auth_sessions((data->>'stripeSessionId'));
  `);

  // Create key_activations table for tracking key-agent bindings
  // This is CRITICAL for detecting key reuse across agents
  // Keys are tied to ONE agent instance - reuse is FORBIDDEN
  await pool.query(`
    CREATE TABLE IF NOT EXISTS key_activations (
      id SERIAL PRIMARY KEY,
      public_key_hash TEXT UNIQUE NOT NULL,  -- Hex-encoded Ed25519 public key
      device_code TEXT NOT NULL,             -- Device code from provisioning
      user_code TEXT NOT NULL,               -- Human-readable code
      org_id TEXT NOT NULL,                  -- Organization ID
      key_id TEXT,                           -- CIRISRegistry key ID
      agent_hash TEXT,                       -- Agent binary hash (for audit)
      activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,                -- Set if key is revoked due to reuse
      revocation_reason TEXT                 -- Why key was revoked
    );

    CREATE INDEX IF NOT EXISTS idx_key_activations_pubkey
      ON key_activations(public_key_hash);
    CREATE INDEX IF NOT EXISTS idx_key_activations_org
      ON key_activations(org_id);
    CREATE INDEX IF NOT EXISTS idx_key_activations_device
      ON key_activations(device_code);

    COMMENT ON TABLE key_activations IS
      'Tracks Ed25519 key activations to prevent key reuse across agents. '
      'Keys are tied to ONE agent identity. Reuse is forbidden. '
      'Transferring agent identities to a new device is NOT SUPPORTED YET.';
  `);

  console.log('[DB] Database initialized');
}

/**
 * Cleanup expired sessions.
 * Called periodically or on demand.
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await getPool().query(
    'DELETE FROM device_auth_sessions WHERE expires_at < NOW() RETURNING device_code'
  );
  return result.rowCount || 0;
}

/**
 * Check if database is connected.
 */
export async function isConnected(): Promise<boolean> {
  try {
    await getPool().query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
