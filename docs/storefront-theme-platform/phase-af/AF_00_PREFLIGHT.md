# AF_00 — Phase AF.0 Pre-Flight (Repository Truth & Safety Gate)

**Phase:** AF — Governance Closure and Repository Truth Reset · **Sub-phase:** AF.0 (read-only discovery)
**Mode:** DISCOVERY FIRST · EVIDENCE FIRST · FAIL CLOSED
**Author:** Root integrator (Claude Code, Opus 4.8), read-only
**Timestamp of evidence:** 2026-07-17 23:11 IST (Asia/Kolkata)
**This document authorizes nothing beyond running the AF.0 read-only discovery fleet. It does not authorize AF.1 remediation.**

---

## 0. Verdict (see §6 for the gate)

`PREFLIGHT_GO` — it is safe to run the **read-only** AF.0 discovery fleet, because AF.0's only writes land in `docs/storefront-theme-platform/phase-af/` (a folder that did not exist before this document) and therefore overlap **zero** dirty files, worktrees, or foreign WIP. Every hazard found below is **recorded and carried forward to the AF_12 STOP/GO decision** — none of them is mutated or resolved by AF.0.

> The preflight gate answers only one question: *is read-only discovery safe to run now?* It is **not** the AF.1 remediation decision. The AF.1 GO/STOP decision (`AF_12`) is made after the discovery fleet produces evidence.

---

## 1. Repository identity (VERIFIED_CURRENT)

| Field | Value | Command |
|-------|-------|---------|
| Absolute root | `/Users/saai_sidd/Git/Letbuyy_Store` | `git rev-parse --show-toplevel` |
| Current branch | `stepup/main` | `git branch --show-current` |
| HEAD SHA | `7e1441a6538585be7ca1f1fb028c008e7893ddb4` | `git rev-parse HEAD` |
| HEAD short | `7e1441a6` | — |
| Detached HEAD? | **No** — `refs/heads/stepup/main` | `git symbolic-ref -q HEAD` |
| Upstream | **None configured** for `stepup/main` | `git rev-parse --abbrev-ref @{u}` → fatal |
| Remotes (names only) | `origin` | `git remote` |
| In-progress rebase/merge/cherry-pick/bisect (main worktree) | **None** | `.git/` scan |
| Node | `v22.22.3` | `node --version` |
| pnpm | `10.6.2` | `pnpm --version` |

**Branch-intent check:** `stepup/main` is the intended LetBuyy programme branch (it is the branch the entire B→AE programme committed to, and the archive-claimed export head `7e1441a6` matches the current HEAD exactly). HEAD is **not** detached. → No `PREFLIGHT_STOP` on branch grounds.

**Latest commit (HEAD):** `7e1441a6 feat(theme): add marketplace partner-submission validation gate + close theme_purchases RLS (Phase AE)` — this is the Phase AE commit produced immediately before Phase AF; consistent with the archive claim that `7e1441a6` is the AE/export head. Full ancestry reconstruction is deferred to Workstream AF-B (`AF_02`).

---

## 2. Dirty-tree & ownership map (VERIFIED_CURRENT)

`git status --porcelain` reports **377 entries**: 146 modified (`M`), 2 deleted (`D`), 229 untracked (`??`).

**The single load-bearing safety fact:** `git status --porcelain | grep phase-af` → **NONE**. The `docs/storefront-theme-platform/phase-af/` folder did not exist before this file (`ls` → "No such file or directory"). AF.0 writes only inside that folder. Therefore **no AF.0 write overlaps any dirty/foreign file.**

### 2.1 Cluster-level ownership map (per §6.2 — no AF-scope overlap anywhere)

