# CIRISPortal - Partner & Organization Management

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

Administrative portal for the CIRIS ecosystem, deployed at **portal.ciris.ai**.

## Overview

CIRISPortal provides:

- **Organization Onboarding** - Create and manage partner organizations
- **User Management** - Invite users, assign roles (Admin, Partner Admin, User)
- **Key Custody** - Generate and manage cryptographic signing keys for partners
- **License Management** - View partner licenses and capability grants
- **Audit Logging** - Cryptographically signed trail of all operations

This is a static ops tool - no AI, just clean administrative workflows.

## Architecture

```
portal.ciris.ai (Next.js + Cloudflare Pages)
         │
         ▼
api.registry.ciris.ai (CIRISRegistry API)
         │
         ▼
Cloudflare Workers KV (Encrypted Key Storage)
```

## Quick Start

```bash
# Clone and install
git clone https://github.com/CIRISAI/CIRISPortal.git
cd CIRISPortal
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Google OAuth credentials

# Run development server
pnpm dev
```

Visit http://localhost:3000

## Deployment

Deployed to Cloudflare Pages at **portal.ciris.ai**.

```bash
# Build and deploy
pnpm deploy
```

## Project Structure

```
CIRISPortal/
├── app/
│   ├── (auth)/                # Login pages
│   ├── (dashboard)/           # Protected routes
│   │   ├── dashboard/         # Overview
│   │   ├── organizations/     # Org management (admin)
│   │   ├── partners/          # Partner records
│   │   ├── keys/              # Key custody management
│   │   ├── audit/             # Audit log viewer
│   │   └── settings/          # Settings
│   └── api/auth/              # NextAuth routes
├── components/
│   ├── layouts/               # Sidebar, Header
│   └── ui/                    # shadcn/ui components
├── lib/
│   ├── auth/                  # Auth utilities
│   ├── keystore/              # Key custody (KV + future HSM)
│   └── registry-sdk/          # CIRISRegistry API client
└── ...
```

## Environment Variables

```env
# Required
NEXT_PUBLIC_API_URL=https://api.registry.ciris.ai
NEXTAUTH_URL=https://portal.ciris.ai
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Key Custody
KEY_ENCRYPTION_KEY=<generate with: openssl rand -base64 32>
```

## Roles

| Role          | Scope   | Can Do                                |
| ------------- | ------- | ------------------------------------- |
| Admin         | Global  | Create orgs, manage all users, revoke |
| Partner Admin | Own org | Manage keys, invite org users         |
| Partner User  | Own org | Read-only access                      |

## Key Custody

Partners can:

1. **Self-custody** - Generate own keys, register public keys
2. **Custodied** - We generate and hold keys, partner accesses via portal

Custodied keys use envelope encryption (AES-256-GCM) with storage abstracted behind a `KeyStore` interface for future HSM/Vault migration.

## Development Status

**Version**: 0.1.0 (January 2026)

### Current (v0.1.0)

- [ ] Google OAuth integration
- [ ] Organization CRUD
- [ ] User invitation flow
- [ ] Key generation (Ed25519 + ML-DSA-65)
- [ ] Cloudflare KV key storage
- [ ] Basic audit logging

### Planned (v0.2.0)

- [ ] Partner license display
- [ ] Key rotation workflow
- [ ] Enhanced audit viewer
- [ ] Wise Authority deferral queue

## License

GNU Affero General Public License v3.0

## Contact

- Technical: registry@ciris.ai
- Sales: sales@ciris.ai
