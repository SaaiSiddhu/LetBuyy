# Infrastructure Rules

## Deployment Roots

- Web apps deploy through Vercel configuration.
- API and webhook backends deploy through Cloudflare Workers and Wrangler configs.
- DNS lives in `infrastructure/dns.tf`.
- Supabase migrations live under `backend/supabase/migrations`.

## Environment Rules

- Never print or commit secret values.
- Service role keys must only exist in server/worker environments.
- Worker bindings must be reviewed before code relies on KV, R2, queues, or secrets.
- Environment variable names may be documented; values may not.

## DNS And Routing

- Wildcard tenant routing belongs to storefront middleware and Cloudflare DNS, not individual tenant Next routes.
- Custom domains require ownership verification, CNAME/TXT validation, SSL issuance, tenant mapping, and takeover prevention before activation.

## CI/CD Expectations

- CI should run install, typecheck, lint, tests, migration validation, and security checks for affected workspaces.
- Deployments should block on critical typecheck/test failures for affected code.
- Generated build artifacts should not be added to git.

## Operational Readiness

- Add health checks and external monitoring before marking services production-ready.
- Worker cron, queues, and scheduled tasks need documented retry, dead-letter, and observability behavior.
