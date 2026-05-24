# DNS Infrastructure Governance

Purpose: Terraform DNS records, domain validation, wildcard storefront routing, service subdomains, and takeover-prevention controls.

Boundary: `infrastructure/dns`.

Rules:

- Custom domains require ownership verification before activation.
- Wildcard tenant routing belongs in DNS and storefront middleware, not per-tenant routes.
- DNS changes must be reviewed against Cloudflare and Vercel runtime ownership.
