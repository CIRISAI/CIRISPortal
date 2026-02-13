# CIRISPortal - Claude Development Guide

## Project Overview

CIRISPortal is the administrative interface for the CIRIS ecosystem, deployed at **portal.ciris.ai**. It provides:

- **Organization Management** - Onboard and manage partner organizations
- **User Management** - Invite users, assign roles within organizations
- **Agent Registry** - Register and manage AI agents
- **Key Custody** - Generate and manage cryptographic keys for partners who don't self-custody
- **License Management** - View and manage partner licenses and capabilities
- **Emergency Controls** - Mass revocation, emergency shutdown
- **Audit Logging** - Cryptographically signed audit trail of all operations

This is a **static ops tool** - no AI agents, just administrative CRUD operations with proper auth and audit trails.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  portal.ciris.ai (CIRISPortal)                                  │
│  Next.js 15 + NextAuth + Cloudflare Pages                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (gRPC via lib/grpc/client.ts)
┌─────────────────────────────────────────────────────────────────┐
│  registry.ciris.ai (CIRISRegistry v1.1.0)                       │
│  Rust gRPC server on port 50052                                 │
│  Services: RegistryService, RegistryAdminService, PortalService │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare Workers KV                                          │
│  Encrypted key storage (envelope encryption)                    │
│  Extensible to HSM/Vault in future                              │
└─────────────────────────────────────────────────────────────────┘
```

## gRPC Integration

The portal communicates with CIRISRegistry via gRPC. The client is in `lib/grpc/client.ts`.

### Services Used

1. **RegistryService** (public operations)
   - `healthCheck` - Health status
   - `lookupAgent` - Agent lookup
   - `lookupPartner` - Partner lookup
   - `getPublicKeys` - Get org public keys
   - `getRevocationList` - Revocation list
   - `getEmergencyStatus` - Emergency status

2. **RegistryAdminService** (admin operations)
   - `registerAgent` / `batchRegisterAgents` - Agent registration
   - `listRegisteredAgents` - List agents with filtering
   - `setEmergencyShutdown` / `clearEmergencyShutdown` - Emergency controls
   - `massRevoke` - Mass revocation
   - `registerWebhook` / `listWebhooks` / `deleteWebhook` - Webhooks
   - `listExpiringLicenses` - License monitoring
   - `getPartnerActivity` - Partner activity stats

3. **PortalService** (org/user management)
   - `getOrganization` / `listOrganizations` - Org CRUD
   - `listOrgUsers` / `createOrgUser` / `updateOrgUser` - User management
   - `listKeys` / `generateKeyPair` / `rotateKey` / `revokeKey` - Key management
   - `getAuditLog` / `exportAuditLog` - Audit logs

### Proto File

The proto definition is at `lib/grpc/ciris_registry.proto` - keep in sync with CIRISRegistry.

## Role-Based Access

| Role               | Scope   | Capabilities                                   |
| ------------------ | ------- | ---------------------------------------------- |
| **Admin**          | Global  | Create orgs, manage all users, revoke licenses |
| **Wise Authority** | Global  | Adjudicate WBD tickets, view audit logs        |
| **Partner Admin**  | Own org | Manage org keys, invite users, view license    |
| **Partner User**   | Own org | Read-only view of org status                   |

## Authentication

### Environment Modes

- **devtest**: Test users enabled, no OAuth required
- **stage**: OAuth required, relaxed domain checks
- **prod**: OAuth required, strict domain validation

### Test Users (devtest only)

```
admin@qa-primary.test / testpass123 - Admin role
user@qa-primary.test / testpass123 - User role
admin@qa-secondary.test / testpass123 - Admin (different org)
```

### Middleware

`middleware.ts` protects all dashboard and API routes. Only `/api/registry/health` is public.

## Key Custody Model

Partners can choose:

1. **Self-custody** - Partner generates and holds their own keys, registers public keys with us
2. **Custodied** - We generate and store keys, partner accesses via authenticated API

For custodied keys:

- Keys generated server-side (Ed25519 + ML-DSA-65 planned)
- Private keys encrypted with envelope encryption (AES-256-GCM)
- Stored in Cloudflare KV (abstracted behind `KeyStore` interface for future HSM migration)
- Signing requests authenticated and logged

### KeyStore Interface (Extensible)

```typescript
interface KeyStore {
  generateKeyPair(orgId: string): Promise<KeyPairMetadata>;
  getPublicKeys(orgId: string): Promise<PublicKeys>;
  sign(
    orgId: string,
    keyId: string,
    message: Uint8Array
  ): Promise<HybridSignature>;
  rotateKeys(orgId: string): Promise<KeyPairMetadata>;
  listKeys(orgId: string): Promise<KeyPairMetadata[]>;
}

