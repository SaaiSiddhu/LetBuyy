# FINAL DUPLICATE ELIMINATION IMPLEMENTATION PLAN

**Program:** LetBuyy Final Convergence · **Document 4 of 5** · **Status:** PLAN ONLY — no code changes authorized by this document
**Goal:** One Authority · One Reality · One Implementation — eliminate every remaining duplicate ownership, authority, implementation, and config the truth audit surfaced.
**Authority:** subordinate to the Constitution → AGENTS.md. Disposition rule: every loser is **kept, archived, or deleted — with proof**. Never delete without a passing replacement and a paired rollback.
**Evidence base:** FINAL_TRUTH_AUDIT_2026_06_11 (Architecture 8/10, Governance 7/10, Docs 7.5/10, Dead-runtime audits).

---

## 0. WHY THIS IS PRIORITY 4

The repository is *substantially* converged — this plan cleans the residue, not a second architecture. None of these items is an S0; they are trust-and-clarity debt: stale law articles, a diverged law copy, frozen apps that can still deploy, ghost config, dead flags, a re-runnable executed prompt. Doing this last is correct: it should run **after** Money and Liquid have changed the files it would otherwise re-audit, so it certifies the final state rather than a moving one.

**Constraint:** this plan only *removes duplication* — it never introduces a new service, microservice, CQRS, event sourcing, extension runtime, or marketplace architecture. Every disposition collapses toward an existing ratified winner.

---

## PHASE 0 — OWNERSHIP INVENTORY

**Goal:** the complete duplicate register with winner/loser and disposition. Read-only.

### 0.1 Duplicate register (evidence-anchored)

