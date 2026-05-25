# Deployment Execution Governance

Production deployment execution is owned by `infrastructure/scripts/deploy/production-deploy.mjs`.

Rules:

- Normal deployment runs must execute governance and Phase 4 validation before provider mutation.
- Certification orchestrators may use `--skip-validation` only after running the same validation explicitly in the same process.
- Cloudflare rollout requires Terraform variables and Wrangler credentials.
- Worker dry-run deployment is acceptable in plan mode; it is not live deployment evidence.
- Rollback and health-gate commands must remain executable before production promotion.
