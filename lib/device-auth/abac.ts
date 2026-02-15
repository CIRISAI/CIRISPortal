/**
 * Attribute-Based Access Control (ABAC) for device auth template filtering.
 *
 * Resolves a user's OAuth identity → org → allowed templates by:
 * 1. Looking up org type (INTERNAL, PARTNER, LICENSEE, COMMUNITY)
 * 2. Checking partner-level allowed_identity_templates
 * 3. Intersecting with node manifest capabilities
 *
 * TODO: Query actual license data from Registry for fine-grained control.
 * MVP: org type determines template access with hardcoded rules.
 */

import { getOrganization, lookupPartner } from '@/lib/grpc/client';
import { TEMPLATE_PRESETS, type TemplatePreset } from '@/lib/templates';

export interface AllowedTemplate extends TemplatePreset {
  id: string;
}

// Org type constants (from proto)
const ORG_TYPE = {
  INTERNAL: 'ORG_INTERNAL',
  PARTNER: 'ORG_PARTNER',
  LICENSEE: 'ORG_LICENSEE',
  COMMUNITY: 'ORG_COMMUNITY',
} as const;

// Community orgs can only use these templates
const COMMUNITY_TEMPLATES = ['echo', 'default'];

/**
 * Get the list of templates a user is allowed to provision,
 * given their org and the target node's capabilities.
 */
export async function getAllowedTemplates(
  orgId: string,
  nodeManifest?: Record<string, unknown>
): Promise<AllowedTemplate[]> {
  let allowedTemplateIds: string[];

  try {
    const org = await getOrganization(orgId);
    const orgType = org?.orgType || ORG_TYPE.COMMUNITY;

    switch (orgType) {
      case ORG_TYPE.INTERNAL:
        // CIRIS internal orgs get all templates
        allowedTemplateIds = Object.keys(TEMPLATE_PRESETS);
        break;

      case ORG_TYPE.PARTNER: {
        // TODO: Query Registry for partner's allowed_identity_templates
        // via lookupPartner(). MVP: partners get all templates.
        const partnerTemplates = await getPartnerAllowedTemplates(orgId);
        allowedTemplateIds =
          partnerTemplates.length > 0
            ? partnerTemplates
            : Object.keys(TEMPLATE_PRESETS);
        break;
      }

      case ORG_TYPE.LICENSEE: {
        // Licensees inherit from parent partner
        const parentOrgId = org?.parentOrgId;
        if (parentOrgId) {
          const parentTemplates = await getPartnerAllowedTemplates(parentOrgId);
          allowedTemplateIds =
            parentTemplates.length > 0
              ? parentTemplates
              : Object.keys(TEMPLATE_PRESETS);
        } else {
          // No parent — fall back to community
          allowedTemplateIds = COMMUNITY_TEMPLATES;
        }
        break;
      }

      case ORG_TYPE.COMMUNITY:
      default:
        allowedTemplateIds = COMMUNITY_TEMPLATES;
        break;
    }
  } catch (error) {
    console.error(
      '[ABAC] Failed to resolve org, falling back to community:',
      error
    );
    allowedTemplateIds = COMMUNITY_TEMPLATES;
  }

  // Intersect with node manifest supported adapters if provided
  // (node may not support all template adapters)
  const nodeAdapters = getNodeSupportedAdapters(nodeManifest);

  return allowedTemplateIds
    .filter((id) => TEMPLATE_PRESETS[id])
    .map((id) => ({
      id,
      ...TEMPLATE_PRESETS[id],
      // If node specifies supported adapters, filter template adapters
      adapters: nodeAdapters
        ? TEMPLATE_PRESETS[id].adapters.filter(
            (a) => nodeAdapters.includes(a) || !nodeAdapters.length
          )
        : TEMPLATE_PRESETS[id].adapters,
    }));
}

/**
 * Query a partner's allowed_identity_templates from Registry.
 */
async function getPartnerAllowedTemplates(orgId: string): Promise<string[]> {
  try {
    // TODO: lookupPartner returns partner record with allowed_identity_templates.
    // MVP: try the lookup, return empty array on failure (= all templates).
    const partner = await lookupPartner({ orgId });
    const templates = partner?.allowedIdentityTemplates;
    if (Array.isArray(templates) && templates.length > 0) {
      return templates;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Extract supported adapters from node manifest.
 */
function getNodeSupportedAdapters(
  nodeManifest?: Record<string, unknown>
): string[] | null {
  if (!nodeManifest) return null;
  const caps = nodeManifest.node_capabilities as
    | Record<string, unknown>
    | undefined;
  if (!caps) return null;
  const adapters = caps.supported_adapters;
  if (Array.isArray(adapters)) return adapters as string[];
  return null;
}
