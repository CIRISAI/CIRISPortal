/**
 * User Provisioning Service
 *
 * Handles automatic user and organization provisioning on OAuth login.
 * Integrates with CIRISRegistry to persist user data.
 */

import {
  getOrganization,
  createOrganization,
  getOrgUserByEmail,
  createOrgUser,
  updateOrgUser,
  listOrganizations,
} from '../grpc/client';

/**
 * Role hierarchy for CIRISPortal:
 * - admin: CIRIS internal team, full system access
 * - partner: Organization admins who manage licensees
 * - licensee: End users with read-only access to their org
 */
export type UserRole = 'admin' | 'partner' | 'licensee';

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
 * Map internal OrgRole to our simplified UserRole
 */
function orgRoleToUserRole(
  orgRole: string,
  isCirisInternal: boolean
): UserRole {
  // CIRIS internal users are always admins
  if (isCirisInternal) {
    return 'admin';
  }

  // Map org roles to user roles
  switch (orgRole) {
    case OrgRole.ADMIN:
      return 'partner'; // Org admins are "partners" in our terminology
    case OrgRole.KEY_MANAGER:
    case OrgRole.OPERATOR:
    case OrgRole.VIEWER:
    default:
      return 'licensee';
  }
}

/**
 * Map our UserRole to OrgRole for new users
 */
function userRoleToOrgRole(userRole: UserRole): string {
  switch (userRole) {
    case 'admin':
    case 'partner':
      return OrgRole.ADMIN;
    case 'licensee':
    default:
      return OrgRole.VIEWER;
  }
}

/**
 * CIRIS Internal Organization
 */
const CIRIS_ORG = {
  id: 'ciris-internal',
  name: 'CIRIS',
  domain: 'ciris.ai',
};

/**
 * Generate org ID from domain
 */
