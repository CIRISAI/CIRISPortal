# CIRISPortal - Cloudflare Infrastructure
#
# Manages:
# - Cloudflare Pages project
# - KV namespace for key storage
# - DNS records for portal.ciris.ai
# - Secrets and environment variables
#
# Usage:
#   cd deploy/terraform
#   terraform init
#   terraform plan -var-file=../../secrets/terraform.tfvars
#   terraform apply -var-file=../../secrets/terraform.tfvars

terraform {
  required_version = ">= 1.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  # Backend configuration - uncomment and configure for CIRISBridge
  # backend "s3" {
  #   bucket         = "ciris-terraform-state"
  #   key            = "cirisportal/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "ciris-terraform-locks"
  # }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# =============================================================================
# VARIABLES
# =============================================================================

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Pages and DNS permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for ciris.ai"
  type        = string
}

variable "environment" {
  description = "Environment name (production, staging)"
  type        = string
  default     = "production"
}

variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  sensitive   = true
}

variable "nextauth_secret" {
  description = "NextAuth session encryption secret"
  type        = string
  sensitive   = true
}

variable "key_encryption_key" {
  description = "Master key for envelope encryption of custodied keys"
  type        = string
  sensitive   = true
}

variable "registry_api_url" {
  description = "CIRISRegistry API URL"
  type        = string
  default     = "https://api.registry.ciris.ai"
}

# =============================================================================
# KV NAMESPACE
# =============================================================================

resource "cloudflare_workers_kv_namespace" "keys" {
  account_id = var.cloudflare_account_id
  title      = "cirisportal-keys-${var.environment}"
}

resource "cloudflare_workers_kv_namespace" "sessions" {
  account_id = var.cloudflare_account_id
  title      = "cirisportal-sessions-${var.environment}"
}

resource "cloudflare_workers_kv_namespace" "audit" {
  account_id = var.cloudflare_account_id
  title      = "cirisportal-audit-${var.environment}"
}

# =============================================================================
# PAGES PROJECT
# =============================================================================

resource "cloudflare_pages_project" "portal" {
  account_id        = var.cloudflare_account_id
  name              = "cirisportal"
  production_branch = "main"

  build_config {
    build_command   = "npm run pages:build"
    destination_dir = ".vercel/output/static"
  }

  source {
    type = "github"
    config {
      owner                         = "CIRISAI"
      repo_name                     = "CIRISPortal"
      production_branch             = "main"
      pr_comments_enabled           = true
      deployments_enabled           = true
      production_deployment_enabled = true
    }
  }

  deployment_configs {
    production {
      compatibility_date  = "2024-01-01"
      compatibility_flags = ["nodejs_compat"]

      environment_variables = {
        NEXT_PUBLIC_API_URL = var.registry_api_url
        NEXTAUTH_URL        = "https://portal.ciris.ai"
        NODE_VERSION        = "18"
      }

      secrets = {
        GOOGLE_CLIENT_ID     = var.google_client_id
        GOOGLE_CLIENT_SECRET = var.google_client_secret
        NEXTAUTH_SECRET      = var.nextauth_secret
        KEY_ENCRYPTION_KEY   = var.key_encryption_key
      }

      kv_namespaces = {
        KEYS     = cloudflare_workers_kv_namespace.keys.id
        SESSIONS = cloudflare_workers_kv_namespace.sessions.id
        AUDIT    = cloudflare_workers_kv_namespace.audit.id
      }
    }

    preview {
      compatibility_date  = "2024-01-01"
      compatibility_flags = ["nodejs_compat"]

      environment_variables = {
        NEXT_PUBLIC_API_URL = var.registry_api_url
        NEXTAUTH_URL        = "https://preview.portal.ciris.ai"
        NODE_VERSION        = "18"
      }

      secrets = {
        GOOGLE_CLIENT_ID     = var.google_client_id
        GOOGLE_CLIENT_SECRET = var.google_client_secret
        NEXTAUTH_SECRET      = var.nextauth_secret
        KEY_ENCRYPTION_KEY   = var.key_encryption_key
      }

      kv_namespaces = {
        KEYS     = cloudflare_workers_kv_namespace.keys.id
        SESSIONS = cloudflare_workers_kv_namespace.sessions.id
        AUDIT    = cloudflare_workers_kv_namespace.audit.id
      }
    }
  }
}

# =============================================================================
# DNS RECORDS
# =============================================================================

resource "cloudflare_record" "portal" {
  zone_id = var.cloudflare_zone_id
  name    = "portal"
  type    = "CNAME"
  content = cloudflare_pages_project.portal.subdomain
  proxied = true
  comment = "CIRISPortal - Partner management interface"
}

# Preview subdomain (optional)
resource "cloudflare_record" "portal_preview" {
  zone_id = var.cloudflare_zone_id
  name    = "preview.portal"
  type    = "CNAME"
  content = cloudflare_pages_project.portal.subdomain
  proxied = true
  comment = "CIRISPortal preview deployments"
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "pages_project_name" {
  description = "Cloudflare Pages project name"
  value       = cloudflare_pages_project.portal.name
}

output "pages_subdomain" {
  description = "Cloudflare Pages subdomain"
  value       = cloudflare_pages_project.portal.subdomain
}

output "portal_url" {
  description = "Production URL"
  value       = "https://portal.ciris.ai"
}

output "kv_namespace_keys_id" {
  description = "KV namespace ID for key storage"
  value       = cloudflare_workers_kv_namespace.keys.id
}

output "kv_namespace_sessions_id" {
  description = "KV namespace ID for sessions"
  value       = cloudflare_workers_kv_namespace.sessions.id
}

output "kv_namespace_audit_id" {
  description = "KV namespace ID for audit logs"
  value       = cloudflare_workers_kv_namespace.audit.id
}
