# Phase 4 Live Execution Evidence

This file records the repository-side certification state. It is not a substitute for operations control-plane evidence.

## Current State

- Certification mode: `credential-gated-plan-ready`
- Local credential detection: no Cloudflare, Supabase, observability, Vercel, operations API, or secret-rotation credentials were exported in this checkout.
- Live provider deployment: not executed from this checkout.
- Live Supabase verification: not executed from this checkout.
- Live observability endpoint verification: not executed from this checkout.
- Live secret rotation: not executed from this checkout.
- Central certification report: available in plan mode through `infrastructure/scripts/operations/generate-certification-report.mjs`; live report recording requires execute mode and `LETBUYY_OPERATIONS_TOKEN`.

## Executable Evidence Contract

Run:

```bash
node infrastructure/scripts/operations/phase4-live-certify.mjs --environment=production --mode=auto
```

When all required credentials and tools are present, auto mode becomes execute mode and records live evidence through `/v1/operations/runtime`.

Generate a local plan-mode certification report without claiming live execution:

```bash
node infrastructure/scripts/operations/generate-certification-report.mjs --environment=production --mode=plan
```

## Required Live Evidence Categories

- deployment
- Cloudflare
- Supabase
- observability
- incident response
- failover
- chaos
- load
- security
- dashboards
- control-plane
- SRE
- event-store
- multi-region
- central operational certification
