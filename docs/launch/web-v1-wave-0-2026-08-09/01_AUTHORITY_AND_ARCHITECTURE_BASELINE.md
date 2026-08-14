# 01 — Authority & Architecture Baseline (Wave 0, Agent A)

> ## ⚠️ CORRECTION NOTICE — applied 2026-08-09 by the Wave 0 Doc Correction agent
>
> **Evidence artifact, not governance authority.** This notice was appended after publication; the body below is otherwise unmodified except where a `[CORRECTED …]` marker appears inline.
>
> | Field | Value |
> |---|---|
> | Repo | `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` (original tree, read-only) |
> | Branch / HEAD | `stepup/main` @ `ee3711829d857e986014c5811bb94d86ebc3d343` |
> | Date | 2026-08-09 |
>
> **What was wrong (severity: cosmetic, no downstream figure affected).** The header line below attributed the dirty-path count `6825` to `git status --porcelain=v1`. That count was produced by Agent B's `git status --porcelain=v2` run (see `03_WORKTREE_CHANGE_CLASSIFICATION.md` §1, which states `--porcelain=v2` explicitly). Doc 01 re-labelled a v2 figure as v1.
>
> **What it is now.** The label is corrected to name the command that actually produced the number, and the count is re-measured.
>
> **Evidence (EXECUTED this session, exit 0 each):**
> ```
> $ git rev-parse --abbrev-ref HEAD          → stepup/main
> $ git rev-parse HEAD                       → ee3711829d857e986014c5811bb94d86ebc3d343
> $ git status --porcelain=v1 | wc -l        → 6826
> $ git status --porcelain=v2 | wc -l        → 6826
> ```
> **Material impact: none.** Without `--branch`, porcelain v1 and v2 emit exactly one line per path, so the two counts are identical (6826 = 6826, verified above). The mislabel changed no derived figure anywhere in Wave 0.
>
> **Note on 6825 vs 6826.** Doc 01 and doc 03 recorded `6825` at audit start; the current measured value is `6826`. The delta is one additional **untracked** path appearing after those agents ran (the untracked bucket grew 30 → 31 while Wave 0 agents were concurrently writing into `docs/launch/`). No tracked-path count changed: `git diff HEAD --numstat | wc -l` is **6795** then and now.
>
> **Found by:** Wave 0 Doc Correction agent, re-measuring rather than copying the header figure. **See:** `30_CORRECTIONS_AND_STASH_HAZARD.md`.

**Document type:** Evidence artifact produced by this audit. **NOT governance authority.** It records what was independently read, executed, and observed against the repository on the date below. Where this document states a "fact," the fact is the repository's own governing documents and command output — never this audit's opinion.

