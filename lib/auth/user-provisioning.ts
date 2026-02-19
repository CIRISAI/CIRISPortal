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
  listOrganizations,
  createSystemUser,
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

  // Map org roles to user roles
  switch (orgRole) {
    case OrgRole.ADMIN:
      // Everyone is ORG_ADMIN of their own org — role depends on tier
      return 'community';
    case OrgRole.KEY_MANAGER:
    case OrgRole.OPERATOR:
    case OrgRole.VIEWER:
    default:
      return 'licensee';
  }
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
 * Searches all orgs to find which one contains this user.
 * Returns the actual orgId (UUID) if found, null otherwise.
 * All users are allowed to self-signup; this check is for returning users.
 */
export async function checkUserExists(
  email: string
): Promise<{ exists: boolean; orgId?: string; orgName?: string }> {
  // Search all orgs for this user
  try {
    const orgsResponse = await listOrganizations({ pageSize: 200 });
    const orgs = orgsResponse.organizations || [];

    for (const org of orgs) {
      if (!org.orgId) continue;
      try {
        const userResponse = await getOrgUserByEmail({
          orgId: org.orgId,
          email,
        });
        if (userResponse.user) {
          console.log(
            `[Auth] Found user ${email} in org ${org.orgId} (${org.name})`
          );
          return { exists: true, orgId: org.orgId, orgName: org.name };
        }
      } catch {
        // User not in this org, continue
      }
    }
  } catch (error) {
    console.error(`[Auth] Error searching orgs for user ${email}:`, error);
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
 */
export async function provisionUser(
  email: string,
  name: string,
  oauthProvider: string = 'google'
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

  // Check if user already exists in any org (returning user)
  const existingUser = await checkUserExists(email);

  let orgId: string;
  let orgName: string;
  let isNewOrg = false;

  if (existingUser.exists && existingUser.orgId) {
    // Returning user — use their existing per-user org
    orgId = existingUser.orgId;
    orgName = existingUser.orgName || orgId;
    console.log(`[Provisioning] Using existing org ${orgId} for ${email}`);
  } else {
    // New user — create per-user org (type determined by domain)
    const orgResult = await getOrCreateUserOrganization(email, name);
    orgId = orgResult.orgId;
    orgName = orgResult.orgName;
    isNewOrg = orgResult.isNew;
  }

  // Determine role for this user
  const defaultRole = determineNewUserRole(email);

  // Get or create user in their org
  const {
    userId,
    role,
    isNew: isNewUser,
  } = await getOrCreateUser(orgId, email, name, defaultRole);

  // Only the bootstrap system admin gets a SYSTEM_ADMIN record
  if (email.toLowerCase() === BOOTSTRAP_SYSTEM_ADMIN) {
    try {
      await createSystemUser({
        email,
        name,
        role: 'SYSTEM_ADMIN',
      });
      console.log(`[Provisioning] Created/verified system admin for ${email}`);
    } catch (error) {
      const err = error as { message?: string };
      if (
        !err.message?.includes('duplicate') &&
        !err.message?.includes('already exists')
      ) {
        console.warn(`[Provisioning] Failed to create system user:`, error);
      }
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
