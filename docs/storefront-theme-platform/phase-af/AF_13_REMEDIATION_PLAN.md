# AF_13 — AF.1 Remediation Plan (PLAN ONLY — DO NOT EXECUTE)

**Phase:** AF.1 (planning) · **Author:** Root integrator, read-only
**Branch / HEAD:** `stepup/main` / `7e1441a6`
**Status:** Written under an `AF_1_STOP` verdict (AF_12). **Nothing in this plan is executed.** Each group runs only after the founder approves the specific §11 blocker it depends on, and only on a clean lane per the repository two-lane rule.

> Governing constraints for all groups: read the law chain first (Constitution → AGENTS_V2 → local AGENTS.md → CLAUDE.md); stay inside the AF.1 allowlist (AF_12 §9); never touch the denylist (AF_12 §10); never weaken/skip/quarantine a test; show the exact file list + diffstat before each commit and rerun the focused gate after; never bundle foreign WIP.

---

## Dependency order (top blocks everything below it)

```
AF.1-BUILD (CRITICAL, gate blocker)  ── founder decision #1
        │
AF.1A  Governance registry closure   ── human decision #4
        │
AF.1B  Migration sequence closure    ── ARB decisions #2, #3, #5
        │
AF.1C  Failing-test closure          ── depends on AF.1-BUILD + AF.1A/B green
        │
AF.1D  Canonical documentation reconciliation (parallel-safe once facts frozen)
        │
AF.1E  Final clean certification (full gate matrix, EXIT 0)
```

---

## AF.1-BUILD — Build-integrity closure (CRITICAL; precedes everything)