- **Repo:** `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store`
- **Branch:** `stepup/main`
- **HEAD SHA at time of audit:** `ee3711829d857e986014c5811bb94d86ebc3d343` (verified via `git rev-parse HEAD`)
- **Working tree:** dirty (**[CORRECTED 2026-08-09]** `git status --porcelain=v2` → 6825 lines at audit start — the original text credited this to `--porcelain=v1`, but the figure came from Agent B's v2 run; both forms emit one line per path and were re-measured at **6826 each** on 2026-08-09, so the correction is a labelling fix only. This is a pre-existing repo state, not a change made by this audit — this audit made no repository writes other than this deliverable and its evidence file)
- **Timestamp used:** 2026-08-09 (per task instruction; system clock read `Sun Aug 9 04:48:03 IST 2026`)
- **Auditor:** Agent A — Authority and Architecture Auditor, Wave 0 Phase 1, read-only
- **What was executed vs. inferred:** every claim below is either (a) a direct quote with `path:line` from a file I read in full or in the relevant section, or (b) the output of a shell command I ran myself in this session (command + exit code recorded). Nothing is copied from the readiness ZIP's own percentages or from LCIS/graph cached output.
- **Raw evidence persisted at:** `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/A/` — `topology-and-git-facts-2026-08-09.txt`, `validate-governance-2026-08-09.txt`

---

## 1. The authority chain (as declared by the repo itself, independently confirmed)

Read in full: `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (472 lines), root `AGENTS.md` (406 lines). Read in relevant part: `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md`, `CLAUDE.md`.

| Rank | Document | Path | Role (self-declared) |
|---|---|---|---|
| 1 | `LETBUYY_CONSTITUTION.md` | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:1-9,34` | Supreme. "Nothing overrides it." Changes require constitutional amendment (§14). |
| 2 | root `AGENTS.md` (= `LETBUYY_AGENTS_V2`) | `AGENTS.md:1-9,33` | "The operating rules every agent follows. MUST conform to DOC 01." |
| 3 | `LETBUYY_CANONICAL_SYSTEMS.md` | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md:1-5,15-20` | Winner registry — one canonical system per domain. |
| 4 | `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md` + `LETBUYY_FOUNDATION_ROADMAP.md` | `GOVERNANCE_REWRITE_2026_06_10/` | How/when to converge and delete. |
| 5 | `LETBUYY_UI_UX_GOVERNANCE.md` + surviving `docs/governance/*` | `GOVERNANCE_REWRITE_2026_06_10/` | Domain governance. |
| 6 | Evidence base (forensic audit, strategic canonicalization) | — | "The why, not authority." |

This matches the CLAUDE.md project instructions given to this audit ("`GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` is supreme law... then root `AGENTS.md`... then the relevant local `AGENTS.md`, then the canonical governance rewrite documents") — **confirmed consistent**, no drift found between CLAUDE.md's stated chain and the Constitution's own P.3 chain.

### 1.1 Rule IDs governing each control area (path:line cited)

| Control area | Governing rule IDs | Path:line |
|---|---|---|
| **Topology** | ART-04 (one modular monolith + 4 satellites); ARCH-R1…R10 | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:165-169`; `AGENTS.md:64-95` |
| **Branch policy** | ART-03 (deploy meta-blocker); DEPLOY-R1…R4; also `.github/BRANCH_STRATEGY.md` | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:159-163`; `AGENTS.md:330-333`; `.github/BRANCH_STRATEGY.md:1-20` |
| **Deletion** | ART-24; DEL-R1…R6 | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:301-305`; `AGENTS.md:168-176` |
| **Money** | ART-10…ART-13; PAY-R1…R10; R-5…R-10 | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:207-229,397-403`; `AGENTS.md:241-255` |
| **Identity** | ART-05…ART-07; IDN-R1…R6; R-14 | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:173-189,411`; `AGENTS.md:258-267` |
| **RLS / tenancy** | ART-08, ART-09; SEC-R6…R9; R-1…R-4 | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:193-203,392-395`; `AGENTS.md:230-236` |
| **Deployment** | ART-03; DEPLOY-R1…R4 | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:159-163`; `AGENTS.md:328-334` |

Numbered Constitutional Rules R-1…R-23 live at `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:387-424` (§13); the "8 runtimes" doctrine lives at `AGENTS.md:60-80` and is restated (not re-decided) at `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md:72,321`.

---

## 2. Canonical runtime topology — repo docs vs. disk (independently verified)

Command run: `ls apps/ services/` and `ls apps/mobile/`, exit 0. Full output persisted at `raw-evidence/A/topology-and-git-facts-2026-08-09.txt`.

**On disk today:**
- `apps/`: `app-marketplace`, `developer-portal`, `identity-platform`, `marketing-site`, `merchant-control-plane`, `mobile/{merchant-app,operator-app,shopper-app}`, `platform-console`, `platform-operations-portal`, `storefront-runtime`, `theme-marketplace`
- `services/`: `analytics-pipeline`, `api-gateway`, `checkout-runtime`, `event-bus`, **`lcis-api`**, `media-service`, `mobile-bff`, `notification-service`, `queue-workers`, `search-service`, `webhook-service`

**Root `AGENTS.md` ARCH-R1** (`AGENTS.md:64-79`) names an "8 canonical runtimes" list: `services/api-gateway`, `services/queue-workers`, `services/mobile-bff`, `services/identity-platform` (app root `apps/identity-platform`), `services/webhook-service`, `apps/storefront-runtime`, `apps/merchant-control-plane`, `apps/marketing-site` — **plus** "the supporting, non-extractable surfaces that ride this topology: `apps/mobile/merchant-app` (Flutter), and one thin ops console (`apps/platform-console`)."

This is **consistent in substance** with CLAUDE.md's flatter 10-item "Canonical Runtime Map" (which lists the same 8 + `platform-console` + `apps/mobile/merchant-app` without separating the "8 core + 2 supporting" framing). No conflict here, only a presentation difference (CLAUDE.md merges two tiers root AGENTS.md keeps distinct) — **not escalated**, informational only.

Reserved (manifest-only) per `AGENTS.md:84-88` (ARCH-R4/R6): `services/checkout-runtime`, `services/event-bus`, `services/notification-service`, `services/analytics-pipeline`, `services/media-service`, `services/search-service`, `apps/mobile/shopper-app`, `apps/mobile/operator-app`. **Verified on disk:** `apps/mobile/shopper-app` and `apps/mobile/operator-app` each contain only `AGENTS.md` + `runtime.manifest.json` — no source, confirming manifest-only status (`raw-evidence/A/topology-and-git-facts-2026-08-09.txt`).

Frozen (de-deployed, code kept) per Constitution ART-22 (`:289-293`) and `AGENTS.md:95` (ARCH-R10): `apps/app-marketplace`, `apps/developer-portal`. `LETBUYY_CANONICAL_SYSTEMS.md:107,297-298,315` additionally names `apps/theme-marketplace` **machinery** as CANONICAL (the catalog is deliberately dormant, not the machinery itself) and `apps/platform-operations-portal` as the non-surviving ops console, `DELETE_AFTER_MIGRATION` into `apps/platform-console` (Constitution ART-24, `:301-305`). This matches CLAUDE.md's "frozen or pending consolidation" bucket for these four apps.

Deprecated aliases per `AGENTS.md:95` (ARCH-R10): `apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront`. **Verified absent from disk** — command run, all 9 paths checked, all `absent:` (`raw-evidence/A/topology-and-git-facts-2026-08-09.txt`). No mismatch found.

### 2.1 FINDING — undocumented runtime on disk: `services/lcis-api`

`services/lcis-api` exists on disk as a real Hono/TypeScript service (`src/`, `test/`, `dist/`, `package.json` name `@letbuyy/lcis-api`) but:
- Is **not** in root `AGENTS.md`'s 8-runtime list (`AGENTS.md:66-79`), not in its reserved list (`AGENTS.md:86`), not in its deprecated-alias list (`AGENTS.md:95`).
- Is **not** in CLAUDE.md's Canonical Runtime Map, reserved list, or Deprecated Runtime Policy list.
- Has **no `AGENTS.md`** and **no `runtime.manifest.json`** of its own (verified: `services/lcis-api/` contains `dist/`, `node_modules/`, `package.json`, `src/`, `test/` only — no manifest, no local AGENTS.md).

This is independently corroborated by an in-repo document (not authored by this audit): `docs/theme-system-current-state/02-runtime-and-route-map.md:75,78-79,324` states verbatim: *"`services/lcis-api` (`@letbuyy/lcis-api`) — A real Hono service with `src/`, `test/`, `dist/`, `tsconfig.json`, and a root script `lcis:api: tsx services/lcis-api/src/server.ts`. **No `runtime.manifest.json`** and **no `AGENTS.md`**... It appears in neither `canonicalServiceRoots` nor `reservedServiceRoots`... R-6 — P1 — `services/lcis-api` + 19 `packages/lcis-*` are outside every governance list — an ARCH-R2 breach the gate cannot detect."* `AGENTS.md:81` (ARCH-R2) states: *"MUST NOT add, deploy, or wire any runtime not in ARCH-R1... Adding a new runtime root requires a Constitution amendment + ARB approval."*

**This is a real topology mismatch between governing docs and disk**, already known to the repo's own `docs/theme-system-current-state` audit trail but **not reflected in CLAUDE.md, root `AGENTS.md`, or `LETBUYY_CANONICAL_SYSTEMS.md`** as of this audit. Flagged for escalation (§5).

---

## 3. Forbidden / reserved / frozen / canonical classification — citations

| App/service | Classification | Citation (path:line) |
|---|---|---|
| `services/api-gateway`, `services/queue-workers`, `services/mobile-bff`, `apps/identity-platform`, `services/webhook-service`, `apps/storefront-runtime`, `apps/merchant-control-plane`, `apps/marketing-site` | **Canonical (8-runtime core)** | `AGENTS.md:64-79`; Constitution ART-04 `:165-169` |
| `apps/platform-console` | **Canonical (thin ops survivor)** | Constitution ART-24 `:301-305`; `AGENTS.md:79,95` |
| `apps/mobile/merchant-app` | **Canonical (supporting, non-extractable)** | `AGENTS.md:79`; `LETBUYY_CANONICAL_SYSTEMS.md:99` (row 28, "CANONICAL") |
| `apps/app-marketplace`, `apps/developer-portal` | **Frozen (de-deployed, OAuth2/PKCE seam kept)** | Constitution ART-22 `:289-293`; `LETBUYY_CANONICAL_SYSTEMS.md:107,298,315` |
| `apps/theme-marketplace` | **Canonical machinery / catalog dormant-by-design** | `LETBUYY_CANONICAL_SYSTEMS.md:107,312-315` |
| `apps/platform-operations-portal` | **Non-survivor, `DELETE_AFTER_MIGRATION` into `platform-console`** | Constitution ART-24 `:301-305`; `LETBUYY_CANONICAL_SYSTEMS.md:259` |
| `services/checkout-runtime`, `services/event-bus`, `services/notification-service`, `services/analytics-pipeline`, `services/media-service`, `services/search-service` | **Reserved, manifest-only, MUST stay empty** | Constitution ART-19 `:267-271`; `AGENTS.md:86-87` (ARCH-R4/R5) |
| `apps/mobile/shopper-app`, `apps/mobile/operator-app` | **Reserved, manifest-only** | `AGENTS.md:88` (ARCH-R6) — verified empty on disk |
| `apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront` | **Deprecated aliases — MUST NOT recreate as active topology** | `AGENTS.md:95` (ARCH-R10) — verified absent from disk |
| `services/lcis-api` | **Undocumented / outside every governance list** | See §2.1 — no path:line classifies it in any governance doc |

---

## 4. Nested `AGENTS.md` files affecting CI, scripts, apps, services, database

Command run: `rg --files -g AGENTS.md` → **77 total** (76 nested + 1 root), exit 0 (`raw-evidence/A/topology-and-git-facts-2026-08-09.txt`).

- **No `AGENTS.md` under `scripts/`, `database/`, or `.github/`** — confirmed absent by direct search (`rg --files -g AGENTS.md scripts database .github` returned nothing). CI and database rules therefore live only in root `AGENTS.md` (§4 CODE, §7 TEST, §15 DEPLOY) and in `.github/BRANCH_STRATEGY.md` / `.github/CODEOWNERS`, not in a nested `AGENTS.md`.
- **Active (non-archive) nested `AGENTS.md` — 55 files**, covering every `apps/*`, `services/*` (including the 6 reserved services and both reserved mobile roots, each carrying its own boundary-only `AGENTS.md`), most `packages/*`, and `infrastructure/{ci-cd,cloudflare,deployment,dns,monitoring,observability,security}/`. Two also exist under `docs/research/` and `docs/implementation/`.
- **21 archived/legacy nested `AGENTS.md`** live under `docs/archive/**` (firebase-legacy, legacy-agent-memory, legacy-packages) — historical record only, consistent with the Constitution's instruction that historical references stay under `docs/archive/`.
- Spot-read `apps/mobile/merchant-app/AGENTS.md` in full (23 lines): it correctly subordinates itself to root `AGENTS.md` + the Constitution + `LETBUYY_CANONICAL_SYSTEMS.md`, and does **not** state any V1/V1.1 scope decision — it is silent on launch scope, which matters for the conflict in §5.1.

---

## 5. Conflict / escalation register (NOT resolved by this audit)

### 5.1 — MATERIAL CONFLICT: "Web-only V1, Flutter merchant mobile deferred to V1.1" vs. current governance's canonical classification of `apps/mobile/merchant-app`

**The conflict.** This audit's own task brief states as a "FROZEN PRODUCT DECISION (do not re-litigate)": *"LetBuyy V1 is Web-only... Flutter merchant mobile (`apps/mobile/merchant-app`) is deferred to V1.1."*

Independently reading the repo's own governance chain finds **no such deferral in DOC 01/02/03**:
- Constitution ART-04 (`GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:165-169`) lists `apps/mobile/merchant-app` (Flutter) as one of the supporting, non-extractable surfaces of the canonical topology — not reserved, not frozen.
- Root `AGENTS.md` ARCH-R1 (`AGENTS.md:79`) repeats this: `apps/mobile/merchant-app` "rides" the canonical 8-runtime topology.
- `LETBUYY_CANONICAL_SYSTEMS.md:99` (DOC 03, the winner registry) states row 28 explicitly: **"Mobile — `apps/mobile/merchant-app` (Flutter)... Status: CANONICAL"** — with no V1/V1.1 gate, no deferral language, and no reference to a scope freeze.
- The reserved-mobile-roots rule (`AGENTS.md:88`, ARCH-R6) names only `apps/mobile/shopper-app` and `apps/mobile/operator-app` as reserved; `merchant-app` is explicitly excluded from that reserved set.

**Where "V1.1 deferral" actually comes from.** Traced this claim to its source: `artifacts/local-operational-proof/letbuyy-merchant-app-v1-readiness-2026-08-09.zip → MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09/05_V1_SCOPE_FREEZE_AND_EXCLUSIONS.md:66-67,114-121,207,228`, which states: *"LetBuyy V1 is the web merchant platform plus the buyer storefront. The Flutter merchant app is a V1.1 companion release, gated on the four items in §3.3."* This document self-labels itself, in its own header, as: *"**Authority:** Evidence package. Subordinate to DOC 01 (Constitution), root `AGENTS.md`, DOC 03. This document freezes a **scope**. It does not amend the Constitution, alter a canonical winner, or reopen a frozen capability."*

**Why this is escalated, not resolved.** Per this audit's operating instructions, the readiness ZIP is subordinate evidence, never authority, and repo authority wins on conflict. DOC 01/02/03 name `apps/mobile/merchant-app` CANONICAL with no V1/V1.1 split; the ZIP's own scope-freeze document reclassifies its launch-wave status to "V1.1, gated" while simultaneously disclaiming that it is doing exactly that. Per Constitution §11.1 (Decision Classes, `:337-338`), "the canonical winner of a domain" is a **Class-A constitutional matter** requiring ARB ratification (§14) — an evidence package cannot make that call by itself, no matter how carefully it hedges. **This audit did not find an ARB amendment, a DOC 03 update, or any change to root `AGENTS.md`/the Constitution recording a V1.1 deferral of `apps/mobile/merchant-app`.** Until one exists, the currently governing documents (DOC 01/02/03) say `apps/mobile/merchant-app` is canonical, undeferred, riding the same topology as the 8 core runtimes.

**Escalation ask:** ARB/human decision needed on whether (a) DOC 03 is updated to record the mobile deferral as a ratified Class-A decision, or (b) the readiness ZIP's scope freeze is corrected to stop asserting a launch-wave/topology decision it is not authorized to make, or (c) the task brief's "frozen product decision" is itself the correct, already-approved-out-of-band call and DOC 01/02/03 are simply stale and need a conforming amendment. This audit takes no position on which resolution is correct — only that the three currently-governing documents and the task brief disagree, and only ARB can settle it.

### 5.2 — Undocumented runtime: `services/lcis-api` (see §2.1)

Not addressed anywhere in DOC 01/02/03 or CLAUDE.md; independently corroborated as a known, already-flagged gap in `docs/theme-system-current-state/02-runtime-and-route-map.md:75,324`, which itself calls it a P1, ARCH-R2-breaching finding. This audit did not find evidence the gap has since been closed (no `runtime.manifest.json` or `AGENTS.md` exists under `services/lcis-api/` as of this audit's read). Recommend: either (a) ARB names `lcis-api` a 9th canonical/internal-tooling runtime with a manifest and an `AGENTS.md`, or (b) it is explicitly classified as internal tooling outside the deploy topology (as its purpose — serving the LCIS graph API described in CLAUDE.md's AI Infrastructure section — suggests it may be), with that classification recorded in a governing doc. Not resolved by this audit.

### 5.3 — `docs/central-intelligence/*` self-labeling: no false-authority violation found, but worth naming

Every generated report sampled under `docs/central-intelligence/` (`LCIS_V4_CERTIFICATION.md`, `DOMAIN_EXPLAIN.md`, `DISCOVERY_V2_DRIFT.md`, `CURRENT_STATE_AUDIT.md`, `runtime-observability-report.md`) either carries "(generated)" in its own title/subtitle or explicitly states its numbers are computed by named extractor scripts and that live values are "query-bound"/"NOT CONNECTED" until credentials exist. This is consistent with `AGENTS.md:302-303` (DOC-R1/R2 — generated docs may exist but must never become authority, must be marked as generated). **No violation found in the sample read.** Not exhaustively checked across all ~20+ files in that directory; if a full audit of that directory is needed, it was out of this pass's time budget and should be a separate task.

### 5.4 — `CONVERGENCE_CLEANUP_2026_06_10/GOVERNANCE_CONSTITUTION.md` names itself a "constitution" — reviewed, found self-subordinating, not escalated

This file's own header explicitly states: *"HISTORICAL / EXECUTED CLEANUP RECORD. This file is not current authority and must not be used to override the law chain. Current authority is `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` -> root `AGENTS.md` -> canonical governance documents"* and further (§1.2) explicitly argues it does not violate Constitution ART-01's ban on a second competing constitution, confining itself to cleanup-execution procedure and disclaiming any authority to name a canonical winner. Read in full through §1.3. **This audit finds it correctly self-subordinates and does not flag it as a violation**, but records it here because a document literally named "GOVERNANCE_CONSTITUTION.md" sitting outside the `GOVERNANCE_REWRITE_2026_06_10/` directory is a naming choice that invites exactly the confusion ART-01 exists to prevent, and a future reader who does not read past the filename could reasonably be misled. Recommend (not a finding requiring action, an observation): consider renaming to avoid the word "Constitution" outside the canonical governance directory.

### 5.5 — Governance validator is currently RED, contradicting CLAUDE.md's operational-rules framing

CLAUDE.md's "Operational rules" section states: *"Keep the 107-validator gate green."* Independently ran `node scripts/validate-governance.mjs` from repo root — **exit code 1** (not 0). Output (full text at `raw-evidence/A/validate-governance-2026-08-09.txt`) shows the foundation anti-fabrication, tenant-isolation, production-safety, session-security, and operational-lifecycle validators all **passed**, but **Design-system governance FAILED** with 2 hard-invariant violations (dark-mode toggle unreachable in `marketing-site` and `developer-portal`) and 9 ratchet regressions (e.g. `appCssRawHex` rose from baseline 0 to 156; `tsxRawHex` rose from baseline 0 to 5; `rawPxSpacing` rose from baseline 1365 to 1584). This is a live, currently-true fact about repo state at this SHA, not a governance-authority conflict — recorded here because it directly contradicts the "keep the gate green" framing an agent might otherwise assume is currently true. Not resolved by this audit (fixing design-system drift is out of scope for a read-only authority audit); flagged for whichever wave owns UI-ratchet remediation.

---

## 6. What remains unverified by this audit

- **Live database state** (RLS policy grants, `pg_policies`, `pg_stat_user_tables` writers) — Constitution §14.4 (`:453-459`) and `AGENTS.md:397-401` (Appendix B) both already carry these as `UNVERIFIED`, requiring a live probe this audit did not perform (out of scope for a read-only authority/architecture audit; a database-layer wave should own this).
- **Whether `services/lcis-api` and the 19 `packages/lcis-*` workspaces have since been formally classified** anywhere outside `docs/theme-system-current-state/` — this audit checked CLAUDE.md, root `AGENTS.md`, and `LETBUYY_CANONICAL_SYSTEMS.md` only; a full-text search of every doc under `docs/lcis-*` and `docs/central-intelligence/` for a possible later classification was not performed given time budget.
- **Whether an ARB ratification exists somewhere in the repo** recording the mobile V1.1 deferral (§5.1) outside the readiness ZIP — this audit searched the Constitution, root `AGENTS.md`, `LETBUYY_CANONICAL_SYSTEMS.md`, and the mobile app's own local `AGENTS.md` and found none, but did not exhaustively grep every file under `GOVERNANCE_REWRITE_2026_06_10/`, `CONVERGENCE_AUDIT_2026_06_10/`, or `CONVERGENCE_CLEANUP_2026_06_10/` for a possible amendment record.
- **Full audit of every file under `docs/central-intelligence/`** for false-authority claims (§5.3) — only 5 of the directory's files were sampled.

---

*End of deliverable. This document is evidence produced 2026-08-09 by Agent A (read-only). It does not amend, and has no authority to amend, any governance document. All conflicts in §5 require human/ARB resolution.*
