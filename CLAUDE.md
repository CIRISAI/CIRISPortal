# CIRISPortal - Claude Development Guide

## Project Overview

CIRISPortal is the administrative interface for the CIRIS ecosystem. It provides:

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
│  CIRISPortal                                                    │
│  Next.js 15 + NextAuth + Cloudflare Pages                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (gRPC via lib/grpc/client.ts)
┌─────────────────────────────────────────────────────────────────┐
│  CIRISRegistry (Rust gRPC server)                               │
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

Configure test users via environment variables or the auth config in `lib/auth/`. See `.env.example` for details.

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
- Key derivation: HKDF-based per-org key derivation

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

## CIRIS Accord Alignment

This portal operates under the CIRIS Accord. Key principles:

- **Integrity** - All operations cryptographically logged
- **Transparency** - Audit trail visible to appropriate roles
- **Fail-Secure** - Unknown users have no access; errors deny rather than allow
- **Minimal Data** - Store only what's needed for key custody and audit

## E2E QA Notes (2026-02-13)

### Agent Registration Flow

Portal is the interface to CIRISRegistry for agent registration and key generation.

**Critical architecture**: Signing keys MUST be generated here (Portal → Registry). Agents receive their signing key at install time. CIRISNode verifies all agent signatures against Registry — self-generated keys won't work.

### Development Notes

- Registration dialog has `data-testid` coverage (`register-agent-btn`, `input-agent-hash`, `select-agent-type`, `select-autonomy-tier`, `select-identity-template`). Agent list table and key management pages need additional `data-testid` attributes for E2E automation.
- E2E tests should be added in an `e2e/` directory covering agent registration and key generation flows.
- Portal form uses proto-compatible enum names for agent types, autonomy tiers, and status values. Keep `lib/grpc/client.ts` enum mappings in sync with the proto definition.
- SDK client uses Portal's API proxy route (`/api/registry`) by default to avoid CORS and auth issues in the browser.

## Issue Reporting

When encountering bugs or issues with the portal, **do not attempt to fix CIRISRegistry issues from here**. Instead:

1. Document the error and steps to reproduce
2. Report to the owning org (CIRISRegistry team for backend issues, CIRISPortal team for frontend)
3. Apply workarounds if available while waiting for fixes

## Stripe Billing Integration

CIRISPortal includes Stripe-based billing for identity activation and assurance tier subscriptions. The billing code lives in `lib/stripe/`.

### Pricing Model

Identity activation uses a two-part cost **per agent identity** for Sybil resistance:

1. **Issuance fee** (non-refundable) — covers registry infrastructure, prevents identity churn
2. **Identity bond** — forfeited on revocation; admin can manually refund via Stripe dashboard

Community users must pay per key — no free key generation. Professional+ tiers include key generation in their subscription but still pay the one-time activation cost per identity.

Community tier distinguishes **CIRIS agents** (built on the CIRIS framework) from **Non-CIRIS agents** (third-party agents using the CIRIS identity system). Both cost the same but are tracked as separate Stripe products.

| Tier            | Issuance Fee/Key | Bond/Key  | Monthly/Agent | Activation/Key | Max Keys  |
| --------------- | ---------------- | --------- | ------------- | -------------- | --------- |
| Community       | $0.50            | $1.00     | Free          | $1.50          | 5         |
| Professional    | $5.00            | $10.00    | $10/mo        | $15.00         | 50        |
| Enterprise      | $25.00           | $100.00   | $100/mo       | $125.00        | 500       |
| Safety-Critical | $250.00          | $1,000.00 | Custom        | $1,250.00      | Unlimited |

### Stripe Product Catalog (CIRIS L3C account)

All products are in the CIRIS L3C Stripe account. Product IDs and price IDs for reference:

**Activation Products (one-time):**

