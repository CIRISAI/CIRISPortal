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
 * Check if a user exists in the registry
 *
 * Used during signIn to verify non-CIRIS users have been pre-added.
 * Returns true if:
 * - User is from @ciris.ai (always allowed)
 * - User exists in their domain's organization
 */
export async function checkUserExists(email: string): Promise<boolean> {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;

  // CIRIS internal users are always allowed
  if (domain === CIRIS_ORG.domain) {
    return true;
  }

  // For other domains, check if user exists in registry
  const orgId = domainToOrgId(domain);

  try {
    const response = await getOrgUserByEmail({ orgId, email });
    return !!response.user;
  } catch (error) {
    // User not found or org doesn't exist
    const err = error as { code?: number; message?: string };
    if (err.code === 5 || err.message?.includes('not found')) {
      console.log(`[Auth] User ${email} not found in registry`);
      return false;
    }
    // On other errors, log and deny for safety
    console.error(`[Auth] Error checking user ${email}:`, error);
    return false;
  }
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
 */
async function getOrCreateOrganization(
  domain: string,
  primaryEmail: string
): Promise<{ orgId: string; orgName: string; isNew: boolean }> {
  const isCirisInternal = domain.toLowerCase() === CIRIS_ORG.domain;
  const orgId = isCirisInternal ? CIRIS_ORG.id : domainToOrgId(domain);

  try {
    // Try to get existing organization
    const response = await getOrganization(orgId);

    if (response.found && response.organization) {
      console.log(`[Provisioning] Found existing org: ${orgId}`);
      return {
        orgId: response.organization.orgId || orgId,
        orgName: response.organization.name || domain,
        isNew: false,
      };
    }

    // Organization doesn't exist, create it
    console.log(
      `[Provisioning] Creating new org: ${orgId} for domain ${domain}`
    );

    const orgName = isCirisInternal ? CIRIS_ORG.name : `${domain} Organization`;

    const createResponse = await createOrganization({
      organization: {
        orgId,
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
    });

    if (createResponse.error) {
      throw new ProvisioningError(
        `Failed to create organization: ${createResponse.error.message}`,
        'ORG_CREATE_FAILED',
        true
      );
    }

    console.log(`[Provisioning] Created org: ${orgId}`);
    return { orgId, orgName, isNew: true };
  } catch (error) {
    // If it's already a ProvisioningError, rethrow
    if (error instanceof ProvisioningError) {
      throw error;
    }

    // Check if error is "not found" type - means we need to create
    const err = error as { code?: number; message?: string };
    if (err.code === 5 || err.message?.includes('not found')) {
      // NOT_FOUND error, try to create
      console.log(`[Provisioning] Org not found, creating: ${orgId}`);

      try {
        const orgName = isCirisInternal
          ? CIRIS_ORG.name
          : `${domain} Organization`;

        await createOrganization({
          organization: {
            orgId,
            name: orgName,
            primaryEmail,
            oauthProvider: 'google',
            oauthDomain: domain,
            active: true,
          },
        });

        return { orgId, orgName, isNew: true };
      } catch (createError) {
        console.error('[Provisioning] Failed to create org:', createError);
        throw new ProvisioningError(
          `Failed to create organization for ${domain}`,
          'ORG_CREATE_FAILED',
          true
        );
      }
    }

    console.error('[Provisioning] Error getting organization:', error);
    throw new ProvisioningError(
      `Failed to access organization for ${domain}`,
      'ORG_ACCESS_FAILED',
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
      const isCirisInternal = orgId === CIRIS_ORG.id;
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

    // User doesn't exist, create them
    console.log(`[Provisioning] Creating new user: ${email} in org ${orgId}`);

    const createResponse = await createOrgUser({
      user: {
        orgId,
        email,
        displayName: name,
        role: userRoleToOrgRole(defaultRole),
      },
    });

    if (createResponse.error) {
      throw new ProvisioningError(
        `Failed to create user: ${createResponse.error.message}`,
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

    // Check if user not found - create them
    const err = error as { code?: number; message?: string };
    if (err.code === 5 || err.message?.includes('not found')) {
      console.log(`[Provisioning] User not found, creating: ${email}`);

      try {
        const createResponse = await createOrgUser({
          user: {
            orgId,
            email,
            displayName: name,
            role: userRoleToOrgRole(defaultRole),
          },
        });

        const userId =
          createResponse.userId ||
          createResponse.user?.userId ||
          `user-${Date.now()}`;
        return { userId, role: defaultRole, isNew: true };
      } catch (createError) {
        console.error('[Provisioning] Failed to create user:', createError);
        throw new ProvisioningError(
          `Failed to create user ${email}`,
          'USER_CREATE_FAILED',
          true
        );
      }
    }

    console.error('[Provisioning] Error getting user:', error);
    throw new ProvisioningError(
      `Failed to access user ${email}`,
      'USER_ACCESS_FAILED',
      true
    );
  }
}

/**
 * Provision a user on OAuth login
 *
 * This is the main entry point called from NextAuth callbacks.
 * It ensures the user and their organization exist in the registry.
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

  // Determine default role for new users
  // CIRIS internal users get admin, everyone else gets licensee
  const defaultRole: UserRole = isCirisInternal ? 'admin' : 'licensee';

  console.log(
    `[Provisioning] Starting for ${email} (domain: ${domain}, provider: ${oauthProvider})`
  );

  // Get or create organization
  const {
    orgId,
    orgName,
    isNew: isNewOrg,
  } = await getOrCreateOrganization(domain, email);

  // Get or create user
  const {
    userId,
    role,
    isNew: isNewUser,
  } = await getOrCreateUser(orgId, email, name, defaultRole);

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
 * Fallback user info when registry is unavailable
 *
 * Uses domain-based rules to determine role without backend access.
 * This ensures users can still log in during registry outages.
 */
export function getFallbackUserInfo(
  email: string,
  name: string
): ProvisionedUser {
  const domain = email.split('@')[1]?.toLowerCase() || 'unknown';
  const isCirisInternal = domain === CIRIS_ORG.domain;

  console.warn(
    `[Provisioning] Using fallback for ${email} - registry unavailable`
  );

  return {
    userId: `fallback-${email.replace(/[^a-z0-9]/gi, '-')}`,
    email,
    name,
    orgId: isCirisInternal ? CIRIS_ORG.id : domainToOrgId(domain),
    orgName: isCirisInternal ? CIRIS_ORG.name : `${domain} (Pending)`,
    role: isCirisInternal ? 'admin' : 'licensee',
    isNewUser: false, // Can't know without backend
    isNewOrg: false,
  };
}