| Cluster | Entries | Inferred owner | Overlaps AF.0 scope? | Classification |
|---------|--------:|----------------|:--------------------:|----------------|
| `apps/**` (merchant-control-plane 84, storefront-runtime 20, marketing-site 20, identity-platform 8, platform-console 7, others) | 141 | V1 / two-lane remediation WIP (Jun-19 mtimes per memory) | No | FOREIGN_WIP |
| `services/**` | 52 | V1 / LCIS WIP | No | FOREIGN_WIP |
| `packages/**` (incl. ~18 `lcis-*` packages) | 49 | LCIS + V1 WIP | No | FOREIGN_WIP |
| `docs/**` (v1 27, lcis-* dirs, central-intelligence, …) | 54 | Prior programmes' docs | No | FOREIGN_WIP |
| `V1_SCOPE_LOCK_2026_06_12/**` (LIQUID_MIGRATION 33, …) | 45 | V1 scope-lock / Liquid-migration planning WIP | No | FOREIGN_WIP |
| `database/**` (see §2.2) | 11 | Mixed (V1 + edited historical migrations) | No | FOREIGN_WIP / SECURITY_REVIEW_REQUIRED |
| `tests/**` | 8 | V1 WIP | No | FOREIGN_WIP |
| `tools/**`, `scripts/**`, `.github/**` | 8 | V1 / LCIS WIP | No | FOREIGN_WIP |
| root: `CLAUDE.md` (M) | 1 | **Governance file — dirty** (see §2.3) | No | UNKNOWN_OWNERSHIP · flag to AF-A |
| root: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` (M) | 3 | Workspace WIP | No | FOREIGN_WIP |
| root: `storefront-liquid-discovery.zip` (??) | 1 | **Unknown** (NOT the archive I produced) | No | UNKNOWN_OWNERSHIP |
| root: `exports/` (??) | 1 | **This session** — the doc archive I built last turn | No | OWNED_BY_AF-adjacent (mine) |
| `reports/`, `supabase/`, `"apps` (odd path) | 3 | WIP | No | UNKNOWN_OWNERSHIP |

No cluster is `OWNED_BY_AF`. AF.0 introduces exactly one owned path: `docs/storefront-theme-platform/phase-af/` (new).

### 2.2 Migration dirty state (carried to AF-D / `AF_04`) — [SECURITY_REVIEW_REQUIRED]

- **Modified historical migrations (tracked, edited in working tree):** `100_app_discovery_foundation.sql`, `109_orders_money_width.sql`, `111_customer_credentials_source_of_truth.sql`, `142_executable_payment_sessions.sql`, plus `config.toml`. Editing already-numbered historical migrations is a migration-immutability concern — **flagged for AF-D**, not touched here.
- **Untracked migrations:** `186_v1_scale_commerce_os_coming_soon.sql`, `187_v1_sites_site_settings.sql` (the historically "foreign WIP" pair), plus `database/supabase/.branches/` and untracked `rollback/176..178` files.
- **Migrations 188/189/190/191 are NOT in the dirty list** → consistent with them being committed/tracked (188–190 in earlier phases; 191 in the Phase AE commit `7e1441a6`). AF-D verifies.

### 2.3 Governance-file drift signal — [carried to AF-A / AF-I]

`CLAUDE.md` is **Modified** in the working tree (committed vs on-disk differ). The on-disk version is what is active in this session's context. This is a governance-law-chain drift signal — recorded for AF-A (`AF_01`). AF.0 does **not** edit `CLAUDE.md`.

**No secrets were read or printed.** No `.env`, token, key, cookie, credential, or connection string was inspected.

---

## 3. Worktree safety (VERIFIED_CURRENT) — [record only, not removed]

`git worktree list` shows the main worktree plus **11 agent worktrees** under `.claude/worktrees/agent-*`, **all pinned at commit `41b6ea49`** on branches `worktree-agent-*`.

- `41b6ea49` = `fix(identity): show turnstile on auth forms (2026-06-09)` and is a **verified ancestor of HEAD** (`git merge-base --is-ancestor 41b6ea49 HEAD` → YES). These are stale/orphaned isolated agent worktrees left over from prior workflow runs.
- Each has uncommitted content (10 have 1 dirty file, 1 has 10 dirty files). They are **FOREIGN_WIP / stale-agent** worktrees.
- They live under `.claude/worktrees/` — a **different path tree** from AF.0's `docs/.../phase-af/` write target. **No overlap.**
- No in-progress rebase/merge/cherry-pick/bisect exists in the main worktree.

**Action:** none. Per §4 and §6.3 the preflight does not remove, prune, stash, or reset any worktree. Recommend a human review of `git worktree prune` as a **non-AF.0** action; not performed here.

---

## 4. Law chain located & read (precedence order)

