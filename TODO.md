# CIRISPortal - Development Status & TODOs

**Last Updated:** 2026-01-26
**Status:** Core Features Complete, Polish Phase

---

## Current Status

### Completed

- [x] Project scaffolding and branding
- [x] Next.js 15 App Router structure
- [x] NextAuth integration (Google OAuth + test credentials)
- [x] gRPC integration with CIRISRegistry v1.1.0
- [x] Middleware auth protection for all routes
- [x] Security headers (X-Frame-Options, CSP, etc.)
- [x] Environment configuration (devtest/stage/prod modes)
- [x] Dashboard with status cards
- [x] Agent registry management (register, list, search)
- [x] Emergency shutdown controls
- [x] Mass revocation interface
- [x] Webhook management
- [x] Partner activity monitoring
- [x] License expiry tracking
- [x] KeyStore interface with envelope encryption
- [x] Ed25519 key generation (WebCrypto)
- [x] React Query SDK for data fetching
- [x] shadcn/ui component library

---

## TODOs

### P0 - Critical Path

#### Post-Quantum Cryptography

- [ ] Implement ML-DSA-65 key generation
  - **BLOCKER:** Need post-quantum crypto library compatible with Cloudflare Workers
  - Options: liboqs-wasm, pqcrypto-wasm
  - File: `lib/keystore/crypto.ts`

#### Key Operations

- [ ] Full key rotation workflow with grace period
- [ ] Key signing endpoint for custodied keys
- [ ] Key escrow recovery flow

### P1 - Core Functionality

#### Audit Page

- [ ] Connect to audit gRPC methods
- [ ] Signature verification UI
- [ ] Export functionality (CSV, JSON)
- [ ] Advanced filtering

#### Organizations Page

- [ ] Organization CRUD operations
- [ ] User invitation flow
- [ ] License type selection

#### Settings Page

- [ ] User profile management
- [ ] Organization settings (for Partner Admins)
- [ ] Notification preferences

### P2 - Polish & Integration

#### UI Improvements

- [ ] Loading skeletons for all data fetching
- [ ] Better error messages with retry
- [ ] Mobile responsive design
- [ ] Dark mode support

#### Testing

- [ ] Unit tests for crypto functions
- [ ] Integration tests for gRPC client
- [ ] E2E tests with Playwright

#### Monitoring

- [ ] Error tracking (Sentry)
- [ ] Analytics integration
- [ ] Performance monitoring

---

## API Endpoints

### Implemented

| Endpoint                                     | Method   | Purpose               | Status |
| -------------------------------------------- | -------- | --------------------- | ------ |
| `/api/admin/agents`                          | GET/POST | Agent management      | Done   |
| `/api/admin/emergency`                       | GET/POST | Emergency controls    | Done   |
| `/api/admin/revoke`                          | GET/POST | Revocation list       | Done   |
| `/api/admin/partners`                        | GET      | Partner listing       | Done   |
| `/api/webhooks`                              | GET/POST | Webhook management    | Done   |
| `/api/registry/health`                       | GET      | Health check (public) | Done   |
| `/api/registry/keys`                         | GET/POST | Key operations        | Done   |
| `/api/registry/users`                        | GET/POST | User management       | Done   |
| `/api/registry/audit`                        | GET      | Audit log             | Done   |
| `/api/registry/admin/licenses/expiring`      | GET      | Expiring licenses     | Done   |
| `/api/registry/registry/partners/[id]`       | GET      | Partner lookup        | Done   |
| `/api/registry/admin/partners/[id]/activity` | GET      | Partner activity      | Done   |

### Pending

| Endpoint                  | Method | Purpose                 | Blocked By |
| ------------------------- | ------ | ----------------------- | ---------- |
| `/api/registry/keys/sign` | POST   | Sign with custodied key | ML-DSA-65  |

---

## Infrastructure

### Cloudflare Secrets Required

```bash
wrangler secret put NEXTAUTH_SECRET --env production
wrangler secret put GOOGLE_CLIENT_ID --env production
wrangler secret put GOOGLE_CLIENT_SECRET --env production
wrangler secret put KEY_ENCRYPTION_KEY --env production
```

### KV Namespace Setup

```bash
wrangler kv:namespace create KEYS
# Add the ID to wrangler.toml
```

---

## Known Issues

1. **ML-DSA-65 not implemented** - Waiting for WASM library compatible with Cloudflare Workers
2. **Audit verification UI missing** - Need to implement signature verification display
3. **Key rotation grace period** - Backend supports it, UI needs work

---

## File Structure Reference

```
CIRISPortal/
├── app/
│   ├── (auth)/login/              # Login page
│   ├── (dashboard)/
│   │   ├── dashboard/             # Overview dashboard
│   │   ├── admin/
│   │   │   ├── agents/            # Agent registry
│   │   │   ├── incidents/         # Emergency controls
│   │   │   └── partners/          # Partner management
│   │   ├── audit/                 # Audit log viewer
│   │   ├── keys/                  # Key management
│   │   ├── users/                 # User management
│   │   ├── webhooks/              # Webhooks
│   │   ├── verify/                # Agent verification
│   │   └── settings/              # Settings
│   └── api/                       # API routes
├── components/
│   ├── dashboard/                 # Dashboard cards
│   ├── layouts/                   # Sidebar, Header
│   └── ui/                        # shadcn/ui components
├── lib/
│   ├── auth/                      # Auth config + test users
│   ├── grpc/                      # gRPC client
│   ├── keystore/                  # Key custody
│   └── registry-sdk/              # React Query hooks
├── middleware.ts                  # Auth middleware
├── .env.example                   # Environment template
├── wrangler.toml                  # Cloudflare config
├── CLAUDE.md                      # Dev guide
└── TODO.md                        # This file
```
