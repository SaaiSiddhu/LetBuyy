# AF_01 — Governance & Topology Truth

**Workstream:** AF-A (Governance & topology truth)
**Phase:** AF.0 read-only discovery · **Author:** Root integrator (Claude Code, Opus 4.8), read-only
**Branch / HEAD:** `stepup/main` / `80d0b1af`
**Evidence timestamp:** 2026-07-17/18 IST
**Status:** VERIFIED_CURRENT (topology + validator inventory + law chain) · governance gate BROKEN (EXIT=1, two explained causes)
**Working-tree delta from this workstream:** only this file is written; no build/validator with a mutating side-effect was run by AF-A (see §5).

> This artifact was authored by the root integrator directly (the AF-A subagent did not land its file before the discovery process exited). Every claim is verified against current on-disk evidence with the exact command shown.

---

## 1. Law-chain precedence (VERIFIED_CURRENT) — the chain that actually exists

| # | Document | Path | Present | Precedence role |
|---|----------|------|:-------:|-----------------|
| 1 | LetBuyy Constitution | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (471 lines) | ✅ | **Supreme.** Nothing overrides it. Read in full by the integrator. |
| 2 | Root operating rulebook | `AGENTS.md` (405 lines, `LETBUYY_AGENTS_V2`, hand-authored) | ✅ | Operative manual; must conform to DOC 01. |
| 3 | Local `AGENTS.md` | ~75 files (see §2.4) | ✅ | Nearest wins for the inspected path. |
| 4 | Root `CLAUDE.md` | `CLAUDE.md` (264 lines) | ✅ (**Modified** in working tree — §6) | AI operating context; subordinate to 1–3. |
| — | `PROJECT-INSTRUCTIONS.md` | — | ❌ NOT_FOUND | Optional per the AF prompt. |
| — | Numbered "context brain" `01…11` | — | ❌ NOT_PRESENT | Prompt-assumed artifact; does not exist (see AF_09). HISTORICAL_ONLY. |

**Precedence conflict analysis.** The `AUTH-CHAIN` in `AGENTS.md §0.1` and the Constitution's `P.3` agree exactly: **Constitution → AGENTS_V2 → CANONICAL_SYSTEMS → legacy-elimination/roadmap → UI-UX governance → evidence base.** No contradiction between the two live authorities. The only precedence anomaly is that `CLAUDE.md` (rank 4) is **uncommitted-Modified**, i.e. the operative on-disk context differs from the committed context (§6) — a governance-hygiene drift, not a rule conflict. **Which rule wins:** the Constitution, on every axis; nothing in the current tree contradicts it.

**Constitutional invariants that bound Phase AF (verified elsewhere in this pack):** ART-17 Liquid canary OFF (AF_07 SEAM-1: `theme-governance.ts:14` = `false`); ART-08/09 + R-1/R-2/R-3 fail-closed tenancy (AF_05); ART-10 canonical ledger (AF_05 money section — untouched since Phase M); ART-05 sole issuer / HS256≠ES256 (AF_05); ART-22 frozen marketplace (AF_08); R-23 migration↔rollback pairing (AF_07 — **materially violated**, see AF_07/AF_04).

---

## 2. Canonical topology vs current tree (VERIFIED_CURRENT)

### 2.1 Active runtimes (all present on disk)

`apps/storefront-runtime`, `apps/merchant-control-plane`, `apps/identity-platform`, `apps/marketing-site`, `apps/platform-console`; `services/api-gateway`, `services/mobile-bff`, `services/webhook-service`, `services/queue-workers` — **all 9 directories exist** (`[ -d ]` check, §evidence). This matches the Constitution ART-04 estate (modular monolith + four satellites + Next.js read/admin apps + one ops console) and `CLAUDE.md`'s Canonical Runtime Map.

### 2.2 Frozen apps (ART-22 / CLAUDE.md) — present, must stay frozen

`apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace`, `apps/platform-operations-portal` — each carries its own local `AGENTS.md` (§2.4). Constitutionally **de-deployed**; AF must not unfreeze them. AF_08 confirms `validateThemeForMarketplace` is NOT wired to any live marketplace pipeline (consistent with the freeze).

