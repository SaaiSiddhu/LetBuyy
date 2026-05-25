# ────────────────────────────────────────────────────────────
# LetBuyy DNS Configuration — Cloudflare-managed zones
# ────────────────────────────────────────────────────────────
#
# This Terraform file manages DNS records for letbuyy.store
# using Cloudflare as the DNS provider.
#
# Usage:
#   terraform init
#   terraform plan
#   terraform apply
#
# Prerequisites:
#   - Cloudflare API token with Zone:DNS:Edit permissions
#   - Zone ID for letbuyy.store
#
# ────────────────────────────────────────────────────────────

variable "cloudflare_api_token" {
  type        = string
  sensitive   = true
  description = "Cloudflare API token with Zone:DNS:Edit"
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare zone ID for letbuyy.store"
}

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ─── Root Domain → Vercel (Landing Page) ────────────────────
resource "cloudflare_record" "root_a" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  content = "76.76.21.21"
  type    = "A"
  proxied = false
  comment = "Vercel — letbuyy.store (landing)"
}

# ─── WWW → Root redirect ────────────────────────────────────
resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  content = "letbuyy.store"
  type    = "CNAME"
  proxied = false
  comment = "www redirect"
}

# ─── Web App Subdomains → Vercel ─────────────────────────────
resource "cloudflare_record" "admin" {
  zone_id = var.cloudflare_zone_id
  name    = "admin"
  content = "cname.vercel-dns.com"
  type    = "CNAME"
  proxied = false
  comment = "Vercel — admin.letbuyy.store"
}

resource "cloudflare_record" "accounts" {
  zone_id = var.cloudflare_zone_id
  name    = "accounts"
  content = "cname.vercel-dns.com"
  type    = "CNAME"
  proxied = false
  comment = "Vercel — accounts.letbuyy.store"
}

resource "cloudflare_record" "console" {
  zone_id = var.cloudflare_zone_id
  name    = "console"
  content = "cname.vercel-dns.com"
  type    = "CNAME"
  proxied = false
  comment = "Vercel — console.letbuyy.store"
}

resource "cloudflare_record" "team" {
  zone_id = var.cloudflare_zone_id
  name    = "team"
  content = "cname.vercel-dns.com"
  type    = "CNAME"
  proxied = false
  comment = "Vercel — team.letbuyy.store"
}

# ─── API → Cloudflare Workers ────────────────────────────────
resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = "api"
  content = "100::"
  type    = "AAAA"
  proxied = true
  comment = "Cloudflare Workers — api.letbuyy.store"
}

resource "cloudflare_record" "webhooks" {
  zone_id = var.cloudflare_zone_id
  name    = "webhooks"
  content = "100::"
  type    = "AAAA"
  proxied = true
  comment = "Cloudflare Workers — webhooks.letbuyy.store"
}

# ─── Wildcard for User Storefronts ───────────────────────────
resource "cloudflare_record" "storefront_wildcard" {
  zone_id = var.cloudflare_zone_id
  name    = "*"
  content = "cname.vercel-dns.com"
  type    = "CNAME"
  proxied = false
  comment = "Wildcard — *.letbuyy.store (user storefronts)"
}
