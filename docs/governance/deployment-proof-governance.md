# Deployment Proof Governance

Deployment proof requires a traceable sequence from governance gates through rollout, health scoring, rollback readiness, and fresh operations evidence.

## Required Proof

- Governance, dependency, TypeScript, test, migration, Cloudflare, security, observability, provider-failure, and CI gates pass before rollout.
- Worker deployments use explicit Wrangler `--env`; Cloudflare environment bindings are declared per environment because bindings and vars are not inherited.
- Production rollout evidence must include deployment health gates and rollback command readiness.
- Canary and blue/green promotion evidence must include tenant or percentage scope, health score, rollback threshold, and operator approval.
- Deployment reports may not mark success from a planned command; success requires live provider response or operations projection evidence.