// Implementations:
// - CloudflareKVKeyStore (current)
// - VaultKeyStore (future)
// - HSMKeyStore (future)
```

## Project Structure

```
CIRISPortal/
├── app/
│   ├── (auth)/                    # Auth pages (login)
│   ├── (dashboard)/               # Protected dashboard routes
│   │   ├── dashboard/             # Overview with status cards
│   │   ├── admin/                 # Admin pages
│   │   │   ├── agents/            # Agent registry
│   │   │   ├── incidents/         # Emergency controls
│   │   │   └── partners/          # Partner management
│   │   ├── keys/                  # Key management
│   │   ├── audit/                 # Audit log viewer
│   │   ├── webhooks/              # Webhook management
│   │   └── settings/              # User/org settings
│   └── api/
│       ├── auth/[...nextauth]/    # NextAuth routes
│       ├── admin/                 # Admin APIs (agents, emergency, revoke)
│       ├── registry/              # Registry proxy APIs
│       └── webhooks/              # Webhook APIs
├── components/
│   ├── layouts/                   # Sidebar, Header
│   ├── dashboard/                 # Dashboard cards
│   └── ui/                        # shadcn/ui components
├── lib/
│   ├── auth/                      # Auth utilities + test users
│   ├── env.ts                     # Environment configuration
│   ├── grpc/                      # gRPC client + proto
│   │   ├── client.ts              # gRPC client methods
│   │   └── ciris_registry.proto   # Proto definition
│   ├── keystore/                  # KeyStore interface + implementations
│   │   ├── crypto.ts              # Envelope encryption
│   │   └── cloudflare-kv.ts       # KV implementation
│   └── registry-sdk/              # React Query hooks for UI
├── middleware.ts                  # Auth middleware
├── .env.example                   # Environment template
└── wrangler.toml                  # Cloudflare config
```

## Security Requirements

### Authentication

- Google OAuth via NextAuth (prod/stage)
- Test credentials via NextAuth CredentialsProvider (devtest)
- JWT session stored in encrypted cookie
- All API routes protected by middleware

### Security Headers

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'none' (API routes)
```

### Encryption

- Custodied private keys: AES-256-GCM envelope encryption
- Master key stored as Cloudflare secret (`KEY_ENCRYPTION_KEY`)
- Key derivation: `org_key = HKDF(master_key, org_id, "ciris-portal-keys-v1")`

## Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Run CIRISRegistry backend (in another terminal)
cd ../CIRISRegistry && cargo run

# Run development server
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare Pages
npm run deploy
```

## CIRIS Covenant Alignment

This portal operates under the CIRIS Covenant. Key principles:

- **Integrity** - All operations cryptographically logged
- **Transparency** - Audit trail visible to appropriate roles
- **Fail-Secure** - Unknown users have no access; errors deny rather than allow
- **Minimal Data** - Store only what's needed for key custody and audit

## E2E QA Notes (2026-02-13)

### Agent Registration Flow

Portal is the interface to CIRISRegistry for agent registration and key generation.

**Critical architecture**: Signing keys MUST be generated here (Portal → Registry). Agents receive their signing key at install time. CIRISNode verifies all agent signatures against Registry — self-generated keys won't work.

### Known Issues

1. **Agent registration field mapping (BUG-002, FIXED)**: Proto enum names were mismatched (`AGENT_TYPE_CIRIS_CORE` vs `CIRISCARE`). Fixed in commit `159d57f` — Portal form now uses correct proto enum names for agent types, autonomy tiers, and status values.

2. **Keys page 401 (BUG-003, FIXED)**: SDK client fell back to direct Registry HTTP URL (requiring JWT auth the browser can't provide). Fixed in commit `159d57f` — SDK client defaults to Portal's API proxy route (`/api/registry`).

3. **Private key export gap (FIXED)**: Registry now returns the Ed25519 private key in `GenerateKeyPairResponse.ed25519_private_key`. Portal shows a one-time download dialog (`PrivateKeyDownloadDialog`) after key generation — downloads raw 32-byte binary as `agent_signing.key`. Private key is never stored; shown once then cleared from state.

4. **data-testid coverage**: Registration dialog has good coverage (`register-agent-btn`, `input-agent-hash`, `select-agent-type`, `select-autonomy-tier`, `select-identity-template`). Agent list table and key management pages need data-testid attributes for E2E automation.

5. **No Playwright tests yet**: E2E tests should be added in an `e2e/` directory covering agent registration and key generation flows.

### Separation from ethicsengine-portal

- **CIRISPortal** (portal.ciris.ai): Agent registry, key custody, partner management → talks to CIRISRegistry (gRPC)
- **ethicsengine-portal** (portal.ethicsengine.org): Customer billing, analytics → talks to ethicsengine-portal-api → Stripe + CIRISNode

These are completely separate products. Do not confuse them.

## Issue Reporting

When encountering bugs or issues with the portal, **do not attempt to fix CIRISRegistry issues from here**. Instead:

1. Document the error and steps to reproduce
2. Report to the owning org (CIRISRegistry team for backend issues, CIRISPortal team for frontend)
3. Apply workarounds if available while waiting for fixes

## Related Projects

| Project           | Purpose                             |
| ----------------- | ----------------------------------- |
| **CIRISRegistry** | Rust gRPC backend, protocol spec    |
| **CIRISVerify**   | Hardware-rooted verification binary |
| **CIRISAgent**    | Core agent framework                |