| ID | Duplicate | Winner | Loser(s) | Disposition | Proof gate |
|---|---|---|---|---|---|
| D-DOC1 | Two copies of DOC 02 | root `AGENTS.md` (newer, 4 hunks ahead) | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_AGENTS_V2.md` (stale; Constitution points at it) | **Collapse to one** (delete copy → pointer stub, or add full-diff sync validator) | both identical or one is a stub |
| D-DOC2 | Constitution self-description stale | executed reality | ART-21 "AGENTS.md is a map, not law"; ART-24 ops survivor "tentative/UNVERIFIED"; §14.2.3 | **Amend Constitution** to executed state | text matches reality; phase-c validator extended to DOC 01 |
| D-DOC3 | `CLAUDE.md` precedence inverted | Constitution-first (both law docs say so) | CLAUDE.md "AGENTS.md first" | **Fix order** | CLAUDE.md matches AUTH-CHAIN |
| D-DOC4 | Second live "Constitution" | product Constitution | `CONVERGENCE_CLEANUP_2026_06_10/GOVERNANCE_CONSTITUTION.md` (L1–L8, run over) | **Stamp historical** | header marks it spent/subordinate |
| D-DOC5 | Rival execution authority | the four plans + Master Program | `docs/auth/2026-06-08-.../IDENTITY_IMPLEMENTATION_MASTER_PLAN.md` ("single execution source of truth"), SSO/MIGRATION docs treating frozen marketplaces as live | **Archive or demote**; fix root registry citations | no root ledger cites it as live law |
| D-DOC6 | Executed prompt registered live | history | `CONVERGENCE_CLEANUP_2026_06_10/CODEX_FOUNDATION_STEPUP_MASTER_EXECUTION_PROMPT.md` (no EXECUTED stamp; trailer says "executed nothing") | **Stamp EXECUTED / DO-NOT-RE-RUN** | PROMPTS.md row + file header mark spent |
| D-DOC7 | 6 reserved-service `AGENTS.md` "Incubating" | reserved-template (manifest-only) | the 6 stubs (event-bus, search, media, notification, analytics-pipeline, checkout-runtime) | **Rewrite to reserved template** | text says manifest-only; a validator checks it |
| D-DOC8 | 4 root business binaries | archived (Batch 4 ordered) | `*.pptx`×2, `*.xlsx`×2 at root | **Archive** to `docs/archive/root-governance-2026-06-10/` | root has only the 9 md + no stray binaries |
| D-DOC9 | Frozen-marketplace runbooks unbannered | frozen status | `docs/runbooks/app-marketplace-*.md` (4) | **Add frozen banner or archive** | each carries frozen disclaimer |
| D-ARCH1 | Frozen apps still deployable | platform-console (ops survivor) + 5 active apps | `app-marketplace`, `theme-marketplace`, `developer-portal`, `platform-operations-portal` retain functional `vercel.json` + manifests claiming Vercel authority | **Neutralize deploy shape** (remove vercel.json / set manifest non-deployable) + delete Vercel projects (human seam) | no frozen app can auto-deploy on push |
| D-ARCH2 | Identity shadow stack | identity-platform issuer | 18 files `api-gateway/src/identity-foundation/` + 13 never-read flags + legacy AUTH_SECRET mint fallback | **Drain then delete** (SKIP-IDN-R2) | zero-use telemetry proven, then archive |
| D-ARCH3 | Twin queue-projection planners | one shared module | `api-gateway/.../queue-projection-plans.ts` ≈ `queue-workers/.../queue-projection-plans.ts` (formatting-only diff) | **Dedupe to a shared package** | one source, both import it |
| D-CFG1 | Ghost workspace ref | — | `tsconfig.workspace.json:68 → packages/typescript/utils` (absent) | **Delete reference** | `tsc --build` resolves |
| D-CFG2 | Stale `develop` registry entries | retired develop | `config/vercel/projects.json` staging `"branch":"develop"` | **Retarget/remove** | no staging deploy targets develop |
| D-CFG3 | Colliding DNS Terraform | one zone def | `dns.tf` + `letbuyy_com.tf` overlapping records, two zone-id vars | **Reconcile to one zone** | terraform plan has no duplicate records |
| D-CFG4 | 17 dead feature flags | — | 15 identity flags never set (13 never read), `FEATURE_LIQUID` set-but-unread, `STOREFRONT_POOLED_SQL` | **Delete or wire** | each flag read or removed |
| D-CFG5 | ~36 used-but-undeclared env keys | — | `EMAIL_QUEUE` binding (silently dark), KYC/logistics/KMS/push families | **Declare in templates** | env-validator: no used-but-undeclared |
| D-CFG6 | Live-labeled placeholder vars | sandbox reality | `[env.production.vars] …_MODE="live"` + `SKIP_NEEDS_HUMAN_` | **Relabel sandbox** until provisioned | no `"live"` next to a placeholder |
| D-RUN1 | Admin-client monoculture | tenant-scoped path | 906 `getSupabaseAdmin`/99 files vs `withTenantTx` 0% adoption | **Adopt withTenantTx** (CAP-C11) | red-team parity proven, adoption rising |
| D-RUN2 | Firebase media residue | Cloudflare/R2 storage | 2 next.config image-host allowlists + `'firebase-storage'` adapter variant | **Migrate media then remove** | assets re-hosted, allowlist dropped |
| D-RUN3 | Dead code residue | — | `auth-core/src/legacy.ts` (0 importers), 5 orphan validators, `.claude/` untracked | **Delete / gitignore** | no zero-importer shims; `.claude/` ignored |
| D-VAL1 | Narrow/exempted hard-walls | — | `canonical-ledger-only` (substring + 9-file exempt + no migration scan), `commission-bps-zero` (literal-300) | **Harden** (Money plan owns the money ones) | mutation tests fail on `500`/comment-only |
| D-VAL2 | Validators not wired into deploy | gate | `production-deploy.yml`/`production-rollout.yml` lack gate; untracked-migration blindness | **Wire gate + reject untracked migrations** (Reality plan owns) | failing validator blocks deploy dry-run |
| D-VAL3 | Confusing repeal bookkeeping | repeal real | gate validator requires ledger attest `D12-D13-GATE-RESTORE` while repeal SKIP coexists | **Reconcile** ledger row + validator | reviewer reads one consistent story |

**Exit gate FG0:** register ratified; every loser has keep/archive/delete + a proof gate; Money-owned (D-VAL1 money rows) and Reality-owned (D-VAL2) items are cross-referenced, not duplicated here.

---

## PHASE 1 — DOCUMENTATION CONVERGENCE

**Goal:** one law chain, no stale articles, no rival authority.

Actions (D-DOC1..9): collapse the dual DOC 02 (delete the stale `LETBUYY_AGENTS_V2.md` to a pointer stub, or add a full-text sync validator so they cannot diverge again); amend Constitution ART-21/ART-24/§14.2.3 to the executed state and extend `phase-c-forced-decisions-validator` to include DOC 01 (so the survivor contradiction can trip the gate); fix `CLAUDE.md` precedence; stamp the cleanup `GOVERNANCE_CONSTITUTION.md` historical; archive/demote the `docs/auth/` rival master plan and fix root-registry citations; rewrite the 6 "Incubating" reserved stubs to the reserved template and add a validator that bans forward-activation language; archive the 4 root binaries; banner/archive the frozen-marketplace runbooks.

**Proof gate FG1:** `whole-repo-end-state-validator` green (9 root md, no stray binaries); a new sync/precedence/reserved-stub validator passes; grep shows no doc outside GOVERNANCE_REWRITE+AGENTS.md claiming operative law.

**Rollback:** doc commits revert cleanly; no runtime impact.

---

## PHASE 2 — PROMPT CONVERGENCE

**Goal:** no re-runnable executed prompt; one live registry.

Actions (D-DOC6): stamp the executed Codex master prompt EXECUTED/DO-NOT-RE-RUN in both `PROMPTS.md` and the file header; ensure `LETBUYY_CONVERGENCE_EXECUTION_MASTERPLAN.md` / `SAFE_DELETION_PLAN.md` (which escape the perimeter validator's basename regex) are closed or archived; extend `prompt-perimeter-validator` basename coverage so MASTERPLAN/DELETION-class instruction docs are policed; dedupe the `SKIP-RAZORPAYX-ENUM-PURGE` ID (live evidence of the double-append failure mode a re-run would cause).

**Proof gate FG2:** `prompt-perimeter-validator` green with widened coverage; PROMPTS.md has zero live CANONICAL-EXECUTION rows pointing at spent runs; no duplicate SKIP IDs.

---

## PHASE 3 — VALIDATOR CONVERGENCE

**Goal:** validators are total, fallible, and wired where they matter; no theater, no orphans.

Actions: harden the money hard-walls (D-VAL1 — **owned by Money plan Phase 1/5**, referenced here for completeness: migration-aware, call-adjacent evidence, full table list, sunset exemptions); wire the gate into both deploy lanes and add untracked-migration rejection (D-VAL2 — **owned by Reality plan Phase 3**); reconcile the `D12-D13-GATE-RESTORE` bookkeeping (D-VAL3); retire the 5 truly-orphaned validators or wire them; keep the GATE-1 inversion and meta-no-theater as-is (they work).

**Proof gate FG3:** every gate validator proven fallible by a reverted mutation probe; 0 orphaned validators in the gate lane; deploy dry-run blocked by a failing validator and by an untracked migration.

**Cross-reference note:** this phase *coordinates* the validator changes that Money and Reality plans *own*, to avoid two plans editing the same validator. Sequencing is in the Master Program.

---

## PHASE 4 — RUNTIME CONVERGENCE

**Goal:** one implementation per domain in code, frozen/dead mass neutralized.

Actions: neutralize frozen-app deploy shape + delete Vercel projects (D-ARCH1, human seam for the server side); drain-then-delete the identity shadow stack once zero-use telemetry proven (D-ARCH2, SKIP-IDN-R2); dedupe the twin queue-projection planners into a shared module (D-ARCH3); drive `withTenantTx` adoption up and admin-client usage down with red-team parity proof (D-RUN1/CAP-C11); migrate Firebase media then remove the allowlists/adapter variant (D-RUN2); delete the `auth-core/legacy.ts` shim and zero-importer residue (D-RUN3); exclude frozen apps from CI typecheck/build (turbo/CI filter) so "frozen" is enforced by the toolchain, not just docs.

**Proof gate FG4:** `one-system-per-domain` + `no-rejected-package-imports` + `no-reserved-service-activation` green; no frozen app deployable or CI-built; shadow stack archived with zero-use evidence; one queue-planner source; Liquid Phase-7 React removal (if reached) reflected here.

**Rollback:** each removal is an independent reviewed commit with archive + paired reverse; never batch.

---

## PHASE 5 — CONFIGURATION CONVERGENCE

**Goal:** config tells one truth; no ghost refs, dead flags, undeclared env, or false-live labels.

Actions (D-CFG1..6): delete the `packages/typescript/utils` tsconfig reference; retarget/remove `develop` registry entries; reconcile the colliding DNS Terraform to one zone definition (prerequisite for the checkout.letbuyy.com cutover in Reality Phase 4); delete-or-wire the 17 dead flags (notably wire `EMAIL_QUEUE` or remove it — order-confirmation emails are silently dark; resolve `FEATURE_LIQUID` per Liquid plan); declare the ~36 used-but-undeclared env keys in templates; relabel `…_MODE="live"` placeholder vars to sandbox until real provisioning.

**Proof gate FG5:** `tsc --build` resolves; `environment-validator` reports no used-but-undeclared and no declared-but-dead; `terraform plan` has no duplicate records; no `"live"` mode beside a `SKIP_NEEDS_HUMAN_` placeholder.

---

## PHASE 6 — FINAL REPOSITORY CERTIFICATION

**Goal:** prove One Authority / One Reality / One Implementation — and that it stays that way.

Actions:
1. Re-run the full 10-agent forensic harness against the final tree; assert every duplication score is at target (Architecture 10, Governance 9–10, Docs 9–10, Validators 9–10).
2. Confirm the duplicate register is fully dispositioned (every row keep/archive/delete with proof attached).
3. Add **standing anti-recurrence validators**: dual-DOC-02 sync, reserved-stub language, frozen-app non-deployability, prompt-perimeter widened coverage, branch-lag monitor (shared with Reality Phase 5).
4. Obtain ARB certification that the repository is single-reality.

**Proof gate FG6:** forensic harness returns single-reality findings; anti-recurrence validators in the gate; ARB sign-off recorded in `EXECUTION_LEDGER.md`.

---

## SAFETY RULES (duplicate-elimination-specific)

- Proof before delete — every removal has a passing replacement/justification and a paired rollback; honor the cleanup constitution's Rule #0 (never discard the working tree) and L2 (archive, don't vaporize).
- Archive (not delete) anything with historical value (`docs/archive/`); delete only zero-value residue (shims, ghost refs, dead flags).
- Never collapse a duplicate *toward* a rejected architecture — always toward the ratified winner.
- Coordinate shared-file edits (validators, DNS, env) with Money and Reality plans via the Master Program to avoid two plans touching one file.

## DEPENDENCIES

- **In:** runs **after** Money and Liquid have settled their files (so it certifies the final state). Validator/CI items (D-VAL2) overlap Reality Phase 3 — Reality owns them, this plan references them. Frozen-app Vercel deletion + DNS reconciliation overlap Reality Phase 4.
- **Out:** Phase 6 certification is the entry condition for the Master Program's Foundation Certification (Phase E).

## TARGET

Architecture Duplication 8→10, Governance Duplication 7→9–10, Documentation Convergence 7.5→9–10, Validator Integrity 7.5→9–10 — certified single-reality, with anti-recurrence validators preventing regression.
