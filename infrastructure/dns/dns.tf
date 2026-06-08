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

# ─── Custom-domain CNAME target owned by LetBuyy ─────────────
resource "cloudflare_record" "connect" {
  zone_id = var.cloudflare_zone_id
  name    = "connect"
  content = "cname.vercel-dns.com"
  type    = "CNAME"
  proxied = false
  comment = "LetBuyy custom-domain target — connect.letbuyy.store"
}

# Reserved for future shopper OIDC. Do not activate until the
# @letbuyy/auth-core ShopperIdentityProvider seam is replaced by a central issuer.
# resource "cloudflare_record" "shopper_identity_id" {
#   zone_id = var.cloudflare_zone_id
#   name    = "id"
#   content = "cname.vercel-dns.com"
#   type    = "CNAME"
#   proxied = false
#   comment = "Reserved — id.letbuyy.store shopper identity"
# }

# ────────────────────────────────────────────────────────────
# WAF — block vulnerability-scanner traffic at the edge
# ────────────────────────────────────────────────────────────
# LetBuyy runs on Cloudflare Workers (no PHP, no WordPress), so every
# wp-*, *.php, /.env and /.git probe is pure noise. Blocking these at the
# edge stops bot scans before they ever invoke a Worker or touch KV —
# protecting the free-tier budget. (These scans were the Netherlands
# traffic hammering api-staging.letbuyy.store in the observability logs.)
#
# NOTE: the API token must also carry Zone WAF / Firewall Services edit
#       permission (the DNS-only token is not sufficient). A zone holds at
#       most ONE custom-rules ruleset per phase — if you have already added
#       custom rules in the dashboard, import them before applying this.

locals {
  waf_scanner_paths = [
    "wp-includes",
    "wp-admin",
    "wp-login",
    "wlwmanifest",
    "/wp-content/",
    "/wordpress/",
    "/.env",
    "/.git/",
  ]

  waf_scanner_expression = join(" or ", concat(
    [for path in local.waf_scanner_paths : "(lower(http.request.uri.path) contains \"${path}\")"],
    ["(ends_with(lower(http.request.uri.path), \".php\"))"],
  ))
}

resource "cloudflare_ruleset" "waf_block_scanners" {
  zone_id     = var.cloudflare_zone_id
  name        = "LetBuyy block vulnerability scanners"
  description = "Edge-block WordPress/PHP/secret-file scanner probes (LetBuyy serves no PHP/WP)."
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules {
    ref         = "block_vuln_scanners"
    action      = "block"
    expression  = local.waf_scanner_expression
    description = "Block wp-*, *.php, /.env, /.git scanner traffic"
    enabled     = true
  }
}
