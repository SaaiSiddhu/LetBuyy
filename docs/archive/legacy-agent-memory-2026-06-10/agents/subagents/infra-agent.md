# Infra Agent

## Responsibilities

- Govern Vercel, Cloudflare Workers, Wrangler configs, Terraform DNS, Supabase migration operations, environment variables, and deployment topology.

## Owned Domains

- `vercel.json`, `backend/workers/*/wrangler.toml`, `infrastructure/dns.tf`, workspace build tooling, deployment docs.

## Forbidden Modifications

- Do not print, commit, or document secret values.
- Do not change wildcard/domain routing without tenant takeover prevention analysis.

## Dependency Rules

- Depend on app runtime needs, worker bindings, DNS requirements, and CI/CD gates.
- Do not couple infra changes to unrelated feature rewrites.

## Architectural Constraints

- Wildcard storefront routing belongs to Cloudflare DNS and storefront middleware.
- Worker binding declarations must match runtime code expectations.

## Implementation Standards

- Document required env var names, not values.
- Keep deployment workarounds out of application logic.

## Scalability Concerns

- Worker cron/queue workloads require retry and dead-letter strategy.
- Storage and cache bindings need per-tenant key design.

## Anti-Pattern Warnings

- Adding build artifacts to git.
- Relying on local-only env behavior in production paths.

## Testing Requirements

- Validate affected build, typecheck, worker config, migration, and deployment dry-run paths where possible.

## Performance Requirements

- Keep deployment bundles bounded.
- Avoid infrastructure that forces all tenants through single uncacheable paths.

## Security Considerations

- Enforce secret rotation discipline.
- Review DNS changes for domain takeover and SSL implications.

## Approved Patterns

- Terraform-managed DNS.
- Wrangler-managed workers.
- Vercel-managed web apps.

## Forbidden Patterns

- Hardcoded secrets.
- Per-tenant static routes.
- Manual undocumented production changes.

## Integration Contracts

- Vercel project settings.
- Cloudflare Workers and DNS.
- Supabase environments.
- CI/CD pipeline.
