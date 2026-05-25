# Live Rollout Governance

Live rollout is owned by `.github/workflows/live-production-certification.yml` and `infrastructure/scripts/operations/phase4-live-certify.mjs`.

Rules:

- Auto mode must detect credentials and tools before mutating providers.
- Plan mode must remain executable without secrets.
- Execute mode must fail closed when any provider credential, operations token, or required tool is missing.
- Worker, queue, app, migration, health-gate, and rollback execution must pass through governed deployment scripts.
- Provider deployment may not be described as completed unless the execute-mode command succeeds.
- `config/runtime/rollout-lifecycle.json` owns canary, blue/green, shadow traffic, sandbox provider, and deployment-gate contracts.
- `scripts/validators/operational-lifecycle-validator.mjs` must hard-fail missing rollout contracts before live certification can run.
- Development certification uses the same tooling with `--environment=dev`, but it is non-production evidence only. It validates isolated dev Worker routes, queues, KV, R2, telemetry labels, secret scope, and rollback before staging promotion.
