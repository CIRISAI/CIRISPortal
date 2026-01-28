/**
 * Test Environment Configuration
 *
 * Test organization IDs for devtest credential provider.
 * Used only by lib/auth/index.ts for test user fixtures.
 * In production, these values come from the authenticated session.
 */

// Primary test organization (for QA test users)
export const TEST_ORG_ID = 'org-qa-primary-test';

// Secondary test organization (for cross-org testing)
export const TEST_SECONDARY_ORG_ID = 'org-qa-secondary-test';