| # | Law file | Path | Status | Precedence |
|---|----------|------|--------|-----------|
| 1 | LetBuyy Constitution | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (471 lines) | FOUND — supreme law | 1 (highest) |
| 2 | Root operating rulebook | `AGENTS.md` (405 lines) | FOUND | 2 |
| 3 | Local `AGENTS.md` (per inspected path) | various | To be enumerated by AF-A | 3 |
| 4 | Root `CLAUDE.md` | `CLAUDE.md` (264 lines) | FOUND — **but Modified in working tree** (§2.3) | 4 |
| 5 | `PROJECT-INSTRUCTIONS.md` | (repo root) | **NOT_FOUND** — optional ("if present") | — |
| 6–16 | Canonical CTO "context brain" (`INDEX.md`, `01-company-and-product.md` … `11-glossary.md`) | (searched repo-wide) | **NOT_FOUND** — the exact numbered brain the prompt references does not exist at any non-archive path | — |

**Law-chain conflict finding (recorded, not blocking read-only discovery):** The prompt's law chain assumes a canonical numbered "context brain" (items 6–16) that is **absent** from the repository. The **actual** supreme law chain that *does* exist — Constitution → `AGENTS.md` → local `AGENTS.md` → `CLAUDE.md` — is intact and governs. Per §2 of the AF prompt, a *missing required governance file* is classified `BLOCKED`; however, the file that is missing is a prompt-assumed artifact, not a file the repository's own supreme law requires. The repository's own governance chain is complete. Therefore: **the missing context brain is recorded as a HISTORICAL_ONLY / NOT_PRESENT finding for Workstream AF-I**, and does not by itself force `PREFLIGHT_STOP` for read-only discovery. If the context brain is later deemed a hard requirement by the founder, this becomes an AF_12 STOP input. The Constitution, `AGENTS.md`, and `CLAUDE.md` will be fully read by AF-A before any topology claim is made.

---

## 5. Historical inputs treated as hypotheses (not truth)

The archive/programme claims (HEAD `7e1441a6`; B→L anchor `29f87115`; Phase-M `9186188e`; Phase-AC `83d61e0a`; foundation SHAs `073bcbfe`…`29f87115`; AE gates theme-engine 1726/1726, storefront 915/915, merchant 771/771, api-gateway ~537/540, governance EXIT=1, sequential-migration EXIT=1; migrations 186/187 foreign; 188–191 committed-unapplied; Liquid default `false`; 7 NOT-CONNECTED seams; 55-entry risk register 50 OPEN) are **hypotheses**. Only HEAD `7e1441a6` on `stepup/main` and the untracked-186/187 status are confirmed *so far*. Everything else is verified by the discovery fleet (AF-B/C/D/F/G) against current evidence, and any disproven number will be discarded.

---

## 6. Pre-flight gate

### 6.1 `PREFLIGHT_STOP` conditions evaluated

| Condition | Result |
|-----------|--------|
| Wrong/unknown branch or detached HEAD | **No** — `stepup/main`, attached, intended branch |
| In-progress rebase/merge/cherry-pick/bisect in main worktree | **No** |
| Missing core governance law (Constitution/AGENTS/CLAUDE) | **No** — all present (context-brain absence recorded as AF-I finding, not a core-law gap) |
| AF.0 write scope overlaps FOREIGN_WIP / UNKNOWN_OWNERSHIP | **No** — AF.0 writes only to new `phase-af/`; zero overlap |
| Any AF.0 activity would mutate source/tests/migrations/git-state | **No** — AF.0 is read-only + docs-only |

### 6.2 Verdict

**`PREFLIGHT_GO`.**

Read-only discovery (Workstreams AF-A…AF-J + adversarial AV-1…AV-5) is authorized to run. The fleet is bound by the AF.0 prohibitions (§4 of the master prompt): read-only outside `phase-af/`; no git writes; no source/test/migration edits; no generators/formatters/migrations; no production connection; no flag flips; return `UNKNOWN`/`BLOCKED` rather than guessing. The many hazards recorded above (dirty `CLAUDE.md`; edited historical migrations 100/109/111/142; untracked 186/187; stale agent worktrees; absent context brain; ~377-file foreign WIP mass) are **carried forward as evidence** into `AF_12` and are expected to weigh heavily on the AF.1 STOP/GO decision — but they do not make read-only discovery unsafe.

---

`PREFLIGHT_GO`
