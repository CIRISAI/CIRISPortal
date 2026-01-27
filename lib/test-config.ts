/**
 * Test Environment Configuration
 *
 * These values match the seeded test data in the QA environment.
 * In production, these would come from the authenticated session.
 */

// Primary test organization (full test data)
export const TEST_ORG_ID = '29216928-351b-4963-9fcb-bcaa44383a29';
export const TEST_ADMIN_USER_ID = 'admin@qa-primary.test';
export const TEST_REGULAR_USER_ID = 'user@qa-primary.test';
export const TEST_ACTIVE_KEY_ID = 'ed3696ed-4fc0-464f-82f4-354dcc28d2c2';

// Secondary test organization (minimal data)
export const TEST_SECONDARY_ORG_ID = '64137114-45b9-4ba1-b65d-ccef001848f4';

// For backwards compatibility during migration
export const DEMO_ORG_ID = TEST_ORG_ID;
export const DEMO_USER_ID = TEST_ADMIN_USER_ID;