**Problem:** committed `packages/theme-engine/src/index.ts:21-23` re-exports `./industry-experience-map`, `./theme-bundle-core`, `./experience-fonts`; all three are untracked (ABSENT at HEAD). Clean clone cannot build `@letbuyy/theme-engine`.
**Founder decision (blocker #1):** these files are intended source **or** the exports are stray.
- **Path A (commit the source):** verify each file is clean, first-party, and passes lint/typecheck; add ONLY these three files (never the surrounding foreign WIP); rerun `pnpm --filter @letbuyy/theme-engine typecheck test`; confirm a **fresh `git clone` + `git checkout 7e1441a6`-equivalent tree builds** (simulate with `git stash`-free method: `git archive HEAD | tar -x` into a temp dir and build — read-only to the working tree).
- **Path B (remove the exports):** if the modules are not intended, remove lines 21-23 from `index.ts` and any dependent re-exports; prove no committed symbol depends on them (`git grep` for the exported identifiers across tracked files only); rerun the theme-engine gate.
**Predicted diff:** Path A = +3 untracked files staged; Path B = −3 export lines in `index.ts`.
**Rollback:** single-file revert of `index.ts` (Path B) or `git rm --cached` the three files (Path A).
**Do NOT:** stage any other working-tree file alongside; both paths touch only theme-engine.

---

## AF.1A — Governance registry closure (RISK-GOV-001)

- **Drift:** `tenant-tables.registry.ts` is stale → `tenant-isolation-validator` (validator 2 of the gate) fails → `validate-governance.mjs` EXIT=1.
- **Command (the generator, NOT hand-editing):** identify the exact generator (`scripts/generators/…tenant…registry…` — enumerate; do not guess the name). Repository law forbids hand-editing generated files.
- **Predicted diff:** regenerated `tenant-tables.registry.ts` reflecting the current tenant-table set.
- **Foreign-row guard:** before trusting the diff, diff the regenerated registry against HEAD and **flag any table row that originates from foreign WIP** (V1/LCIS uncommitted schema). If the generator would pull in foreign-WIP tables (e.g. from untracked 186/187), STOP — the registry must be regenerated only once the migration set is settled (AF.1B first).
- **Surgical review protocol:** human reviews the row delta; only tables that are genuinely canonical are accepted.
- **Rollback:** revert the single generated file.
- **Do NOT:** hand-edit the registry; run the generator while 186/187 are unresolved (order after AF.1B).

---

## AF.1B — Migration sequence closure

- **186/187 (blocker #2):** resolve ownership **without deleting, renumbering, or silently adopting**. Either (a) the owner commits both with paired rollback files, or (b) ARB deletes them with a documented rationale and a replacement at the next free sequence number. Until then the sequential-migration gate stays red.
- **R-23 rollback (blocker #3):** for 180/186-191 either author paired rollback files **or** ARB ratifies "forward-fix-only" and amends R-23 (constitutional act). `rollback-integrity`/`sequential-migration` must reach EXIT 0 under whichever policy is chosen.
- **Historical 100/109/111/142 (blocker #5):** review why already-numbered migrations are edited in-tree; decide revert-to-committed vs a new forward migration. Editing an applied migration is an immutability violation.
- **Apply deferral:** actual staging/production apply stays **deferred to Phase AI**. AF.1 only makes the *repository* migration set consistent and the sequential gate green; it applies nothing.
- **Do NOT:** connect to any DB; apply any migration; renumber; adopt foreign migrations without an ownership decision.

---

## AF.1C — Failing-test closure

- **api-gateway 3 failures (stable names):** `merchant AI route is mounted, mobile allowlisted, and provider-backed`; `executive analytics migration creates rollup tables with service-role and super-admin RLS`; `storefront runtime no longer owns payment route handlers`. For each: establish the current canonical behaviour from the Constitution/AGENTS_V2/CANONICAL_SYSTEMS, then fix **code or the test contract only when the canonical behaviour is proven** — never skip/quarantine/weaken/delete to turn the count green. If a failure encodes real foreign-WIP debt outside AF scope, document it and **leave it red with a named owner** rather than masking it (AF cannot certify EXIT 0 while it is red — that is honest).
- **Ordering:** run after AF.1-BUILD (so the tree builds) and AF.1A/B (so the gates are otherwise green), to avoid chasing failures caused by the build/registry/migration state.
- **Do NOT:** touch money/auth/RLS to make a test pass; import unrelated AG–AK feature work.

---

## AF.1D — Canonical documentation reconciliation (superseding corrections)

Prepare bounded, additive corrections (historical phase reports stay immutable evidence — add superseding notes, do not rewrite snapshots, unless governance law requires in-place fixes):
- **CLAUDE.md:** "107-validator gate" → **109**; resolve the +39 LCIS-V2/V3 working-tree drift (commit/revert/scope-out per blocker #6).
- **AGENTS.md:** migration max "161"→191, "91 files"→120, "next is 162" instruction → correct next number.
- **PROGRAM_STATE.md / RISK_REGISTER.md:** move RISK-SEC-001 out of the "active" header (FIXED in AE); storefront count 915→930.
- **SHOPIFY_PARITY_MATRIX.md → supersede** with the AF_08 post-AE capability matrix (preserve row identities).
- **NOT-CONNECTED register:** refresh from AF_07 (7 genuinely-open seams; marketplace gate STRUCTURAL_ONLY; custom-CSS `rawCustomCss` not passed).
- **Program/archive chronology:** note B→AE = 30 phases; Phase V = 3 commits.
- **Do NOT:** rewrite immutable historical phase reports; edit any denylisted doc's rules.

---

## AF.1E — Final clean certification

Plan a full rerun (only after A–D land, each on its own lane):
- All package typechecks + tests (theme-engine / storefront-runtime / merchant-control-plane / api-gateway) → **EXIT 0**.
- Real app builds where repository law requires (`pnpm --filter <app> build`).
- Full `node scripts/validate-governance.mjs` → **EXIT 0** (after tenant-registry + 186/187 resolved).
- Sequential-migration validator → **EXIT 0**.
- Security/tenancy validators (`no-public-using-true`, `no-blanket-service-role`, `rls-force-coverage`, `tenant-isolation`) → PASS.
- Theme-specific validators (`theme-governance`, `no-new-react-sections`) → PASS; Liquid flag still `false`.
- Clean-clone build proof (AF.1-BUILD): `git archive HEAD | tar` into temp → build succeeds.
- `git diff`/ownership verification: only allowlist files changed; zero foreign-WIP bundled.

**AF completion artifact set (to author at AF close):**
`AF_REPORT.md` · `AF_TEST_REPORT.md` · `AF_SECURITY_REVIEW.md` · `AF_GOVERNANCE_CERTIFICATION.md` · updated `PROGRAM_STATE.md` + a `RESUME.md`/programme-state refresh.

---

## Git & commit rules (AF.1, only after approval)

Two-lane rule; one integration owner; one lane merges at a time; no cross-lane ownership overlap; narrow conventional commits per remediation group (AF.1-BUILD / AF.1A / AF.1B / AF.1C / AF.1D); never bundle foreign WIP; show exact file list + diffstat before every commit; rerun the focused gate after each; rerun the full gate matrix before AF close. **AF.0 itself commits nothing** — the `phase-af/` docs stay uncommitted until the founder reviews this package (unless the founder directs a docs checkpoint).

---

## Future-phase boundary (do not cross under this program)

AG Security & Tenancy Hardening · AH Missing Runtime Connections · AI DB Staging & Migration Certification · AJ Live Quality Certification · AK Internal INR-only Canary + ARB. **None** starts here. Liquid stays OFF through AF→AJ. AK may use per-store release-manifest opt-in for ≤5 named internal INR-only stores **only** after AF–AJ are independently certified and ARB approves.
