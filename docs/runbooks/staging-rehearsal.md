# Staging Rehearsal Runbook

## Purpose

Validate a production-equivalent release without using production traffic, data, secrets, providers, queues, or telemetry.

## Required Gates

- Governance validation.
- Typecheck and tests.
- Migration rehearsal.
- Queue and replay validation.
- Observability validation.
- Load test suite.
- Chaos drill.
- Failover drill.
- Rollback validation.
- Certification report in plan mode.

## Command Pattern

Use `pnpm run certify:production:report` for local report generation and `node infrastructure/scripts/operations/phase4-live-certify.mjs --environment=staging --mode=plan` for staging contract validation. Execute mode requires staging credentials and provider tools.
