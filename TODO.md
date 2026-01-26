# CIRISPortal - Development Status & TODOs

**Last Updated:** 2026-01-26
**Status:** Scaffolding Complete, Awaiting Implementation

---

## Current Status

### Completed

- [x] Project scaffolding from SageGUI
- [x] Updated branding (CIRISPortal, emerald theme)
- [x] New navigation structure (Organizations, Partners, Keys, Audit)
- [x] Stub pages for all sections
- [x] KeyStore interface with Cloudflare KV implementation (placeholder)
- [x] Terraform configuration for Cloudflare Pages + KV
- [x] Ansible playbook with CIRISBridge integration
- [x] Environment configuration (.env.example, wrangler.toml)
- [x] CLAUDE.md development guide

---

## TODOs

### P0 - Critical Path

#### Authentication

- [ ] Wire up NextAuth with Google OAuth provider
  - File: `app/api/auth/[...nextauth]/route.ts`
  - Deps: Google OAuth credentials in Cloudflare secrets
- [ ] Create auth middleware for route protection
  - File: `middleware.ts`
- [ ] Add session handling compatible with Cloudflare Workers
  - May need KV-based session storage

#### KeyStore Implementation

- [ ] Implement actual Ed25519 key generation (WebCrypto)
  - File: `lib/keystore/cloudflare-kv.ts`
- [ ] Implement ML-DSA-65 key generation
  - **BLOCKER:** Need post-quantum crypto library compatible with CF Workers
  - Options: liboqs-js, pqcrypto-wasm, or custom implementation
- [ ] Implement envelope encryption (AES-256-GCM)
- [ ] Implement key signing operations
- [ ] Add key rotation with grace period logic

### P1 - Core Functionality

#### Organizations Page

- [ ] Create new organization form
- [ ] Organization detail view
- [ ] User invitation flow
- [ ] License type selection

#### Partners Page

- [ ] Connect to CIRISRegistry API for partner records
- [ ] Display capability grants
- [ ] License status and expiry warnings

#### Keys Page

- [ ] Connect to KeyStore for real key operations
- [ ] Public key export/download
- [ ] Key rotation UI with confirmation
- [ ] Display signing history

#### Audit Page

- [ ] Connect to audit KV namespace
- [ ] Signature verification UI
- [ ] Export functionality
- [ ] Filter and search

### P2 - Polish & Integration

#### API Integration

- [ ] Replace `lib/ciris-sdk/` with registry-focused SDK
- [ ] Add React Query hooks for data fetching
- [ ] Error handling and loading states

#### UI Components

- [ ] Add shadcn/ui components
- [ ] Form validation with Zod
- [ ] Toast notifications
- [ ] Loading skeletons

#### Settings Page

- [ ] Update from SageGUI GDPR settings to Portal settings
- [ ] User profile management
- [ ] Organization settings (for Partner Admins)

---

## Dependencies on CIRISRegistry

### API Endpoints Required

CIRISPortal depends on the following CIRISRegistry API endpoints:

| Endpoint                       | Method   | Purpose                    | Status     |
| ------------------------------ | -------- | -------------------------- | ---------- |
| `/v1/partners/{id}`            | GET      | Fetch partner record       | **NEEDED** |
| `/v1/partners`                 | POST     | Create partner record      | **NEEDED** |
| `/v1/partners/{id}`            | PATCH    | Update partner record      | **NEEDED** |
| `/v1/agents/{hash}`            | GET      | Lookup agent (for display) | Spec'd     |
| `/v1/revocations`              | GET      | Get revocation list        | Spec'd     |
| `/v1/organizations`            | GET/POST | Org management             | **NEEDED** |
| `/v1/organizations/{id}/users` | GET/POST | User management            | **NEEDED** |

### Proto Additions Needed

CIRISRegistry's `ciris_registry.proto` may need:

```protobuf
// Organization management (not in current spec)
message Organization {
  string org_id = 1;
  string name = 2;
  repeated string admin_emails = 10;
  repeated PartnerRecord partners = 20;
  // ...
}

// User management
message OrgUser {
  string user_id = 1;
  string email = 2;
  OrgRole role = 3;
  string org_id = 4;
}

enum OrgRole {
  ORG_ROLE_UNSPECIFIED = 0;
  ORG_ADMIN = 1;
  ORG_USER = 2;
}
```

### Signing Key Registration

When CIRISPortal generates custodied keys, the public keys need to be registered with CIRISRegistry:

```
Portal generates key → Registers public key with Registry → Registry includes in PartnerRecord
```

This requires a key registration endpoint:

- `POST /v1/partners/{id}/keys` - Register public key
- `DELETE /v1/partners/{id}/keys/{key_id}` - Revoke key

---

## Infrastructure Dependencies

### CIRISBridge Integration

CIRISBridge needs the following for CIRISPortal deployment:

1. **Vault Secrets Path:** `secret/data/ciris/portal`
   - cloudflare_api_token
   - cloudflare_account_id
   - cloudflare_zone_id
   - google_client_id
   - google_client_secret
   - nextauth_secret
   - key_encryption_key

2. **DNS Management:** CNAME for `portal.ciris.ai`

3. **Terraform State:** S3 backend configuration for state storage

### Google OAuth Setup

1. Create OAuth 2.0 Client ID in Google Cloud Console
2. Add authorized redirect URIs:
   - `https://portal.ciris.ai/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (dev)
3. Store credentials in CIRISBridge Vault

---

## Open Questions

1. **ML-DSA-65 in Workers:** Which library for post-quantum crypto in Cloudflare Workers environment?

2. **Key Custody Consent:** Do we need explicit consent UI before generating custodied keys?

3. **Audit Retention:** How long to retain audit logs in KV? Cost implications?

4. **Multi-tenancy:** Should the portal support multiple CIRIS deployments or just ciris.ai?

---

## File Structure Reference

```
CIRISPortal/
├── app/
│   ├── (dashboard)/
│   │   ├── audit/page.tsx           # Audit log viewer
│   │   ├── dashboard/page.tsx       # Overview dashboard
│   │   ├── keys/page.tsx            # Key management
│   │   ├── organizations/page.tsx   # Org management
│   │   ├── partners/page.tsx        # Partner records
│   │   └── settings/page.tsx        # Settings
│   ├── api/auth/                    # TODO: NextAuth routes
│   └── ...
├── components/layouts/
│   ├── header.tsx
│   └── sidebar.tsx
├── lib/
│   ├── keystore/                    # Key custody abstraction
│   │   ├── cloudflare-kv.ts         # KV implementation
│   │   ├── factory.ts               # Store factory
│   │   ├── index.ts
│   │   └── types.ts                 # Interfaces
│   └── ciris-sdk/                   # TODO: Replace with registry SDK
├── deploy/
│   ├── ansible/
│   │   ├── playbook.yml             # Main deployment
│   │   ├── cirisbridge.yml          # CIRISBridge integration
│   │   ├── vars/
│   │   └── inventory/
│   └── terraform/
│       └── main.tf                  # Cloudflare infrastructure
├── CLAUDE.md                        # AI development guide
├── README.md
└── TODO.md                          # This file
```
