import type { NextAuthOptions, User } from 'next-auth';
import { getServerSession as getNextAuthServerSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getAppEnv, getAuthConfig } from '../env';
import { TEST_ORG_ID, TEST_SECONDARY_ORG_ID } from '../test-config';
import {
  provisionUser,
  checkUserExists,
  ProvisioningError,
  type UserRole,
  type ProvisionedUser,
} from './user-provisioning';
import { createAuditEntry } from '../grpc/client';

// AuditActionType enum values from proto
const AUDIT_USER_LOGIN = 13;

// Re-export types
export type { UserRole, ProvisionedUser };

/**
 * Lazy validation that NEXTAUTH_SECRET is set in non-devtest environments.
 * Called on first auth request, NOT at module load time (would break `npm run build`).
 */
let _nextAuthSecretValidated = false;
function validateNextAuthSecret(): void {
  if (_nextAuthSecretValidated) return;
  _nextAuthSecretValidated = true;

  if (process.env.APP_ENV !== 'devtest' && !process.env.NEXTAUTH_SECRET) {
    throw new Error(
      'NEXTAUTH_SECRET must be set in production/staging. ' +
        'Refusing to start without a session signing secret.'
    );
  }
}

/**
 * Test user password — loaded from environment variable (dev-only).
 * Never hardcode credentials in source; set TEST_USER_PASSWORD in .env.local for devtest.
 */
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || '';

/**
 * Test users available in devtest environment
 */
const TEST_USERS: Record<
  string,
  User & { password: string; orgId: string; role: UserRole }
> = {
  'admin@qa-primary.test': {
    id: 'test-admin-1',
    email: 'admin@qa-primary.test',
    name: 'QA Admin User',
    image: null,
    password: TEST_PASSWORD,
    orgId: TEST_ORG_ID,
    role: 'admin',
  },
  'user@qa-primary.test': {
    id: 'test-user-1',
    email: 'user@qa-primary.test',
    name: 'QA Regular User',
    image: null,
    password: TEST_PASSWORD,
    orgId: TEST_ORG_ID,
    role: 'licensee',
  },
  'partner@qa-primary.test': {
    id: 'test-partner-1',
    email: 'partner@qa-primary.test',
    name: 'QA Partner Admin',
    image: null,
    password: TEST_PASSWORD,
    orgId: TEST_ORG_ID,
    role: 'partner',
  },
  'admin@qa-secondary.test': {
    id: 'test-admin-2',
    email: 'admin@qa-secondary.test',
    name: 'QA Secondary Admin',
    image: null,
    password: TEST_PASSWORD,
    orgId: TEST_SECONDARY_ORG_ID,
    role: 'admin',
  },
};

/**
 * Build providers based on environment
 */
function buildProviders() {
  // Validate NEXTAUTH_SECRET on first auth request (not at build time)
  validateNextAuthSecret();

  const providers = [];
  const authConfig = getAuthConfig();
  const appEnv = getAppEnv();

  // Always add Google OAuth (may not be configured in devtest)
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    })
  );

  // Add test user credentials provider in devtest
  if (authConfig.allowTestUsers) {
    providers.push(
      CredentialsProvider({
        id: 'test-credentials',
        name: 'Test User',
        credentials: {
          email: {
            label: 'Email',
            type: 'email',
            placeholder: 'admin@qa-primary.test',
          },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          // Only allow in devtest
          if (appEnv !== 'devtest') {
            return null;
          }

          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const testUser = TEST_USERS[credentials.email];
          if (!testUser) {
            return null;
          }

          // Simple password check for test users
          if (credentials.password !== testUser.password) {
            return null;
          }

          return {
            id: testUser.id,
            email: testUser.email,
            name: testUser.name,
            image: testUser.image,
          };
        },
      })
    );
  }

  return providers;
}

/**
 * Provision user - requires registry to be available
 * No fallbacks - using incorrect org IDs breaks all subsequent queries
 */
async function safeProvisionUser(
  email: string,
  name: string,
  provider: string
): Promise<ProvisionedUser> {
  try {
    return await provisionUser(email, name, provider);
  } catch (error) {
    if (error instanceof ProvisioningError) {
      console.error(
        `[Auth] Provisioning error (${error.code}): ${error.message}`
      );
    } else {
      console.error('[Auth] Unknown provisioning error:', error);
    }
    // Always re-throw - no fallbacks allowed
    throw error;
  }
}

