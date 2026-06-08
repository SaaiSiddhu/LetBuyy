# Apps Marketplace Foundation V2 Governance Reconciliation

Date: 2026-06-07.

## Source Authority

- Marketplace UI authority: `apps/app-marketplace`.
- Gateway writer authority: `services/api-gateway/src/routes/app-store.ts` plus its app-store route modules.
- App token API authority: `services/api-gateway/src/routes/app-api.ts`.
- Queue side effects: `services/queue-workers` and gateway queue execution adapter.
- Shared contracts: `packages/shared-types`, `packages/typescript/api-client`, `packages/app-engine`, and `packages/billing-core`.
- Schema authority: forward migrations `092` through `106`.

## Current Implementation Boundary

Waves 0 through 10 are implemented in code. Wave 11 docs/runbooks are the current reconciliation layer. The mission ledger and status files remain the operational evidence source for issue-by-issue completion state.

## Known External Blockers

- Local Supabase migration history has remote-style entries `000001` through `000083` that do not exist in the local migration directory.
- Full governance and full gateway contracts are blocked by unrelated theme-marketplace environment-domain residue.
- Live payout credentials, media bucket/CDN provisioning, paid security scan vendor, KYC policy, final legal policy text, translations, and production migration apply require human approval.

## Validator Expectation

Marketplace-relevant typecheck, build, lint, test, route split, and single-source formatter checks must stay green before marking additional issue rows done. `node scripts/validate-governance.mjs` must be rerun after route, schema, docs authority, or topology changes.
