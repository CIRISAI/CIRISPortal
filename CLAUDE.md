# CIRISPortal - Claude Development Guide

## Project Overview

CIRISPortal is the administrative interface for the CIRIS ecosystem, deployed at **portal.ciris.ai**. It provides:

- **Organization Management** - Onboard and manage partner organizations
- **User Management** - Invite users, assign roles within organizations
- **Key Custody** - Generate and manage cryptographic keys for partners who don't self-custody
- **License Management** - View and manage partner licenses and capabilities
- **Audit Logging** - Cryptographically signed audit trail of all operations

This is a **static ops tool** - no AI agents, just administrative CRUD operations with proper auth and audit trails.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  portal.ciris.ai (CIRISPortal)                                  │
│  Next.js 15 + NextAuth (Google OAuth) + Cloudflare Pages        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  api.registry.ciris.ai (CIRISRegistry API)                      │
│  Organization, Partner, Agent, Key management                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare Workers KV                                          │
│  Encrypted key storage (envelope encryption)                    │
│  Extensible to HSM/Vault in future                              │
└─────────────────────────────────────────────────────────────────┘
```

## Role-Based Access

| Role               | Scope   | Capabilities                                   |
| ------------------ | ------- | ---------------------------------------------- |
| **Admin**          | Global  | Create orgs, manage all users, revoke licenses |
| **Wise Authority** | Global  | Adjudicate WBD tickets, view audit logs        |
| **Partner Admin**  | Own org | Manage org keys, invite users, view license    |
| **Partner User**   | Own org | Read-only view of org status                   |

## Key Custody Model

Partners can choose:

1. **Self-custody** - Partner generates and holds their own keys, registers public keys with us
2. **Custodied** - We generate and store keys, partner accesses via authenticated API

For custodied keys:

- Keys generated server-side (Ed25519 + ML-DSA-65)
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
│   ├── (auth)/                    # Auth pages (login, etc.)
│   ├── (dashboard)/               # Protected dashboard routes
│   │   ├── dashboard/             # Overview
│   │   ├── organizations/         # Org management (admin)
│   │   ├── partners/              # Partner records
│   │   ├── keys/                  # Key management
│   │   ├── audit/                 # Audit log viewer
│   │   └── settings/              # User/org settings
│   ├── api/
│   │   ├── auth/[...nextauth]/    # NextAuth routes
│   │   └── ...                    # API routes
│   └── ...
├── components/
│   ├── layouts/                   # Sidebar, Header
│   └── ui/                        # shadcn/ui components
├── lib/
│   ├── auth/                      # Auth utilities
│   ├── keystore/                  # KeyStore interface + implementations
│   └── registry-sdk/              # CIRISRegistry API client
└── ...
```

## Security Requirements

### Authentication

- Google OAuth via NextAuth
- Session stored in encrypted cookie (Cloudflare-compatible)
- Role derived from registry API (not stored in session)

### Key Operations

- All key operations require authenticated session
- All key operations logged with:
  - User ID, Org ID, Operation, Timestamp
  - Request hash, Result hash
  - Signed audit entry

### Encryption

- Custodied private keys: AES-256-GCM envelope encryption
- Encryption key stored as Cloudflare secret
- Key derivation: `org_key = HKDF(master_key, org_id, "ciris-portal-keys")`

## Development

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env.local
# Fill in Google OAuth credentials and encryption key

# Run development server
pnpm dev

# Deploy to Cloudflare Pages
pnpm deploy
```

## CIRIS Covenant Alignment

This portal operates under the CIRIS Covenant. Key principles:

- **Integrity** - All operations cryptographically logged
- **Transparency** - Audit trail visible to appropriate roles
- **Fail-Secure** - Unknown users have no access; errors deny rather than allow
- **Minimal Data** - Store only what's needed for key custody and audit

## Related Projects

| Project           | Purpose                             |
| ----------------- | ----------------------------------- |
| **CIRISRegistry** | Protocol definitions and API spec   |
| **CIRISVerify**   | Hardware-rooted verification binary |
| **CIRISAgent**    | Core agent framework                |
