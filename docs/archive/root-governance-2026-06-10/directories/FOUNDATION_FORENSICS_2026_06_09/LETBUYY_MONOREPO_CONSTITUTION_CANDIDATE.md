# LETBUYY MONOREPO CONSTITUTION — CANDIDATE

**Status:** CANDIDATE · **Date:** 2026-06-09 · **Scope:** package graph, dependency discipline, build closure, validator governance. Subordinate to the Master Constitution.

Grounded in `LETBUYY_MONOREPO_FORENSICS.md`. Verified strengths to protect: a genuinely **acyclic** dependency graph (52 governed roots, 162 internal edges; `circular-import-validator` + `dependency-graph-validator` pass), **zero** app↔app imports, **zero** package→app imports, and no `createClient` leaking into app `src/`. The weakness: a 177-script validator suite that is largely decorative, and ~10K LOC of dead packages kept in the build closure.

---

## Article I — Boundaries (FROZEN — these are real and excellent)

1. **No app imports another app.** Currently zero violations — FROZEN at zero.
2. **No package imports an app.** Currently zero — FROZEN at zero.
3. **The dependency graph stays acyclic.** Enforced by the *real* `circular-import-validator`. A new cycle fails CI.
4. **Apps do not construct datastore clients.** Persistence access lives in `services/api-gateway` and `packages/infrastructure`; an app `src/` containing `createClient(` is prohibited.

## Article II — No dead packages in the build

1. **Every package has a runtime consumer.** A package imported only by its own siblings, tests, or validators is **dead** and MUST be removed from `tsconfig.workspace.json` and the gateway build, or wired to a real consumer within one quarter. Current offenders: `distributed-runtime`, `projection-runtime`, and the five identity-contract packages (`token-core`, `session-core`, `permission-core`, `organization-core`, `audit-core`) consumed only by the dead `identity-foundation` island.
2. **Contract-only packages are allowed but labeled.** The `-core` packages that are pure Zod/TS contracts (e.g. `commerce-core`, `cms-core`, `tenant-core`) are legitimate *if* a runtime path consumes the contract. A contract no runtime imports is dead by Art. II.1.
3. **The build closure may not exceed the runtime closure by more than a declared budget.** Dead TypeScript that compiles every CI run is prohibited from accumulating silently.

## Article III — Validators must be honest

1. **A validator gates a release only if it tests behavior.** Validators that assert a capability by grepping for a function-*name* string (≈46% of the 177 today, e.g. `split-brain-validator.mjs:31-39`) are reclassified as **decorative** and removed from release gates.
2. **A validator may not assert against a manifest that declares itself non-evidence.** 57 validators check `config/runtime/*.json` files whose own fields say `"governance-contract-not-live-evidence"` — these prove nothing and MUST NOT gate.
3. **Validators do not mutate the workspace.** `validate-governance.mjs` deletes `.next` build artifacts as a side effect of its walk (it crashed on this in audit). Validators are read-only.
4. **Coverage is declared.** "52 governed roots" out of the full package set MUST be reconciled — every workspace package is either governed or explicitly exempted in writing. Silent ungoverned packages are prohibited.

## Article IV — Workspace hygiene

1. **`pnpm-workspace.yaml` is the topology truth.** Reserved/placeholder packages and services are marked as such and excluded from `build`/`deploy` filters.
2. **One lockfile, one package manager.** pnpm + turbo are FROZEN as the toolchain; no parallel npm/yarn lockfiles.
3. **No deprecated app aliases re-enter the graph** (see Master Constitution Art. IV.2).

## Article V — Amendment & enforcement

1. The real validators (`circular-import`, `dependency-graph`, `undeclared-import`, `package-export`) are FROZEN as release gates.
2. Decorative validators are demoted to an opt-in `report` lane, never a `gate` lane, until rewritten to test behavior.
3. Changes to topology/boundaries require the architecture-governance gate plus a human decision in `docs/governance/`.

---

## FROZEN (protect)
Acyclic graph; zero app↔app and package→app imports; no datastore clients in apps; pnpm+turbo toolchain; the four behavior-testing dependency validators.

## CONDEMNED (fix)
Dead packages in the build closure (`distributed-runtime`, `projection-runtime`, 5 identity-contract packages); name-grep "proof" validators gating releases; validators asserting against self-declared-non-evidence manifests; a workspace-mutating "governance" validator; undeclared validator coverage.

## Score
**Monorepo Governance 48/100.** Textbook boundary hygiene (genuinely top-decile) wrapped in a validator suite that is ~95% ceremony — the discipline is real, the *measurement* of that discipline is theater. Keep the discipline; delete the ceremony.
