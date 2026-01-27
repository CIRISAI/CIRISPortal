# CIRISPortal - Partner & Organization Management

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

Administrative portal for the CIRIS ecosystem, deployed at **portal.ciris.ai**.

## Overview

CIRISPortal provides:

- **Organization Onboarding** - Create and manage partner organizations
- **User Management** - Invite users, assign roles (Admin, Partner Admin, User)
- **Agent Registry** - Register and manage AI agents in the CIRIS ecosystem
- **Key Custody** - Generate and manage cryptographic signing keys for partners
- **License Management** - View partner licenses and capability grants
- **Emergency Controls** - Mass revocation, emergency shutdown capabilities
- **Audit Logging** - Cryptographically signed trail of all operations

This is a static ops tool - no AI, just clean administrative workflows.

## Architecture

```
portal.ciris.ai (Next.js 15 + Cloudflare Pages)
         │
         ▼ (gRPC)
registry.ciris.ai (CIRISRegistry v1.1.0)
         │
         ▼
Cloudflare Workers KV (Encrypted Key Storage)
```

## Quick Start

```bash
# Clone and install
git clone https://github.com/CIRISAI/CIRISPortal.git
cd CIRISPortal
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local - for devtest mode, defaults work

# Start the registry backend (in another terminal)
cd ../CIRISRegistry && cargo run

# Run development server
npm run dev
```

Visit http://localhost:3000 - you'll be redirected to login.

### Test Users (devtest mode)

| Email                   | Password    | Role  |
| ----------------------- | ----------- | ----- |
| admin@qa-primary.test   | testpass123 | Admin |
| user@qa-primary.test    | testpass123 | User  |
| admin@qa-secondary.test | testpass123 | Admin |

## Environment Variables

See `.env.example` for full documentation. Key variables:

| Variable                | Required | Purpose                                   |
| ----------------------- | -------- | ----------------------------------------- |
| `APP_ENV`               | Yes      | `devtest` / `stage` / `prod`              |
| `REGISTRY_GRPC_URL`     | Yes      | gRPC backend (default: `localhost:50052`) |
| `NEXTAUTH_URL`          | Yes      | OAuth callback URL                        |
| `NEXTAUTH_SECRET`       | Yes      | JWT signing secret (32+ chars)            |
| `GOOGLE_CLIENT_ID`      | Prod     | Google OAuth client ID                    |
| `GOOGLE_CLIENT_SECRET`  | Prod     | Google OAuth secret                       |
| `KEY_ENCRYPTION_KEY`    | Keys     | Envelope encryption key (32 bytes)        |
| `ALLOWED_EMAIL_DOMAINS` | Prod     | Restrict OAuth to domains                 |

## Deployment

### Cloudflare Pages

```bash
# Set secrets
wrangler secret put NEXTAUTH_SECRET --env production
wrangler secret put GOOGLE_CLIENT_ID --env production
wrangler secret put GOOGLE_CLIENT_SECRET --env production
wrangler secret put KEY_ENCRYPTION_KEY --env production

# Deploy
npm run deploy
```

## Project Structure

```
CIRISPortal/
├── app/
│   ├── (auth)/                # Login pages
│   ├── (dashboard)/           # Protected routes
│   │   ├── dashboard/         # Overview
│   │   ├── admin/             # Admin pages (agents, incidents, partners)
│   │   ├── keys/              # Key custody management
│   │   ├── audit/             # Audit log viewer
│   │   ├── webhooks/          # Webhook management
│   │   └── settings/          # Settings
│   └── api/
│       ├── auth/              # NextAuth routes
│       ├── admin/             # Admin API (agents, emergency, revoke)
│       ├── registry/          # Registry API proxy
│       └── webhooks/          # Webhook API
├── components/
│   ├── layouts/               # Sidebar, Header
│   └── ui/                    # shadcn/ui components
├── lib/
│   ├── auth/                  # Auth utilities + test users
│   ├── grpc/                  # gRPC client for CIRISRegistry
│   ├── keystore/              # Key custody (KV + future HSM)
│   └── registry-sdk/          # React Query hooks
└── middleware.ts              # Auth protection for routes
```

## Security

- All API routes require authentication (except `/api/registry/health`)
- Security headers: X-Frame-Options, CSP, X-Content-Type-Options, etc.
- Envelope encryption for custodied keys (AES-256-GCM)
- Domain restrictions for OAuth in production

## Roles

| Role          | Scope   | Capabilities                                   |
| ------------- | ------- | ---------------------------------------------- |
| Admin         | Global  | Create orgs, manage agents, emergency controls |
| Partner Admin | Own org | Manage keys, invite org users                  |
| Partner User  | Own org | Read-only access                               |

## Development Status

**Version**: 0.1.0 (January 2026)

### Completed

- [x] NextAuth integration (Google OAuth + test credentials)
- [x] gRPC integration with CIRISRegistry v1.1.0
- [x] Agent registry management
- [x] Emergency shutdown controls
- [x] Mass revocation interface
- [x] Webhook management
- [x] License expiry monitoring
- [x] Security headers and API protection
- [x] Ed25519 key generation (WebCrypto)
- [x] Envelope encryption implementation

### In Progress

- [ ] ML-DSA-65 post-quantum key generation
- [ ] Full key rotation workflow
- [ ] Audit log viewer with verification

## License

GNU Affero General Public License v3.0

## Contact

- Technical: registry@ciris.ai
- Sales: sales@ciris.ai
