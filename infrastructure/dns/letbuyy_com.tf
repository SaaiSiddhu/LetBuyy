# ────────────────────────────────────────────────────────────
# LetBuyy DNS Configuration — letbuyy.com (control-plane zone)
# ────────────────────────────────────────────────────────────
#
# Target topology per docs/governance/domain-topology-governance.md.
# This is the PARALLEL STAND-UP zone (migration §13 step 1): it brings the
# platform control plane up on letbuyy.com alongside the existing
# letbuyy.com topology. Storefronts stay on letbuyy.com (see dns.tf) and
# never move.
#
# PREREQUISITES (account actions — not Terraform):
#   1. Add letbuyy.com to Cloudflare and point the registrar nameservers at
#      Cloudflare.
#   2. Provide the zone ID via var.cloudflare_zone_id_com.
#   3. Attach each production host to its Vercel project (config/vercel/projects.json)
#      so Vercel issues certs.
#   4. The api/webhooks records below only resolve once the corresponding
#      Worker routes are moved to *.letbuyy.com (services/*/wrangler.toml +
#      config/runtime/cloudflare-topology.json). Until then they are inert.
#
# Reuses the provider + cloudflare_api_token variable declared in dns.tf
# (same Terraform module) — do NOT re-declare them here.
# ────────────────────────────────────────────────────────────

variable "cloudflare_zone_id_com" {
  type        = string
  description = "Cloudflare zone ID for letbuyy.com"
}

# ─── Root Domain + WWW → Vercel (marketing-site) ─────────────
resource "cloudflare_record" "com_root_a" {
  zone_id = var.cloudflare_zone_id_com
  name    = "@"
  content = "76.76.21.21"
  type    = "A"
  proxied = false
  comment = "Vercel — letbuyy.com (marketing-site)"
}

resource "cloudflare_record" "com_www" {
  zone_id = var.cloudflare_zone_id_com
  name    = "www"
  content = "cname.vercel-dns.com"
  type    = "CNAME"
  proxied = false
  comment = "Vercel — www.letbuyy.com (marketing-site)"
}

# ─── Platform app subdomains → Vercel ────────────────────────
# proxied = false so Vercel manages TLS for each host.
locals {
  com_vercel_hosts = {
    accounts  = "identity-platform (canonical auth owner)"
    admin     = "merchant-control-plane"
    apps      = "app-marketplace"
    themes    = "theme-marketplace"
    developer = "developer-portal"
    console   = "platform-console (internal-restricted)"
    team      = "platform-operations-portal (internal-restricted)"
    checkout  = "storefront-runtime hosted checkout origin"
  }
}

resource "cloudflare_record" "com_vercel" {
  for_each = local.com_vercel_hosts
  zone_id  = var.cloudflare_zone_id_com
  name     = each.key
  content  = "cname.vercel-dns.com"
  type     = "CNAME"
  proxied  = false
  comment  = "Vercel — ${each.key}.letbuyy.com (${each.value})"
}

# ─── API + Webhooks → Cloudflare Workers (orange-cloud) ──────
# Inert until the Worker routes move to *.letbuyy.com (see PREREQUISITES #4).
resource "cloudflare_record" "com_api" {
  zone_id = var.cloudflare_zone_id_com
  name    = "api"
  content = "100::"
  type    = "AAAA"
  proxied = true
  comment = "Cloudflare Workers — api.letbuyy.com (api-gateway)"
}

resource "cloudflare_record" "com_webhooks" {
  zone_id = var.cloudflare_zone_id_com
  name    = "webhooks"
  content = "100::"
  type    = "AAAA"
  proxied = true
  comment = "Cloudflare Workers — webhooks.letbuyy.com (webhook-service)"
}
