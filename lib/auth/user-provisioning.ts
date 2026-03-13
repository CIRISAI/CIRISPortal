/**
 * User Provisioning Service
 *
 * Handles automatic user and organization provisioning on OAuth login.
 * Integrates with CIRISRegistry to persist user data.
 *
 * Each user gets their own unique organization (1:1 user:org).
 * Permissions are ABAC-based on: org ID, org tier, and system admin status.
 *
 * TODO: Multi-user orgs — allow inviting users to an existing org
 * TODO: Pro tier — upgrade path from community to professional
 * TODO: System admin promotion — allow bootstrap admin to promote others
 */

import {
  getOrganization,
  createOrganization,
  getOrgUserByEmail,
  createOrgUser,
  updateOrgUser,
  getUserByEmail,
  createSystemUser,
  lookupUserByOAuth,
  linkUserOAuth,
  lookupSystemUserByOAuth,
  linkSystemUserOAuth,
} from '../grpc/client';

/**
 * Role hierarchy for CIRISPortal:
 * - admin: System administrators (bootstrap: eric@ciris.ai)
 * - partner: CIRIS internal team members (elevated access, not system admin)
 * - licensee: Future: non-admin members of multi-user orgs
 * - community: Self-signup community users (default)
 */
export type UserRole = 'admin' | 'partner' | 'licensee' | 'community';

/**
 * OrgRole enum values from proto (must match ciris_registry.proto)
 */
export const OrgRole = {
  UNSPECIFIED: 'ORG_ROLE_UNSPECIFIED',
  ADMIN: 'ORG_ADMIN',
  KEY_MANAGER: 'ORG_KEY_MANAGER',
  OPERATOR: 'ORG_OPERATOR',
  VIEWER: 'ORG_VIEWER',
} as const;

/**
 * Bootstrap system admin — the initial system admin who can promote others.
 * Only this user gets auto-provisioned as SYSTEM_ADMIN in the registry.
 */
const BOOTSTRAP_SYSTEM_ADMIN = 'eric@ciris.ai';

/** CIRIS internal domain */
const CIRIS_DOMAIN = 'ciris.ai';

/**
 * Map OrgRole from registry to portal UserRole for returning users.
 */
function orgRoleToUserRole(orgRole: string, email: string): UserRole {
  // Bootstrap system admin is always admin
  if (email.toLowerCase() === BOOTSTRAP_SYSTEM_ADMIN) {
    return 'admin';
  }

  const domain = email.split('@')[1]?.toLowerCase();

  // CIRIS internal users get partner role (elevated access, not system admin)
  if (domain === CIRIS_DOMAIN) {
    return 'partner';
  }

  // All non-CIRIS users are community tier (per-user orgs)
  // Org role doesn't determine portal role — email domain does.
  // TODO: When multi-user orgs are added, revisit licensee role mapping.
  return 'community';
}

/**
 * Generate a per-user org slug from email.
 * Each user gets their own unique org — no domain-based grouping.
 */