### 2.3 Reserved services (ART-19 — manifest-only, must stay empty)

`services/checkout-runtime`, `services/event-bus`, `services/notification-service`, `services/analytics-pipeline`, `services/media-service`, `services/search-service` — each has a local `AGENTS.md` (§2.4). Must stay empty; AF must not activate them.

### 2.4 Local `AGENTS.md` inventory

~75 local `AGENTS.md` files enumerated (`find … -name AGENTS.md`), including the frozen apps, reserved services, all active apps, and every `packages/*-core`. Note: ~19 are under `docs/archive/**` (legacy packages / firebase-legacy) — these are **HISTORICAL_ONLY** per `AGENTS.md AUTH-R2` and do not govern.

### 2.5 Route-ownership lockstep (VERIFIED_CURRENT — no violation surfaced)

A read-only scan for direct DB writes from app API routes (`grep -rEn "\.from\(['\"][a-z_]+['\"]\)\.(insert|update|upsert|delete)" apps/*/src/app/api`) returned **0** matches, and **0** app-route files reference a Supabase admin client in the sampled scan. This is consistent with the "apps are thin gateway proxies; never write the DB locally" rule (ART-04 / `CLAUDE.md`). AF-E (AF_05) performed the authoritative per-route tenancy pass and found no direct-write violation in the theme surface.

---

## 3. Validator inventory (VERIFIED_CURRENT) — it is **109**, not "107"

`scripts/validate-governance.mjs` references **109 unique validator `.mjs` files** (`grep -oE '"[a-z0-9-]+(-validator)?\.mjs"' | sort -u | wc -l` → 109). The historical "107-validator gate" figure in `CLAUDE.md` is therefore **STALE by +2** at current HEAD/working-tree.

- The `sequential-migration-validator.mjs` **IS invoked** by the gate (present in the selected list) — it is *not* excluded. (Directly answers the AF-A question.)
- The list includes the constitutional-enforcement validators expected by ART-02/R-18: `no-public-using-true-validator`, `no-blanket-service-role-validator`, `rls-force-coverage-validator`, `tenant-isolation-validator`, `canonical-ledger-only-validator`, `commission-bps-zero-validator`, `no-self-custody-rail-validator`, `identity-sole-issuer-validator`, `stepup-crypto-validator`, `single-source-crypto-validator`, `no-scan-generated-agents-validator`, `no-new-react-sections-validator`, `theme-governance-validator`, `migration-safety-validator`, `rollback-integrity-validator`, `generated-artifact-validator`, `topology-json-antifabrication-validator`, `meta-no-theater-validator`, and more.
- **`scripts/validate-governance.mjs` is itself Modified** in the working tree (`git status` → ` M`), and the working-tree copy adds `pricing-catalog-validator.mjs` (a V1-billing WIP validator). ⇒ The gate that would run *today* is **not byte-identical** to the gate at the Phase-AE commit. STATUS: FOREIGN_WIP on the gate driver itself.

---

## 4. Current governance-gate failure state (BROKEN, EXIT=1 — two explained causes)

Per AF_03 (gate baseline) and AF_04 (migration audit), the full `validate-governance.mjs` and its component validators produce **EXIT=1** from two independently-confirmed causes:

| Cause | Validator | Stable evidence | Class |
|-------|-----------|-----------------|-------|
| Tenant-registry drift | (tenant-registry / `tenant-tables.registry.ts` out of sync) | RISK-GOV-001; long-standing, recorded at every phase in `PROGRAM_STATE.md` | STALE / HISTORICAL_ONLY (pre-existing) |
| Untracked migrations 186/187 | `sequential-migration-validator.mjs` | EXIT=1; `186_v1_scale_commerce_os_coming_soon.sql` + `187_v1_sites_site_settings.sql` untracked (`git ls-files` empty) | FOREIGN_WIP |

Both causes are **explained and pre-existing** (not new unexplained failures). The anti-fabrication component passes (per `PROGRAM_STATE.md` attestation). Neither is a theme-programme regression. Both are **STOP inputs** to AF_12 because AF's own success definition requires `validate-governance.mjs` EXIT 0 and sequential-migration EXIT 0 (§15 of the AF prompt) — which cannot be reached without human action on the tenant registry and 186/187.

