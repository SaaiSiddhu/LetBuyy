# Deployment Pipeline Governance

LetBuyy production rollout is owned by `.github/workflows/production-rollout.yml`, `infrastructure/deployment/release-promotion.yaml`, and the executable scripts under `infrastructure/scripts/deploy`.

## Rules

- Production deploys require governance validation, typecheck, security gates, SBOM generation, and explicit GitHub environment approval.
- Push-triggered and manually executed production deploys must share the `production-release-production` concurrency group; `.github/workflows/deploy-production.yml` is retired and must not be recreated.
- Production app deployment must not start before the production migration job succeeds, and the migration diff gate must run before staging smoke.
- Cloudflare primitive rollout runs through Terraform before Workers are deployed.
- Queue workers deploy before API gateway and webhook workers so async consumers exist before producers shift traffic.
- Worker rollback uses `wrangler rollback`; database rollback is forward-fix unless a reversible migration has explicit SRE and principal engineer approval.
- Deployment health gates must be recorded through `/v1/operations/runtime/deployment-health-gates`.
