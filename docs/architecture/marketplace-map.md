# Marketplace Map (frozen)

`apps/frozen/app-store` and `apps/frozen/theme-store` are **frozen / pending consolidation** — NOT production deploy targets (`CLAUDE.md`, `deploy-matrix-topology-validator`).

## Status
- Excluded from the production deploy matrix and the root `build`/`typecheck` filters.
- `apps/frozen/app-store/src/proxy.ts` is **live Next 16 middleware** (host/auth routing) — not dead code; do not delete.
- `marketplace-display.ts` and similar have real inbound imports — treat "dead file" audit claims as unverified until proven.

## Guardrails
- **No reserved-service activation** (`no-reserved-service-activation-validator`).
- **Partner payouts ring-fenced** — `partner_payout_ledger_entries` writes are restricted to the explicit B3 boundary (`SKIP-B3-PARTNER-PAYOUT-LEDGER-BOUNDARY`); marketplace code must not write it elsewhere (`canonical-ledger-only-validator`).
- **Meta no-theater** — marketplace frozen-seam fragments must stay intact (`meta-no-theater-validator`).

## To activate (requires ARB)
Adding real source/tests/deploy config to make a frozen app a production surface is a human-approved scope change — not a routine edit.