---

## 5. `validate-governance.mjs` mutation-side-effect determination (per the AF.0 mutation rule)

Reading the script: it calls `removeGeneratedArtifactDirectories()` (triggered by `stale-artifact-validator.mjs`), which `fs.rmSync(..., {recursive:true, force:true})` every directory named in `generatedDirectoryNames`:
`node_modules, .next, .turbo, dist, .dart_tool, build, coverage, .cache, .wrangler, .vercel, .symlinks, Pods`.

**Determination:** every one of these is a **gitignored generated/build directory — none is tracked source, and `tenant-tables.registry.ts` is not among them.** Running the full gate therefore does not mutate tracked files, but it *does* delete build caches (a filesystem mutation with a real cost — a full rebuild). Per the AF.0 mutation rule the discovery agents correctly **did not run the full `validate-governance.mjs`**, and instead ran the individual read-only component validators (`sequential-migration`, `migration-safety`, `no-public-using-true`, `rollback-integrity`) directly — each confirmed to leave `git status --porcelain` count unchanged (378 → 378). The full-gate EXIT=1 is accepted from the in-programme record (consistent at every phase) plus the directly-run components, not fabricated.

---

## 6. `CLAUDE.md` drift (governance-hygiene STOP input)

`git diff --stat CLAUDE.md` → **+39 insertions, 0 deletions.** The added lines are the **LCIS V2 / V3 intelligence-layer sections** (`tools/central-intelligence` :3334; Qdrant/Crawl4AI/GraphRAG/Playwright/SigNoz; the `/intelligence/*` query tables). The drift is **additive query-guidance**, not a change to any hard rule, money/auth/tenancy instruction, or the runtime map. Classification: **FOREIGN_WIP / governance-hygiene.** It is a STOP input only in the narrow sense that AF.1 must decide whether the operative context is the committed `CLAUDE.md` or the working-tree version before treating either as law (AF_09 D-02).

---

## 7. STOP/GO inputs for the AF_1 decision

**GO signals (governance/topology intact):**
1. The live law chain (Constitution → AGENTS_V2 → local AGENTS.md → CLAUDE.md) is present, internally consistent, and un-contradicted by current source; the Constitution is unambiguously supreme.
2. All 9 canonical runtime directories exist; frozen apps and reserved services remain present-and-frozen (local `AGENTS.md` each); no reserved service activated.
3. Route-ownership intact — no direct DB write from app API routes surfaced (0 matches); the gateway-proxy invariant holds on the theme surface (AF_05 authoritative).
4. The validator suite still enforces the Constitution's invariants (109 validators incl. tenancy/money/identity/anti-fabrication/theme-governance); `sequential-migration-validator` is invoked, not excluded.

**STOP / conditional inputs (must be resolved before AF.1 or before its success criteria can be met):**
5. **Governance gate is BROKEN (EXIT=1)** from two pre-existing causes — tenant-registry drift (RISK-GOV-001) and untracked 186/187. AF's own success definition requires EXIT 0; reaching it needs a human/generator action on the tenant registry (which AF.0 is forbidden to run) and a migration-ownership decision (ARB).
6. **The gate driver itself is FOREIGN_WIP** — `validate-governance.mjs` is Modified (adds `pricing-catalog-validator`), so the gate that runs today ≠ the Phase-AE gate. AF.1 must not stage this foreign change.
7. **`CLAUDE.md` is Modified** (+39 lines LCIS V2/V3). Operative-context ambiguity must be resolved by the founder before AF.1 treats CLAUDE.md as law.
8. **Validator count in CLAUDE.md is STALE** ("107" → actual 109). Documentation reconciliation item for AF.1D.

**Net AF-A contribution:** governance and topology are *structurally* sound and constitutionally compliant, but the **governance gate cannot reach EXIT 0 without human/ARB action on foreign WIP (tenant registry, 186/187, the modified gate driver)** — a decisive input toward `AF_1_STOP`.
