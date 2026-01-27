import type { NextAuthOptions, User } from 'next-auth';
import { getServerSession as getNextAuthServerSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getAppEnv, getAuthConfig } from '../env';
import { TEST_ORG_ID, TEST_SECONDARY_ORG_ID } from '../test-config';

/**
 * Test users available in devtest environment
 */
const TEST_USERS: Record<
  string,
  User & { password: string; orgId: string; role: string }
> = {
  'admin@qa-primary.test': {
    id: 'test-admin-1',
    email: 'admin@qa-primary.test',
    name: 'QA Admin User',
    image: null,
    password: 'testpass123',
    orgId: TEST_ORG_ID,
    role: 'admin',
  },
  'user@qa-primary.test': {
    id: 'test-user-1',
    email: 'user@qa-primary.test',
    name: 'QA Regular User',
    image: null,
    password: 'testpass123',
    orgId: TEST_ORG_ID,
    role: 'user',
  },
  'admin@qa-secondary.test': {
    id: 'test-admin-2',
    email: 'admin@qa-secondary.test',
    name: 'QA Secondary Admin',
    image: null,
    password: 'testpass123',
    orgId: TEST_SECONDARY_ORG_ID,
    role: 'admin',
  },
};

/**
 * Build providers based on environment
 */
function buildProviders() {
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

        // Add org/role info for test users
        const testUser = TEST_USERS[user.email ?? ''];
        if (testUser) {
          token.orgId = testUser.orgId;
          token.role = testUser.role;
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
        // @ts-expect-error - extending session type
        session.user.orgId = token.orgId;
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

      // Check domain restrictions in prod
      if (
        authConfig.allowedDomains.length > 0 &&
        !authConfig.allowedDomains.includes('*')
      ) {
        const email = user.email ?? '';
        const domain = email.split('@')[1];
        if (!authConfig.allowedDomains.includes(domain)) {
          return false;
        }
      }

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