function domainToOrgId(domain: string): string {
  // Sanitize domain to create a valid org ID
  return `org-${domain.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}

/**
 * Find an organization by its OAuth domain
 * Returns the actual org UUID, not the slug
 */
async function findOrgByDomain(
  domain: string
): Promise<{ orgId: string; orgName: string } | null> {
  try {
    const orgsResponse = await listOrganizations({ pageSize: 100 });
    const orgs = orgsResponse.organizations || [];

    for (const org of orgs) {
      if (org.oauthDomain?.toLowerCase() === domain.toLowerCase()) {
        console.log(`[Auth] Found org by domain ${domain}: ${org.orgId}`);
        return { orgId: org.orgId, orgName: org.name || domain };
      }
    }
  } catch (error) {
    console.error(`[Auth] Error searching orgs by domain:`, error);
  }
  return null;
}

/**
 * Check if a user exists in the registry
 *
 * Used during signIn to verify non-CIRIS users have been pre-added.
 * Returns the actual orgId (UUID) if found, null otherwise.
 * - CIRIS internal users (@ciris.ai) always allowed
 * - Other users must exist in some organization
 */
export async function checkUserExists(
  email: string
): Promise<{ exists: boolean; orgId?: string; orgName?: string }> {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return { exists: false };

  // Search all orgs for this user (works for both CIRIS and external users)
  try {
    const orgsResponse = await listOrganizations({ pageSize: 100 });
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

  // CIRIS internal users are always allowed even if not found yet
  // They will be provisioned on first login
  if (domain === CIRIS_ORG.domain) {
    console.log(`[Auth] CIRIS user ${email} not found, will be provisioned`);
    return { exists: true }; // No orgId yet - will be created
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
 * Get or create organization for a domain
 * Always returns the actual org UUID from the registry
 */
async function getOrCreateOrganization(
  domain: string,
  primaryEmail: string
): Promise<{ orgId: string; orgName: string; isNew: boolean }> {
  const isCirisInternal = domain.toLowerCase() === CIRIS_ORG.domain;
  const slugId = isCirisInternal ? CIRIS_ORG.id : domainToOrgId(domain);

  // First, try to find existing org by domain (returns real UUID)
  const existingOrg = await findOrgByDomain(domain);
  if (existingOrg) {
    console.log(
      `[Provisioning] Found existing org by domain: ${existingOrg.orgId}`
    );
    return {
      orgId: existingOrg.orgId,
      orgName: existingOrg.orgName,
      isNew: false,
    };
  }

  // Also try to get by slug ID (for backwards compatibility)
  try {
    const response = await getOrganization(slugId);
    if (response.found && response.organization) {
      const actualOrgId = response.organization.orgId || slugId;
      console.log(`[Provisioning] Found existing org by slug: ${actualOrgId}`);
      return {
        orgId: actualOrgId,
        orgName: response.organization.name || domain,
        isNew: false,
      };
    }
  } catch {
    // Not found by slug, will create
  }

  // Organization doesn't exist, create it
  console.log(
    `[Provisioning] Creating new org: ${slugId} for domain ${domain}`
  );

  const orgName = isCirisInternal ? CIRIS_ORG.name : `${domain} Organization`;

  try {
    // Atomic creation: org + initial admin in same transaction
    const createResponse = await createOrganization({
      organization: {
        orgId: slugId,
        name: orgName,
        primaryEmail,
        oauthProvider: 'google',
        oauthDomain: domain,
        active: true,
        metadata: {
          autoCreated: 'true',
          createdAt: new Date().toISOString(),
        },
      },
      initialAdmin: {
        email: primaryEmail,
        name: primaryEmail.split('@')[0],
        role: 1, // ORG_ADMIN (enum value from proto)
        active: true,
      },
    });

    if (createResponse.error) {
      const errorMsg = createResponse.error.message || '';

      // Handle "duplicate key" - org already exists, fetch it
      if (
        errorMsg.includes('duplicate') ||
        errorMsg.includes('already exists')
      ) {
        console.log(
          `[Provisioning] Org already exists (duplicate key), fetching...`
        );
        const existing = await findOrgByDomain(domain);
        if (existing) {
          return {
            orgId: existing.orgId,
            orgName: existing.orgName,
            isNew: false,
          };
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
      `[Provisioning] Created org: ${actualOrgId} with initial admin`
    );
    return { orgId: actualOrgId, orgName, isNew: true };
  } catch (error) {
    if (error instanceof ProvisioningError) {
      throw error;
    }

    const err = error as { code?: number; message?: string };
    const errorMsg = err.message || '';

    // Handle "duplicate key" - org or user already exists
    if (errorMsg.includes('duplicate') || errorMsg.includes('already exists')) {
      console.log(
        `[Provisioning] Duplicate key error, fetching existing org...`
      );
      const existing = await findOrgByDomain(domain);
      if (existing) {
        return {
          orgId: existing.orgId,
          orgName: existing.orgName,
          isNew: false,
        };
      }
    }

    console.error('[Provisioning] Error creating organization:', error);
    throw new ProvisioningError(
      `Failed to create organization for ${domain}`,
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
  defaultRole: UserRole,
  isCirisInternal: boolean
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
        isCirisInternal
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
            // Just updating triggers lastLoginAt update on backend
          },
        });
      } catch (updateErr) {
        // Non-fatal, just log
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
        role: userRoleToOrgRole(defaultRole),
      },
    });

    if (createResponse.error) {
      const errorMsg = createResponse.error.message || '';

      // Handle "duplicate key" - user already exists, try to fetch
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
              isCirisInternal
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

    // Extract user ID from response
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

    // Handle "duplicate key" - user already exists
    if (errorMsg.includes('duplicate') || errorMsg.includes('already exists')) {
      console.log(`[Provisioning] Duplicate key error, fetching user...`);
      try {
        const existingResponse = await getOrgUserByEmail({ orgId, email });
        if (existingResponse.user) {
          const role = orgRoleToUserRole(
            existingResponse.user.role || OrgRole.VIEWER,
            isCirisInternal
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
 * Provision a user on OAuth login
 *
 * This is the main entry point called from NextAuth callbacks.
 * It ensures the user and their organization exist in the registry.
 * Always returns actual org UUIDs from the registry, never slugs.
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

  const isCirisInternal = domain === CIRIS_ORG.domain;

  console.log(
    `[Provisioning] Starting for ${email} (domain: ${domain}, provider: ${oauthProvider})`
  );

  // First, check if user already exists in any org (returns real UUID)
  const existingUser = await checkUserExists(email);

  let orgId: string;
  let orgName: string;
  let isNewOrg = false;

  if (existingUser.exists && existingUser.orgId) {
    // User already exists - use their existing org (real UUID)
    orgId = existingUser.orgId;
    orgName = existingUser.orgName || orgId;
    console.log(`[Provisioning] Using existing org ${orgId} for ${email}`);
  } else if (isCirisInternal) {
    // CIRIS internal users - auto-create org/user if needed
    const orgResult = await getOrCreateOrganization(domain, email);
    orgId = orgResult.orgId;
    orgName = orgResult.orgName;
    isNewOrg = orgResult.isNew;
  } else {
    // Non-CIRIS user not found in any org
    throw new ProvisioningError(
      `User ${email} not found in any organization`,
      'USER_NOT_FOUND',
      false
    );
  }

  // Determine default role for new users
  // CIRIS internal users get admin, everyone else gets licensee
  const defaultRole: UserRole = isCirisInternal ? 'admin' : 'licensee';

  // Get or create user in the org
  const {
    userId,
    role,
    isNew: isNewUser,
  } = await getOrCreateUser(orgId, email, name, defaultRole, isCirisInternal);

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
 * Fallback is no longer supported - registry must be available
 *
 * Previously this used slugs like 'ciris-internal' which don't match
 * the actual UUIDs in the registry, causing all subsequent queries to fail.
 * Now we require the registry to be available for login.
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