function emailToOrgSlug(email: string): string {
  return `org-${email.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}

/**
 * Check if a user exists in the registry.
 *
 * Uses getUserByEmail to directly look up the user (each user has their own org).
 * Returns the user info if found, null otherwise.
 * All users are allowed to self-signup; this check is for returning users.
 */
export async function checkUserExists(email: string): Promise<{
  exists: boolean;
  userId?: string;
  orgId?: string;
  orgName?: string;
  role?: UserRole;
}> {
  try {
    const userResponse = await getUserByEmail({ email });
    if (userResponse.user && userResponse.user.memberships?.length > 0) {
      const user = userResponse.user;
      const membership = user.memberships[0];
      const role = orgRoleToUserRole(membership.role || 'ORG_VIEWER', email);
      console.log(
        `[Auth] Found user ${email} (${user.userId}) in org ${membership.orgId} (${membership.orgName})`
      );
      return {
        exists: true,
        userId: user.userId,
        orgId: membership.orgId,
        orgName: membership.orgName,
        role,
      };
    }
  } catch (error) {
    const err = error as { code?: number; message?: string };
    // NOT_FOUND is expected for new users
    if (err.code !== 5 && !err.message?.includes('not found')) {
      console.error(`[Auth] Error looking up user ${email}:`, error);
    }
  }

  console.log(`[Auth] User ${email} not found in any organization`);
  return { exists: false };
}

/**
 * User info returned after provisioning
 */
export interface ProvisionedUser {
  userId: string;
  email: string;
  name: string;
  orgId: string;
  orgName: string;
  role: UserRole;
  isNewUser: boolean;
  isNewOrg: boolean;
}

/**
 * Provisioning error with details
 */
export class ProvisioningError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = false
  ) {
    super(message);
    this.name = 'ProvisioningError';
  }
}

/**
 * Get or create a per-user organization.
 *
 * Every user gets their own org — no domain-based grouping.
 * Org type is determined by email domain:
 *   @ciris.ai → ORG_INTERNAL
 *   all others → ORG_COMMUNITY
 */
async function getOrCreateUserOrganization(
  email: string,
  displayName: string
): Promise<{ orgId: string; orgName: string; isNew: boolean }> {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  const isCirisInternal = domain === CIRIS_DOMAIN;
  const slugId = emailToOrgSlug(email);
  const orgType = isCirisInternal ? 'ORG_INTERNAL' : 'ORG_COMMUNITY';
  const orgName = displayName || email.split('@')[0];

  // Try to find existing per-user org by slug
  try {
    const response = await getOrganization(slugId);
    if (response.found && response.organization) {
      const actualOrgId = response.organization.orgId || slugId;
      console.log(`[Provisioning] Found existing per-user org: ${actualOrgId}`);
      return {
        orgId: actualOrgId,
        orgName: response.organization.name || orgName,
        isNew: false,
      };
    }
  } catch {
    // Not found by slug, will create
  }

  // Create new per-user org
  console.log(
    `[Provisioning] Creating per-user org: ${slugId} for ${email} (${orgType})`
  );

  const metadata: Record<string, string> = {
    autoCreated: 'true',
    ownerEmail: email,
    createdAt: new Date().toISOString(),
  };

  if (!isCirisInternal) {
    metadata.tier = 'community';
    metadata.selfSignup = 'true';
    metadata.activationStatus = 'pending';
  }

  try {
    const createResponse = await createOrganization({
      organization: {
        orgId: slugId,
        name: orgName,
        primaryEmail: email,
        oauthProvider: 'google',
        // No oauthDomain — per-user org, not domain-based
        orgType,
        active: true,
        metadata,
      },
      initialAdmin: {
        email,
        name: displayName || email.split('@')[0],
        role: 1, // ORG_ADMIN — every user is admin of their own org
        active: true,
      },
    });

    if (createResponse.error) {
      const errorMsg = createResponse.error.message || '';

      // Handle "duplicate key" — org already exists (race condition), fetch it
      if (
        errorMsg.includes('duplicate') ||
        errorMsg.includes('already exists')
      ) {
        console.log(
          `[Provisioning] Org already exists (duplicate key), fetching...`
        );
        try {
          const existing = await getOrganization(slugId);
          if (existing.found && existing.organization) {
            return {
              orgId: existing.organization.orgId || slugId,
              orgName: existing.organization.name || orgName,
              isNew: false,
            };
          }
        } catch {
          // Fall through to error
        }
      }

      throw new ProvisioningError(
        `Failed to create organization: ${errorMsg}`,
        'ORG_CREATE_FAILED',
        true
      );
    }

    // Use the actual org ID returned by the registry (UUID), not our slug
    const actualOrgId =
      createResponse.orgId || createResponse.organization?.orgId || slugId;
    console.log(
      `[Provisioning] Created per-user org: ${actualOrgId} for ${email}`
    );
    return { orgId: actualOrgId, orgName, isNew: true };
  } catch (error) {
    if (error instanceof ProvisioningError) {
      throw error;
    }

    const err = error as { code?: number; message?: string };
    const errorMsg = err.message || '';

    // Handle "duplicate key" — race condition
    if (errorMsg.includes('duplicate') || errorMsg.includes('already exists')) {
      console.log(
        `[Provisioning] Duplicate key error, fetching existing org...`
      );
      try {
        const existing = await getOrganization(slugId);
        if (existing.found && existing.organization) {
          return {
            orgId: existing.organization.orgId || slugId,
            orgName: existing.organization.name || orgName,
            isNew: false,
          };
        }
      } catch {
        // Fall through to error
      }
    }

    console.error('[Provisioning] Error creating organization:', error);
    throw new ProvisioningError(
      `Failed to create organization for ${email}`,
      'ORG_CREATE_FAILED',
      true
    );
  }
}

/**
 * Get or create user in organization
 */
async function getOrCreateUser(
  orgId: string,
  email: string,
  name: string,
  defaultRole: UserRole
): Promise<{
  userId: string;
  role: UserRole;
  isNew: boolean;
}> {
  try {
    // Try to get existing user
    const response = await getOrgUserByEmail({ orgId, email });

    if (response.user) {
      const role = orgRoleToUserRole(
        response.user.role || OrgRole.VIEWER,
        email
      );

      console.log(
        `[Provisioning] Found existing user: ${email} with role ${role}`
      );

      // Update last login
      try {
        await updateOrgUser({
          user: {
            orgId,
            userId: response.user.userId,
          },
        });
      } catch (updateErr) {
        console.warn('[Provisioning] Failed to update last login:', updateErr);
      }

      return {
        userId: response.user.userId,
        role,
        isNew: false,
      };
    }
  } catch (error) {
    const err = error as { code?: number; message?: string };
    // Only continue to create if user truly not found
    if (err.code !== 5 && !err.message?.includes('not found')) {
      console.error('[Provisioning] Error getting user:', error);
      throw new ProvisioningError(
        `Failed to access user ${email}`,
        'USER_ACCESS_FAILED',
        true
      );
    }
  }

  // User doesn't exist, create them
  console.log(`[Provisioning] Creating new user: ${email} in org ${orgId}`);

  try {
    const createResponse = await createOrgUser({
      user: {
        orgId,
        email,
        displayName: name,
        role: OrgRole.ADMIN, // Everyone is ORG_ADMIN of their own org
      },
    });

    if (createResponse.error) {
      const errorMsg = createResponse.error.message || '';

      // Handle "duplicate key" — user already exists, try to fetch
      if (
        errorMsg.includes('duplicate') ||
        errorMsg.includes('already exists')
      ) {
        console.log(
          `[Provisioning] User already exists (duplicate key), fetching...`
        );
        try {
          const existingResponse = await getOrgUserByEmail({ orgId, email });
          if (existingResponse.user) {
            const role = orgRoleToUserRole(
              existingResponse.user.role || OrgRole.VIEWER,
              email
            );
            return {
              userId: existingResponse.user.userId,
              role,
              isNew: false,
            };
          }
        } catch {
          // Couldn't fetch existing user
        }
      }

      throw new ProvisioningError(
        `Failed to create user: ${errorMsg}`,
        'USER_CREATE_FAILED',
        true
      );
    }

    const userId =
      createResponse.userId ||
      createResponse.user?.userId ||
      `user-${Date.now()}`;

    console.log(`[Provisioning] Created user: ${email} with ID ${userId}`);
    return { userId, role: defaultRole, isNew: true };
  } catch (error) {
    if (error instanceof ProvisioningError) {
      throw error;
    }

    const err = error as { code?: number; message?: string };
    const errorMsg = err.message || '';

    // Handle "duplicate key" — user already exists
    if (errorMsg.includes('duplicate') || errorMsg.includes('already exists')) {
      console.log(`[Provisioning] Duplicate key error, fetching user...`);
      try {
        const existingResponse = await getOrgUserByEmail({ orgId, email });
        if (existingResponse.user) {
          const role = orgRoleToUserRole(
            existingResponse.user.role || OrgRole.VIEWER,
            email
          );
          return {
            userId: existingResponse.user.userId,
            role,
            isNew: false,
          };
        }
      } catch {
        // Couldn't fetch existing user
      }
    }

    console.error('[Provisioning] Failed to create user:', error);
    throw new ProvisioningError(
      `Failed to create user ${email}`,
      'USER_CREATE_FAILED',
      true
    );
  }
}

/**
 * Determine the portal role for a new user based on email.
 *
 * - Bootstrap system admin (eric@ciris.ai) → admin
 * - CIRIS internal (@ciris.ai) → partner (elevated, not system admin)
 * - Everyone else → community
 */
function determineNewUserRole(email: string): UserRole {
  const lower = email.toLowerCase();
  if (lower === BOOTSTRAP_SYSTEM_ADMIN) return 'admin';
  if (lower.endsWith(`@${CIRIS_DOMAIN}`)) return 'partner';
  return 'community';
}

/**
 * Provision a user on OAuth login.
 *
 * Main entry point called from NextAuth callbacks.
 * Each user gets their own unique org (1:1 user:org).
 * Returns actual org UUIDs from the registry, never slugs.
 *
 * Now supports multi-provider OAuth - if user exists with a different
 * provider, the new OAuth identity is linked to the existing account.
 */
export async function provisionUser(
  email: string,
  name: string,
  oauthProvider: string = 'google',
  oauthSubject?: string
): Promise<ProvisionedUser> {
  const domain = email.split('@')[1]?.toLowerCase();

  if (!domain) {
    throw new ProvisioningError(
      'Invalid email address',
      'INVALID_EMAIL',
      false
    );
  }

  console.log(
    `[Provisioning] Starting for ${email} (domain: ${domain}, provider: ${oauthProvider})`
  );

  let userId: string;
  let orgId: string;
  let orgName: string;
  let role: UserRole;
  let isNewUser = false;
  let isNewOrg = false;

  // Try OAuth-aware lookup first (if we have the OAuth subject)
  let existingUser: {
    exists: boolean;
    userId?: string;
    orgId?: string;
    orgName?: string;
    role?: UserRole;
  } | null = null;
  let shouldLinkOAuth = false;

  if (oauthSubject) {
    try {
      const oauthLookup = await lookupUserByOAuth({
        oauthProvider,
        oauthSubject,
        email,
      });

      if (oauthLookup.found && oauthLookup.userId) {
        // User found - check if we need to link the OAuth identity
        shouldLinkOAuth = oauthLookup.shouldLinkOauth || false;

        // Get full user info
        const fullUser = await checkUserExists(email);
        existingUser = fullUser;

        if (shouldLinkOAuth) {
          console.log(
            `[Provisioning] Linking ${oauthProvider} identity to existing user ${email}`
          );
          try {
            await linkUserOAuth({
              userId: oauthLookup.userId,
              oauthProvider,
              oauthSubject,
              email,
            });
            console.log(`[Provisioning] OAuth identity linked successfully`);
          } catch (linkErr) {
            // Non-fatal - user can still log in
            console.warn(
              `[Provisioning] Failed to link OAuth identity:`,
              linkErr
            );
          }
        }
      }
    } catch (oauthErr) {
      // Fall back to email-only lookup
      console.warn(
        `[Provisioning] OAuth lookup failed, falling back to email:`,
        oauthErr
      );
    }
  }

  // Fall back to email-only lookup if OAuth lookup didn't find a user
  if (!existingUser) {
    existingUser = await checkUserExists(email);
  }

  if (existingUser.exists && existingUser.userId && existingUser.orgId) {
    // Returning user — use their existing info directly
    userId = existingUser.userId;
    orgId = existingUser.orgId;
    orgName = existingUser.orgName || orgId;
    role = existingUser.role || determineNewUserRole(email);
    console.log(
      `[Provisioning] Returning user ${email} (${userId}) in org ${orgId}`
    );
  } else {
    // New user — create per-user org (type determined by domain)
    const orgResult = await getOrCreateUserOrganization(email, name);
    orgId = orgResult.orgId;
    orgName = orgResult.orgName;
    isNewOrg = orgResult.isNew;

    // Create user in their org
    const defaultRole = determineNewUserRole(email);
    const userResult = await getOrCreateUser(orgId, email, name, defaultRole);
    userId = userResult.userId;
    role = userResult.role;
    isNewUser = userResult.isNew;

    // Link OAuth identity to the new user
    if (oauthSubject && isNewUser) {
      try {
        await linkUserOAuth({
          userId,
          oauthProvider,
          oauthSubject,
          email,
        });
        console.log(
          `[Provisioning] Linked ${oauthProvider} identity to new user ${email}`
        );
      } catch (linkErr) {
        // Non-fatal - user was still created
        console.warn(
          `[Provisioning] Failed to link OAuth identity to new user:`,
          linkErr
        );
      }
    }
  }

  // Only the bootstrap system admin gets a SYSTEM_ADMIN record
  if (email.toLowerCase() === BOOTSTRAP_SYSTEM_ADMIN) {
    try {
      // Check if system user exists via OAuth or email
      let systemUserExists = false;
      let systemUserId: string | undefined;

      if (oauthSubject) {
        try {
          const sysLookup = await lookupSystemUserByOAuth({
            oauthProvider,
            oauthSubject,
            email,
          });
          if (sysLookup.found) {
            systemUserExists = true;
            systemUserId = sysLookup.userId;
            // Link OAuth identity if needed
            if (sysLookup.shouldLinkOauth && systemUserId) {
              await linkSystemUserOAuth({
                userId: systemUserId,
                oauthProvider,
                oauthSubject,
                email,
              });
              console.log(
                `[Provisioning] Linked ${oauthProvider} to system admin ${email}`
              );
            }
          }
        } catch {
          // Fall back to create
        }
      }

      // Create system user if OAuth lookup didn't find them
      if (!systemUserExists) {
        try {
          const result = await createSystemUser({
            email,
            name,
            role: 'SYSTEM_ADMIN',
          });
          systemUserId = result.userId;
          console.log(`[Provisioning] Created system admin for ${email}`);
        } catch (createErr) {
          const err = createErr as { message?: string };
          // Handle duplicate key - user already exists, which is fine
          if (
            err.message?.includes('duplicate') ||
            err.message?.includes('already exists')
          ) {
            console.log(
              `[Provisioning] System user already exists (duplicate key) - continuing`
            );
            // User exists but we don't have their ID - that's OK for admin check
            systemUserExists = true;
          } else {
            console.warn(
              `[Provisioning] Failed to create system user:`,
              createErr
            );
          }
        }
      }

      // Link OAuth identity to system user (new or existing)
      if (oauthSubject && systemUserId) {
        try {
          await linkSystemUserOAuth({
            userId: systemUserId,
            oauthProvider,
            oauthSubject,
            email,
          });
          console.log(
            `[Provisioning] Linked ${oauthProvider} to system admin ${email}`
          );
        } catch (linkErr) {
          // Non-fatal - might already be linked
          const err = linkErr as { message?: string };
          if (!err.message?.includes('duplicate')) {
            console.warn(
              `[Provisioning] Failed to link OAuth to system user:`,
              linkErr
            );
          }
        }
      }
    } catch (error) {
      console.warn(`[Provisioning] System admin provisioning error:`, error);
    }
  }

  const result: ProvisionedUser = {
    userId,
    email,
    name,
    orgId,
    orgName,
    role,
    isNewUser,
    isNewOrg,
  };

  console.log(`[Provisioning] Complete:`, {
    email,
    orgId,
    role,
    isNewUser,
    isNewOrg,
  });

  return result;
}

/**
 * Fallback is no longer supported — registry must be available.
 */
export function getFallbackUserInfo(email: string, _name: string): never {
  console.error(
    `[Provisioning] Registry unavailable - cannot provision ${email}`
  );
  throw new ProvisioningError(
    'Registry is unavailable. Please try again later.',
    'REGISTRY_UNAVAILABLE',
    true
  );
}
