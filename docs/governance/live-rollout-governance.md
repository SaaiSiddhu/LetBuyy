# Live Rollout Governance

Live rollout is owned by `.github/workflows/live-production-certification.yml` and `infrastructure/scripts/operations/phase4-live-certify.mjs`.

Rules:

- Auto mode must detect credentials and tools before mutating providers.
- Plan mode must remain executable without secrets.
- Execute mode must fail closed when any provider credential, operations token, or required tool is missing.
- Worker, queue, app, migration, health-gate, and rollback execution must pass through governed deployment scripts.
- Provider deployment may not be described as completed unless the execute-mode command succeeds.