export const authOptions: NextAuthOptions = {
  providers: buildProviders(),
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: getAuthConfig().sessionMaxAge,
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        token.accessToken = account.access_token;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;

        // Check for test users first
        const testUser = TEST_USERS[user.email ?? ''];
        if (testUser) {
          token.userId = testUser.id;
          token.orgId = testUser.orgId;
          token.orgName = 'Test Organization';
          token.role = testUser.role;
          console.log(
            `[Auth] Test user login: ${user.email} as ${testUser.role}`
          );

          // Record audit entry for test user login (fire and forget)
          createAuditEntry({
            action: AUDIT_USER_LOGIN,
            actorUserId: testUser.id,
            actorOrgId: testUser.orgId,
            description: `Test user login: ${user.email}`,
            metadata: {
              provider: account.provider,
              role: testUser.role,
            },
          }).catch((err) => {
            console.warn('[Auth] Failed to record login audit entry:', err);
          });
        } else if (user.email) {
          // OAuth users: provision via registry
          try {
            const provisionedUser = await safeProvisionUser(
              user.email,
              user.name || user.email.split('@')[0],
              account.provider
            );

            token.userId = provisionedUser.userId;
            token.orgId = provisionedUser.orgId;
            token.orgName = provisionedUser.orgName;
            token.role = provisionedUser.role;

            console.log(
              `[Auth] OAuth user login: ${user.email} as ${provisionedUser.role} in ${provisionedUser.orgId}`
            );

            if (provisionedUser.isNewUser) {
              console.log(`[Auth] New user created: ${user.email}`);
            }
            if (provisionedUser.isNewOrg) {
              console.log(`[Auth] New org created: ${provisionedUser.orgId}`);
            }

            // Record audit entry for OAuth user login (fire and forget)
            createAuditEntry({
              action: AUDIT_USER_LOGIN,
              actorUserId: provisionedUser.userId,
              actorOrgId: provisionedUser.orgId,
              description: `User login: ${user.email}`,
              metadata: {
                provider: account.provider,
                role: provisionedUser.role,
                isNewUser: String(provisionedUser.isNewUser),
                isNewOrg: String(provisionedUser.isNewOrg),
              },
            }).catch((err) => {
              console.warn('[Auth] Failed to record login audit entry:', err);
            });
          } catch (error) {
            console.error('[Auth] Failed to provision user:', error);
            // Registry must be available - don't allow login with stale/incorrect data
            throw new Error(
              'Unable to verify user access. Please try again later.'
            );
          }
        }
      }
      return token;
    },

    async session({ session, token }) {
      // Pass token data to the session
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
        // Extended session properties
        // @ts-expect-error - extending session type
        session.user.userId = token.userId;
        // @ts-expect-error - extending session type
        session.user.orgId = token.orgId;
        // @ts-expect-error - extending session type
        session.user.orgName = token.orgName;
        // @ts-expect-error - extending session type
        session.user.role = token.role;
      }
      return session;
    },

    async signIn({ user, account }) {
      const authConfig = getAuthConfig();

      // In devtest with test credentials, always allow
      if (
        account?.provider === 'test-credentials' &&
        authConfig.allowTestUsers
      ) {
        return true;
      }

      // In devtest, allow all domains
      if (authConfig.allowedDomains.includes('*')) {
        return true;
      }

      const email = user.email ?? '';
      const domain = email.split('@')[1]?.toLowerCase();

      if (!domain) {
        console.warn('[Auth] Rejected login: invalid email');
        return false;
      }

      // Always allow CIRIS internal domain
      if (domain === 'ciris.ai') {
        return true;
      }

      // For other domains, check if user exists in registry
      // (must be pre-added by an admin)
      const result = await checkUserExists(email);
      if (!result.exists) {
        console.warn(
          `[Auth] Rejected login: ${email} not found in registry (must be pre-added)`
        );
        return false;
      }

      console.log(
        `[Auth] Allowing login for pre-registered user: ${email} in org ${result.orgId}`
      );
      return true;
    },
  },
};

/**
 * Helper to get the server session in server components
 */
export async function getServerSession() {
  return getNextAuthServerSession(authOptions);
}

/**
 * Get test users (only exported for login page in devtest)
 */
export function getTestUsers() {
  if (getAppEnv() !== 'devtest') {
    return [];
  }
  return Object.values(TEST_USERS).map(
    ({ password: _password, ...user }) => user
  );
}

/**
 * Type-safe session accessor for server components
 */
export async function getTypedSession() {
  const session = await getServerSession();
  if (!session?.user) {
    return null;
  }

  return {
    user: {
      email: session.user.email!,
      name: session.user.name || '',
      image: session.user.image || null,
      // @ts-expect-error - extended session type
      userId: session.user.userId as string,
      // @ts-expect-error - extended session type
      orgId: session.user.orgId as string,
      // @ts-expect-error - extended session type
      orgName: session.user.orgName as string,
      // @ts-expect-error - extended session type
      role: session.user.role as UserRole,
    },
  };
}
