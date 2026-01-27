/**
 * Environment Configuration
 *
 * APP_ENV controls authentication and security requirements:
 * - devtest: Local development with test user bypass (no OAuth required)
 * - stage: Staging environment (OAuth required, but relaxed domain checks)
 * - prod: Production (OAuth required, strict domain validation)
 */

export type AppEnv = 'devtest' | 'stage' | 'prod';

export function getAppEnv(): AppEnv {
  const env = process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV;
  if (env === 'devtest' || env === 'stage' || env === 'prod') {
    return env;
  }
  // Default to prod for safety in unknown environments
  return process.env.NODE_ENV === 'development' ? 'devtest' : 'prod';
}

export function isDevTest(): boolean {
  return getAppEnv() === 'devtest';
}

export function isStage(): boolean {
  return getAppEnv() === 'stage';
}

export function isProd(): boolean {
  return getAppEnv() === 'prod';
}

// Auth requirements per environment
export type AuthConfig = {
  requireOAuth: boolean;
  allowTestUsers: boolean;
  allowedDomains: string[];
  sessionMaxAge: number;
};

export const AUTH_CONFIG: Record<AppEnv, AuthConfig> = {
  devtest: {
    requireOAuth: false,
    allowTestUsers: true,
    allowedDomains: ['*'], // Any domain in devtest
    sessionMaxAge: 30 * 24 * 60 * 60, // 30 days
  },
  stage: {
    requireOAuth: true,
    allowTestUsers: false,
    allowedDomains: ['ciris.ai'], // Restrict to CIRIS domain
    sessionMaxAge: 24 * 60 * 60, // 24 hours
  },
  prod: {
    requireOAuth: true,
    allowTestUsers: false,
    allowedDomains: ['ciris.ai'], // Restrict to CIRIS domain
    sessionMaxAge: 8 * 60 * 60, // 8 hours
  },
};

export function getAuthConfig() {
  return AUTH_CONFIG[getAppEnv()];
}