| Product                                       | Price   | Product ID            | Price ID                         |
| --------------------------------------------- | ------- | --------------------- | -------------------------------- |
| CIRIS Agent Identity Issuance - Community     | $0.50   | `prod_U01iZuUFQSlPo7` | `price_1T21eqD6B7ILDjd5C8iHI7pw` |
| Non-CIRIS Agent Identity Issuance - Community | $0.50   | `prod_U01mpLgxsnnv8k` | `price_1T21jCD6B7ILDjd5WqNivC5x` |
| CIRIS Agent Identity Bond - Community         | $1.00   | `prod_U01ou6EThvQuGU` | `price_1T21kwD6B7ILDjd5XptA9cog` |
| Non-CIRIS Agent Identity Bond - Community     | $1.00   | `prod_U027IZgEsDSKNd` | `price_1T222sD6B7ILDjd5npLTxLfT` |
| CIRIS Agent Identity Issuance - Professional  | $5.00   | `prod_U01tpykUBs3jwH` | `price_1T21pYD6B7ILDjd5epdFRNiA` |
| CIRIS Agent Identity Bond - Professional      | $10.00  | `prod_U0299biZzn1kNl` | `price_1T225LD6B7ILDjd5aosiB7G5` |
| CIRIS Agent Identity Issuance - Enterprise    | $25.00  | `prod_U02B4FFUVPkCom` | `price_1T226tD6B7ILDjd5TvqpGGxy` |
| CIRIS Agent Identity Bond - Enterprise        | $100.00 | `prod_U02CSpvnSuNgj6` | `price_1T228OD6B7ILDjd58XMMLu63` |

**Subscription Products (recurring assurance):**

| Product                      | Price      | Product ID            | Price ID                         |
| ---------------------------- | ---------- | --------------------- | -------------------------------- |
| CIRIS Professional Assurance | $10.00/mo  | `prod_U02DvFOlJXdtGi` | `price_1T229WD6B7ILDjd5zbseJIvj` |
| CIRIS Enterprise Assurance   | $100.00/mo | `prod_U01xhEJuxMsLxC` | `price_1T21tOD6B7ILDjd5Dv21MlWQ` |

### Stripe Files

| File                                | Purpose                                                       |
| ----------------------------------- | ------------------------------------------------------------- |
| `lib/stripe/service.ts`             | Stripe SDK wrapper (customer, checkout, refund, subscription) |
| `lib/stripe/config.ts`              | Environment variable accessor for Stripe keys and price IDs   |
| `lib/stripe/tiers.ts`               | Tier definitions (prices in cents, features, agent limits)    |
| `app/api/stripe/webhook/route.ts`   | Stripe webhook handler (payment events)                       |
| `app/api/stripe/checkout/route.ts`  | Checkout session creation (activation + subscription)         |
| `app/api/stripe/portal/route.ts`    | Customer billing portal session                               |
| `app/(dashboard)/pricing/page.tsx`  | Tier comparison / upgrade page                                |
| `app/(dashboard)/activate/page.tsx` | Post-signup activation payment page                           |
| `components/ui/tier-badge.tsx`      | Tier badge and indicator components                           |

### Secrets Required (backend team)

The following secrets must be set in production (via `wrangler secret put` or equivalent):

| Secret                  | Where to get it                                          |
| ----------------------- | -------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | Stripe Dashboard > Developers > API keys (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard > Developers > Webhooks (`whsec_...`)   |

The price IDs above are test-mode IDs. For production, create corresponding live-mode products in Stripe and set these env vars:

```
STRIPE_PRICE_ISSUANCE_COMMUNITY=price_...
STRIPE_PRICE_BOND_COMMUNITY=price_...
STRIPE_PRICE_ISSUANCE_PRO=price_...
STRIPE_PRICE_BOND_PRO=price_...
STRIPE_PRICE_ISSUANCE_ENTERPRISE=price_...
STRIPE_PRICE_BOND_ENTERPRISE=price_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_ENTERPRISE=price_...
STRIPE_PRODUCT_ID_SAFETY=prod_...
```

For Non-CIRIS community products, additional env vars are needed (see `.env.example`).

### Current Billing Status

- **Community tier**: Self-service via Stripe ($1.50 per agent identity activation)
- **Professional/Enterprise/Safety-Critical**: Blocked behind `sales@ciris.ai` (not yet self-service)
- All upgrade buttons/links redirect to `mailto:sales@ciris.ai`
- Subscription checkout API returns 403 directing users to sales email
- Community tier provided AS-IS without warranty (UCC 2-316 compliant disclaimers on activation page)
- Feature language avoids "guarantees" or "liability backing" to not contradict AS-IS disclaimers

### Node Access Control

CIRISNode instances restrict which org IDs they service:

- **node.ciris.ai**: Restricted to CIRIS.ai org (full features including WBD routing)
- **ethicsengine.org**: Open to all orgs (benchmarking only)
- WBD routing via node.ciris.ai will be an additional charge for community agents

## Related Projects

| Project           | Purpose                             |
| ----------------- | ----------------------------------- |
| **CIRISRegistry** | Rust gRPC backend, protocol spec    |
| **CIRISVerify**   | Hardware-rooted verification binary |
| **CIRISAgent**    | Core agent framework                |
