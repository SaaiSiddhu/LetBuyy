# packages / lcis-decision AGENTS.md

Purpose: LDSS (Decision Support System) — composes every prior LCIS system into structured, scored recommendations (deploy/migration/rollback/scaling/business/architecture decisions). Part of the LetBuyy Central Intelligence System (LCIS) — developer/CI intelligence tooling, NOT part of the canonical 8-runtime production topology (root `AGENTS.md` ARCH-R1). Must not be deployed as one of those 8 runtimes.

## Ownership Rules

- Follow the root `AGENTS.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, and `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` before making architecture, money, identity, tenancy, or governance changes.
- Keep this package inside its declared source boundary: `packages/lcis-decision`.
- This package reads all prior LCIS systems (lcis-core, lcis-live, lcis-execution, lcis-governance, lcis-operations, lcis-twin, and siblings) to score alternatives on risk/cost/readiness/blast-radius.
- It never executes, deploys, or acts on its own recommendation — it only recommends, with evidence, confidence, alternatives, and tradeoffs stated.
- Its output is generated intelligence and is EVIDENCE, NEVER AUTHORITY (root `AGENTS.md` DOC-R2). It must never be cited as the source of architectural truth or used as ownership evidence, and it must not become a second authority for commerce, money, inventory, orders, tenant state, or identity — those stay governed exclusively by the canonical ledger, `identity-platform`, the RLS+GUC tenancy boundary, and the 108-validator governance gate.

## Forbidden Imports

- No imports from `apps/*`, `legacy/*`, repository-level `infrastructure/*`, generated output, or runtime-local build artifacts.
- No import of a canonical commerce domain package (`packages/payments`, `packages/checkout-core`, `packages/tenant-core`, etc.) for write access — this boundary is observation-only and must never mutate commerce, money, identity, or tenant state.

## Runtime Authority

- This boundary does not override root topology, runtime, package, migration, security, or deletion law.
- This is LCIS developer/CI intelligence tooling. It MUST NOT be deployed as one of the canonical 8 runtimes (ARCH-R1) and MUST NOT appear in any deploy matrix, runtime manifest, or production topology file.
- Provider secrets, service-role credentials, and generated artifacts are never source authority.

## Migration Notes

- This package was added to the repository without an ownership file; this AGENTS.md closes that gap (LetBuyy Phase G1, W1). No source was moved, renamed, or removed to create it.
- If local rules need to change, edit this file by hand and keep it consistent with root governance.
