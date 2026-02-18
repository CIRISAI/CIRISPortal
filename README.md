# CIRISPortal

**The DMV Clerk's Window — Where Administrators Manage Agent Identity, Integrity, and Licensing**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

Live at **[portal.ciris.ai](https://portal.ciris.ai)**.

## Overview

If CIRISRegistry is the **DMV database** and CIRISVerify is the **DMV office** that checks your documents, CIRISPortal is the **clerk's window** — the web interface where administrators issue driver's licenses, register vehicles, and manage insurance records for AI agents.

CIRISPortal connects to CIRISRegistry via gRPC and provides:

- **Agent Registry** — Register and track AI agents by SHA-256 hash (issuing driver's licenses)
- **Build Registry** — Register builds with Tripwire file integrity manifests, 907+ file SHA-256 hashes per build (vehicle registration and VIN records)
- **License Management** — Issue and manage partner/licensee licenses with capability grants (insurance policies — who is responsible, what they're authorized to do)
- **Organization Management** — Create and manage partner organizations
- **User Management** — Invite users, assign roles (Admin, Partner, Licensee)
- **Key Custody** — Generate Ed25519 keypairs with envelope encryption (AES-256-GCM)
- **Webhook Management** — Configure event-driven notifications
- **Incident Response** — Emergency shutdown and mass revocation controls (suspending licenses, recalling registrations)
- **Compliance** — SOC2/HIPAA/GDPR compliance reporting
- **Audit Logging** — Complete trail of all administrative operations

This is a static ops tool — no AI, just clean administrative workflows.

## Architecture

```
portal.ciris.ai (Next.js 15 + Docker/Watchtower)
         │
         ▼ (gRPC via @grpc/grpc-js)
*.registry.ciris-services-1.ai (CIRISRegistry — Rust gRPC)
         │
         ▼
PostgreSQL (agents, builds, licenses, keys, audit)
```

Production deployment uses Docker with Watchtower for automatic updates.

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

### Docker + Watchtower (Production)

Production deployment at portal.ciris.ai uses Docker with Watchtower for automatic image updates:

```bash
# Build production image
docker build -t cirisportal:latest .

# Run with environment
docker run -d \
  --name cirisportal \
  --env-file .env.production \
  -p 3000:3000 \
  cirisportal:latest
```

Watchtower monitors the container and automatically pulls updated images.

## Project Structure

```
CIRISPortal/
├── app/
│   ├── (auth)/                # Login pages
│   ├── (dashboard)/           # Protected routes
│   │   ├── dashboard/         # Overview
│   │   ├── organizations/     # Organization management
│   │   ├── users/             # User management
│   │   ├── partners/          # Licensee management
│   │   ├── keys/              # Key custody management
│   │   ├── webhooks/          # Webhook management
│   │   ├── audit/             # Audit log viewer
│   │   ├── compliance/        # Compliance reporting
│   │   ├── settings/          # Account settings
│   │   └── admin/             # Admin-only pages
│   │       ├── agents/        #   Agent registry
│   │       ├── builds/        #   Build registry (Tripwire manifests)
│   │       ├── partners/      #   Partner license management
│   │       ├── system-users/  #   System user management
│   │       └── incidents/     #   Incident response
│   └── api/
│       ├── auth/              # NextAuth routes
│       ├── admin/             # Admin API (agents, builds, emergency)
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

**Version**: 0.1.0 (February 2026) | **Live**: [portal.ciris.ai](https://portal.ciris.ai)

### Completed

- [x] NextAuth integration (Google OAuth + devtest credentials)
- [x] gRPC integration with CIRISRegistry
- [x] Organization and user management
- [x] Agent registry management (register, lookup, revoke)
- [x] Build registry with Tripwire file integrity manifests
- [x] License management (issue, view, capability grants)
- [x] Ed25519 key generation (WebCrypto) with envelope encryption
- [x] Webhook management
- [x] Emergency shutdown and mass revocation controls
- [x] Compliance reporting interface
- [x] Audit log viewer
- [x] Security headers and API protection
- [x] Role-based access control (Admin, Partner, Licensee)
- [x] Docker + Watchtower deployment with production gRPC backend

### In Progress

- [ ] ML-DSA-65 post-quantum key generation
- [ ] Full key rotation workflow
- [ ] Audit log cryptographic verification

## CIRIS Ecosystem

| Component         | Purpose                               | URL                                                                      |
| ----------------- | ------------------------------------- | ------------------------------------------------------------------------ |
| **CIRISPortal**   | Admin web interface (this repo)       | [portal.ciris.ai](https://portal.ciris.ai)                               |
| **CIRISRegistry** | Trust registry backend (DMV database) | `*.registry.ciris-services-1.ai`                                         |
| **CIRISVerify**   | Hardware-rooted license verification  | [github.com/CIRISAI/CIRISVerify](https://github.com/CIRISAI/CIRISVerify) |
| **CIRISAgent**    | Ethical AI agent framework            | [github.com/CIRISAI/CIRISAgent](https://github.com/CIRISAI/CIRISAgent)   |

## License

GNU Affero General Public License v3.0

## Contact

- Technical: registry@ciris.ai
- Security: security@ciris.ai
- Sales: sales@ciris.ai
