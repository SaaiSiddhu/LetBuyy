# CANONICAL SYSTEM CONSISTENCY AUDIT — DO THE 7 DOCS NAME THE SAME WINNERS? (PHASE 2)

> **Document type:** ARB forensic consistency review of the LetBuyy governance stack. **NOT** an architecture change — a cross-document consistency audit. It hunts for places where the *already-decided* canonical winners are stated **inconsistently** across the 7 governance-rewrite documents, and prescribes the exact surgical text edit that makes every doc say the same thing.
> **Date:** 2026-06-10 · **Author:** ARB governance auditor (Phase 2 hardening pass) · **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store`
> **Scope of read (all 7, in `GOVERNANCE_REWRITE_2026_06_10/`):** `000_GOVERNANCE_INDEX.md` · `LETBUYY_CONSTITUTION.md` (DOC 01) · `LETBUYY_AGENTS_V2.md` (DOC 02) · `LETBUYY_CANONICAL_SYSTEMS.md` (DOC 03 — **the winner registry / source of truth**) · `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md` (DOC 04) · `LETBUYY_FOUNDATION_ROADMAP.md` (DOC 05) · `LETBUYY_UI_UX_GOVERNANCE.md` (DOC 06) · `LETBUYY_FINAL_ARCHITECTURE_SCORECARD.md` (DOC 07).
> **Absolute rule honored:** no winner is changed; no new system is named. Every fix below is a text edit that makes the docs state the **same** winner with the **same** name/path/class/wave. **This report does not modify any repo doc** — it is one new file.

---

## 0. Methodology

For each of ~33 domains, the named canonical winner was extracted from **every** document that mentions it, with `path:line` evidence, and the cells compared for: (1) **multiple/contradictory winners** (different systems crowned), (2) **ambiguous/tentative winners**, (3) **missing winners** (a doc that should name it but doesn't — acceptable when the doc's role doesn't require it), (4) **same winner, inconsistent name/path**, (5) **inconsistent classification** (CANONICAL/TRANSITIONAL/FROZEN/DEAD), and (6) **inconsistent wave/phase assignment**. DOC 03 (`LETBUYY_CANONICAL_SYSTEMS.md`) is treated as the registry-of-record; the other six must agree with it. The three seed findings were verified against code-line evidence and expanded.

**Authority-chain note (relevant to the whole audit).** All 7 docs agree on the *same* 6-rank authority chain (Constitution > AGENTS_V2 > Canonical Systems > Legacy+Roadmap > UI/UX > evidence) — verified identical in `000_GOVERNANCE_INDEX.md:9-15`, `LETBUYY_CONSTITUTION.md:34-41`, `LETBUYY_AGENTS_V2.md:30-37`, `LETBUYY_CANONICAL_SYSTEMS.md:17-26`. The chain itself is **not** a source of inconsistency. The inconsistencies are in *how individual winners are named*, not *which doc outranks which*.

---

## 1. Executive verdict

**The winner registry is substantively consistent and procedurally near-watertight — but it is NOT literally consistent.** On the **substance of every winner** (which system is canonical for each domain) the 7 docs agree: there is exactly one ledger, one issuer (`identity-platform`), one renderer (Liquid, React frozen), one storefront runtime, one token source, one shell (`AppNavigation`), one ops console, PA-split never-custody, 0% fee. **No domain has two genuinely-different systems crowned across docs.** That is the good news and it is load-bearing: an agent reading any single doc gets the right *system*.

**The discrepancies are naming-, path-, classification-, and sequencing-level drift, plus one internally self-contradicting survivor rationale.** Of the ~33 domains audited, **9 carry a real discrepancy** an agent could trip on, and **1 of those is CRITICAL** (the ops-console survivor rationale is contradicted by the very evidence cited to justify it, inside the same governance set). The rest are MAJOR name/path drift (most consequentially the `identity-platform` path: `apps/` vs `services/`) and a systemic **Wave-vs-Phase sequencing-vocabulary split** between the roadmap (P0–P12) and every other doc (Wave 0–8), which is reconciled *in prose* but never with a hard mapping table that an agent can mechanically apply.

**Bottom line for Codex:** the registry will not make an agent pick the *wrong system*; but it can make an agent (a) cite the **wrong path** for the issuer, (b) hard-code the **wrong ops-console survivor** by trusting a contradicted rationale, or (c) mis-sequence a deletion by reading "Wave 4" in one doc and "P5/P6" in another. CANON-G-001 is the one that can produce a wrong *irreversible* decision (deleting the wrong console); the rest are correctness-of-reference, not correctness-of-system.

**Consistency score: the registry is internally consistent on SYSTEM identity (33/33 domains), and inconsistent on naming/path/class/sequencing in 9/33 domains. 1 CRITICAL, 5 MAJOR, 3 MINOR.**

---

## 2. The domain × document winner-consistency matrix

> One row per domain. Cell = the winner **as that doc names it** (✓ = names it consistently with DOC 03; blank = doc does not address it, which is in-role for that doc; a *value* = the variant wording/path/class that doc uses). **MATCH?** = do all docs that name it agree exactly? Evidence `path:line` for every discrepancy is in §3.
> Columns: **C01**=Constitution · **A2**=AGENTS_V2 · **CAN**=Canonical Systems (DOC 03, the registry) · **LEG**=Legacy Plan · **RM**=Roadmap · **UX**=UI/UX · **SC**=Scorecard.

| Domain | C01 | A2 | **CAN (registry)** | LEG | RM | UX | SC | MATCH? | Discrepancy (ID) |
|---|---|---|---|---|---|---|---|:--:|---|
| **Identity (issuer)** | `identity-platform` (bare) | `services/identity-platform` *(app root apps/)* | **`apps/identity-platform`** | identity-platform | identity-platform | identity-platform | identity-platform | ⚠ | **path contradiction** apps/ vs services/ (CANON-G-002) |
| **Authentication** | ✓ | ✓ | identity-platform login + OTP + Turnstile | ✓ | ✓ | — | ✓ | ✓ | — |
| **Authorization (RBAC)** | ✓ | ✓ | default-deny; role from `app_metadata`/DB; ops `employee_permissions` | ✓ | ✓ | — | ✓ | ✓ | — |
| **Sessions** | ✓ | ✓ | one identity-platform session service | ✓ | ✓ | — | ✓ | ✓ | — |
| **MFA** | ✓ (deferred) | ✓ | step-up TOTP all realms (extend) | — | P12 deferred | — | ✓ | ⚠ | wave: CAN "4(/6)" vs RM "P12" (CANON-G-007) |
| **Passkeys** | ✓ (deferred) | ✓ | identity-platform WebAuthn — DEFERRED | — | P12 | — | ✓ | ✓ | — |
| **Consent (DPDP)** | ✓ | ✓ | identity-platform append-only consent ledger (build) | — | P11/P10 | — | ✓ | ⚠ | wave: CAN "4(/5–6)" vs RM "P11" (CANON-G-007) |
| **Tenant Isolation** | ✓ | ✓ | 3-layer fail-closed RLS+FORCE+GUC, off `service_role` | ✓ | ✓ | — | ✓ | ✓ | — |
| **Ledger** | ✓ | ✓ | canonical 8-account append-only double-entry ledger | ✓ | ✓ | — | ✓ | ✓ | — |
| **Payments** | ✓ | ✓ | single capture adapter → posts canonical ledger | ✓ | ✓ | — | ✓ | ✓ | — |
| **Settlement** | ✓ | ✓ | PA-split mirror (Razorpay Route / Cashfree) | ✓ | ✓ | — | ✓ | ✓ | — |
| **Reconciliation** | ✓ | ✓ | zero-break-or-explained-suspense; no auto-plug | ✓ | ✓ | — | ✓ | ✓ | — |
| **Checkout** | ✓ | ✓ | hosted `checkout.letbuyy.com` + server state machine | ✓ | ✓ | born-canonical | ✓ | ✓ | — |
| **Cart** | ✓ | ✓ | server-authoritative; client cart = thin view | ✓ | ✓ | — | ✓ | ✓ | — |
| **Orders** | ✓ | ✓ | `create_checkout_order` RPC; `order_items` relational | ✓ | ✓ | — | ✓ | ✓ | — |
| **Inventory** | ✓ | ✓ | reserve→commit + scheduled sweeper | ✓ | ✓ | — | ✓ | ✓ | — |
| **Discounts** | ✓ | — | typed 3-class `combines_with` engine (activate) | ✓ | — | — | — | ✓ | — |
| **Theme Runtime (renderer)** | ✓ | ✓ | **Liquid / portable-theme (OS-2.0)**; React FROZEN | ✓ | ✓ | ✓ (deferred) | ✓ | ✓ | — |
| **Theme Engine** | ✓ | ✓ | `@letbuyy/theme-engine` contract/schema/bundle | ✓ | ✓ | ✓ | ✓ | ⚠ | schema-const name drift (CANON-G-008) |
| **Theme Editor** | ✓ | ✓ | both editors CANONICAL, renderer-agnostic, PROTECT | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| **Storefront Runtime** | ✓ | ✓ | ONE `storefront-runtime` (Next/Vercel) hosts Liquid | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| **Merchant OS (control plane)** | ✓ | ✓ | `apps/merchant-control-plane` operator-first | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| **Mobile** | ✓ | ✓ | `apps/mobile/merchant-app` (Flutter) | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| **WhatsApp** | ✓ | ✓ | scoped `channel=whatsapp` (order-lifecycle + COD-confirm) | ✓ | ✓ | — | ✓ | ✓ | — |
| **Notifications** | ✓ | ✓ | WhatsApp-first router in monolith + queue-workers | ✓ | ✓ | — | — | ✓ | — |
| **Analytics** | ✓ | ✓ | analytics-read in api-gateway + rollups in queue-workers + mobile-bff | ✓ | ✓ | — | ✓ | ✓ | — |
| **Billing** | ✓ | ✓ | subscription billing; **0% fee permanent** | ✓ | ✓ | — | ✓ | ✓ | — |
| **Infrastructure / Domain** | ✓ | ✓ | one RLS Postgres + CF Workers + Vercel; `letbuyy.com` | ✓ | ✓ | — | ✓ | ✓ | — |
| **Deployment** | ✓ | ✓ (8-runtime) | pipeline → V1 **8-runtime** topology | ✓ | ✓ | — | ✓ (8-runtime) | ✓ | — |
| **Events / Outbox** | ✓ | ✓ | transactional outbox + typed catalog (no event bus) | ✓ | ✓ | — | ✓ | ✓ | — |
| **Design-Tokens** | ✓ (`packages/typescript/ui/src/tokens.ts`) | ✓ (`@letbuyy/ui` / tokens.ts) | **`packages/typescript/ui/src/tokens.ts`** | (3→1) | ✓ | ✓ (both names + token-core trap) | ✓ (tokens.ts) | ⚠ | dual naming `@letbuyy/ui` vs path; token-core trap (CANON-G-004) |
| **Navigation / Shell** | ✓ (`AppNavigation`) | ✓ (`AppNavigation`) | **`AppNavigation`** | `AdminShell` fork→LEGACY | ✓ | ✓ (`AppNavigation`) | ✓ (`AppNavigation`) | ✓ | — (consistent; `AdminShell` is correctly the *loser*) |
| **Ops console (survivor)** | tentative `platform-console` | tentative `platform-console` | tentative `platform-console` (UNVERIFIED) | **`platform-console` "already adopts AppNavigation"** | tentative `platform-console` | **BOTH adopt AppNavigation; ops-portal 7.0 > console 6.8** | tentative (ARB decision) | ✗ | **CRITICAL: survivor rationale self-contradicted (CANON-G-001)** |
| **Future Marketplace (apps/themes)** | ✓ (frozen) | ✓ (frozen) | machinery CANONICAL / catalog dormant; app+dev portal FROZEN | ✓ | ✓ (demand-gated) | — | ✓ | ✓ | — |
| **(cross-cutting) Wave↔Phase numbering** | Wave 0–8 | Wave 0–8 | **Wave 0–8** | Wave 0–8 (W0…W6) | **Phase P0–P12** | Wave/Phase 7 mix | Phase P0–P12 priorities | ⚠ | sequencing-vocabulary split (CANON-G-003) |

**Reading the matrix:** every "✓ system" cell means the doc names the **same canonical system** DOC 03 names — that is true for 33/33 domains. The "⚠"/"✗" rows are where the *name, path, class, or sequencing* of that same system drifts. The single "✗" (ops console) is the only place where following one doc's stated *rationale* could lead an agent to the wrong *decision*.

---

## 3. Per-discrepancy detail (evidence + why it matters)

### CANON-G-001 — CRITICAL — Ops console: the survivor rationale is contradicted inside the governance set
The registry, Constitution, AGENTS_V2, Legacy Plan, Roadmap, and Scorecard all name the ops-console survivor as **"tentatively `platform-console`, UNVERIFIED, ARB decision"** — and that *tentative* framing is itself consistent and correct (`LETBUYY_CONSTITUTION.md:302,457`; `LETBUYY_CANONICAL_SYSTEMS.md:259,473`; `LETBUYY_AGENTS_V2.md:95,400`; `LETBUYY_FOUNDATION_ROADMAP.md:401,659`; `LETBUYY_FINAL_ARCHITECTURE_SCORECARD.md:271`). The problem is the **stated reason** for the tentative pick. `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md:129` (LEG-022) justifies `platform-console` as the survivor: *"Tentatively the survivor (already adopts `AppNavigation`)."* But `LETBUYY_UI_UX_GOVERNANCE.md` proves that rationale does not discriminate between the two candidates and in fact points the other way:
- `LETBUYY_UI_UX_GOVERNANCE.md:136` — "OPERATIONS CLUSTER (`platform-operations-portal` 7.0, `platform-console` 6.8 — … the **only two apps that adopted `AppNavigation`**)";
- `LETBUYY_UI_UX_GOVERNANCE.md:337` — `platform-operations-portal | **AppNavigation** ✓ | keep | done | reference impl`;
- `LETBUYY_UI_UX_GOVERNANCE.md:336` — `platform-console | **AppNavigation** ✓ | keep | done | reference impl`;
- the per-app matrix `LETBUYY_UI_UX_GOVERNANCE.md:61-62` scores **ops-portal 7.0 vs console 6.8** (ops-portal higher), and `:148` notes console's accessibility is *worse* ("console 4/10, ops 5/10"; "`platform-console` = 1 `aria-*`, 0 `role`").

So the one concrete reason LEG-022 gives ("already adopts AppNavigation") is **true of BOTH**, and on the metric the UI/UX doc actually measures, the *rejected* candidate scores higher. An agent or ARB member reading LEG-022 in isolation would "confirm" `platform-console` on a rationale the governance set's own design authority refutes. Because the loser is **deleted** (`DELETE_AFTER_MIGRATION`, Wave 3 / P5), acting on the contradicted rationale risks deleting the *better* console. This is the single discrepancy most able to cause a wrong **irreversible** action.

### CANON-G-002 — MAJOR — `identity-platform`: same winner, contradictory path (`apps/` vs `services/`)
The issuer is unambiguously `identity-platform` in all 7 docs (system identity is consistent). But its **deployable path is stated two contradictory ways** in the two docs that enumerate the deployable topology:
- `LETBUYY_CANONICAL_SYSTEMS.md:74` (the registry, master table row 3): **`apps/identity-platform`** = sole issuer; restated `:119` "Winner: `apps/identity-platform`".
- `LETBUYY_AGENTS_V2.md:73` (ARCH-R1, the "8 canonical runtimes" table, row 4): **`services/identity-platform`** *(app root: `apps/identity-platform`)* — i.e. it lists the *service* path as canonical and relegates the app path to a parenthetical.
- The Constitution uses the **bare** name `identity-platform` (no prefix) in ART-04/ART-05 (`LETBUYY_CONSTITUTION.md:166,173`), as do the Roadmap and Scorecard — so they don't contradict, but they also don't resolve which prefix is canonical.

The memory note records that **the repo only has `apps/identity-platform`** (no `services/identity-platform` source). So AGENTS_V2's `ARCH-R1` table — the single most-cited "what are the 8 runtimes" reference an agent consults — names a path that **does not exist as source** as the primary, and buries the real one in a parenthetical. The registry (DOC 03) and AGENTS_V2 (DOC 02) thus disagree on the issuer's path, and AGENTS_V2's primary is the non-existent one. An agent wiring imports or a deploy manifest from `ARCH-R1` would target `services/identity-platform`.

### CANON-G-003 — MAJOR — Sequencing vocabulary split: roadmap is Phase P0–P12; every other doc is Wave 0–8
The registry, Legacy Plan, Constitution, AGENTS_V2, and Scorecard sequence work in **Waves** (`Wave 0`…`Wave 6`/`Wave 8`); e.g. DOC 03's master table "Wave" column (`LETBUYY_CANONICAL_SYSTEMS.md:70-107`) and DOC 04's "Wave" column + the W0/W2a/W2b/W2c/W1/W3/W4/W5/W6 execution order (`LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md:225-310`). The **Roadmap (DOC 05) is structured on Phases P0–P12** (`LETBUYY_FOUNDATION_ROADMAP.md:18-32`) and the Scorecard's priorities are also P0–P3. DOC 05 *does* provide a crosswalk column ("Wave(s)" per phase, `:18-32`) and prose reconciliation ("the same work, sequenced three ways"), but **no single canonical Phase↔Wave table** is published that an agent can mechanically apply, and the mapping is many-to-many (e.g. P5 = Waves 3–5; P2 = Waves 0→1→2). Result: DOC 03 says the React-renderer fork is decided at **"Wave 6"** (`:94`) and the Liquid flip at **"Wave 4"** (`:94,234`); DOC 05 puts theme work in **"P6"** with "Wave 6" in its crosswalk (`:414-433`) — an agent reconciling "delete this at Wave 4" (DOC 03/04) against "P6" (DOC 05) has to do the crosswalk by hand every time. This is consistency-by-prose, not consistency-by-table.

### CANON-G-004 — MAJOR — Design-token source: same winner, three names; plus the `token-core` collision
The single token source is consistently **the same file** everywhere, but it is *named* three ways and one name collides with an unrelated auth package:
- `LETBUYY_CANONICAL_SYSTEMS.md:106,266` and `LETBUYY_CONSTITUTION.md:276` (ART-20): **`packages/typescript/ui/src/tokens.ts`** (the full path).
- `LETBUYY_AGENTS_V2.md:288` (UI-R1): **"`@letbuyy/ui` / `packages/typescript/ui/src/tokens.ts`"** (package alias + path, given as equivalents).
- `LETBUYY_UI_UX_GOVERNANCE.md` uses both, and additionally flags the **naming trap** that must not be confused with the token source: `:215,484` (UX-R28) — `packages/token-core` is the **auth/JWT envelope** (`TokenKind`), **NOT** design tokens; must be renamed `@letbuyy/auth-token-core` or documented.

No doc *contradicts* another on which file is canonical, but the registry (DOC 03) and Constitution name it by **path**, AGENTS_V2 by **path-or-alias**, and only DOC 06 surfaces the `token-core` collision. An agent grepping "token source" across docs gets `@letbuyy/ui`, `tokens.ts`, and `token-core` in the same conceptual neighborhood, one of which is a decoy. The registry should pin one canonical wording and inherit DOC 06's disambiguation.

### CANON-G-005 — MAJOR — "8 canonical runtimes" list: consistent count, but identity row carries the path contradiction (joins CANON-G-002)
The "8 runtimes / monolith + 4 satellites" topology is **count-consistent and name-consistent** across `LETBUYY_CONSTITUTION.md:165-166` (ART-04), `LETBUYY_AGENTS_V2.md:64-78` (ARCH-R1), `LETBUYY_CANONICAL_SYSTEMS.md:72,295,321`, and `LETBUYY_FINAL_ARCHITECTURE_SCORECARD.md:27,46,84` — all list api-gateway + queue-workers + mobile-bff + identity-platform + webhook-service + storefront-runtime + merchant-control-plane + marketing-site, plus one ops console. **The count and membership match (verified).** The *only* divergence inside the list is the identity-platform path (CANON-G-002) and the fact that the Constitution's ART-04 lists the ops console as "**one** thin ops console" without naming the candidate while AGENTS_V2 ARCH-R1 names "`apps/platform-console` tentative" (`:79`) — a minor under-specification, not a contradiction. Logged separately so the fix to ART-04/ARCH-R1 keeps the *list* identical when CANON-G-002 is applied.

### CANON-G-006 — MINOR — React renderer classification verbiage: "FROZEN" vs "KEEP-FROZEN" vs "KEEP_TEMPORARILY / FROZEN"
The React renderer's fate is substantively identical everywhere (kept, frozen, NOT deleted for completeness, data-decided at Wave 6) — but the **class label is worded three ways**: `LETBUYY_CANONICAL_SYSTEMS.md:94` "FROZEN first, deleted-or-kept at Wave 6" and `:235` "KEEP_TEMPORARILY / FROZEN"; `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md:167` (LEG-044) "**KEEP-FROZEN** (freeze; NOT deleted for completeness)"; `LETBUYY_CONSTITUTION.md:254` (ART-17) "kept as a first-party compatibility fast-path, frozen at parity, and **deleted-or-frozen by data**". Three labels — `FROZEN`, `KEEP-FROZEN`, `KEEP_TEMPORARILY` — for one class. No agent would pick a wrong system, but the **classification taxonomy is not uniform**, which weakens the "one class per fate" discipline the registry is supposed to enforce. (Same minor verbiage drift affects the reserved services: DOC 03 says "FROZEN-empty", DOC 04 says "KEEP-FROZEN".)

### CANON-G-007 — MINOR — MFA / Consent wave assignment differs between registry and roadmap
DOC 03 assigns **MFA** to "Wave 4(/6)" and **Consent (DPDP)** to "Wave 4(/5–6)" (`LETBUYY_CANONICAL_SYSTEMS.md:78,80`). DOC 05 places **MFA/passkeys in P12** (demand-gated, `:582,598`) and **Consent/DSR in P11** (the beta gate, `:570`). Reading DOC 03's "Wave 4" against DOC 05's "P11/P12" is a real sequencing mismatch for two domains (an agent could schedule MFA enrollment into the early money/identity waves when the roadmap defers first-class merchant MFA to P12). This is a sub-case of CANON-G-003 but is called out because the *numbers themselves* (Wave 4 vs P11/P12) point at materially different points in the program, not just different vocabularies for the same point.

### CANON-G-008 — MINOR — Theme-engine schema-source constant named two ways
The single schema source is the engine's built-in schema constant in all docs, but it is named **`BUILT_IN_SECTION_SCHEMAS`** in `LETBUYY_AGENTS_V2.md:277` (THEME-R3) and `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md:168` (LEG-045), while DOC 03 refers to it generically as "`@letbuyy/theme-engine` … the contract/schema/validator/bundle source of truth" without the constant name (`:95,237`), and DOC 04 elsewhere also references "`RUNTIME_SECTION_SCHEMAS`" as the *loser* (`:168`). The winner constant name (`BUILT_IN_SECTION_SCHEMAS`) and the loser constant name (`RUNTIME_SECTION_SCHEMAS`) are both correct and consistent where they appear — this is flagged only so the registry pins the winner constant name once.

### CANON-G-009 — MINOR — `mobile-bff` / `mobile-bff` runtime role wording (consistent system, cosmetic)
All docs name `mobile-bff` as the canonical fan-in composite (a "real composite", not a pass-through). No contradiction; logged as a non-issue boundary so the matrix is complete. **No fix required.**

---

## 4. Canonical Consistency Findings register

> **Severity key:** **CRITICAL** = a contradictory/ambiguous winner (or a winner-rationale) that can lead an agent/ARB to pick or delete the *wrong system*. **MAJOR** = same winner, drifting name/path/sequencing that forces every reader to reconcile by hand and can produce a wrong *reference* (import, path, deploy entry, schedule). **MINOR** = cosmetic class/label/constant verbiage drift with no decision impact. Every fix is a surgical text edit that makes the docs state the **same** winner; **no winner is changed and no new system is named.**

| ID | Sev | Domain | Docs + path:line | Discrepancy | EXACT FIX (the one canonical wording to make all docs agree) |
|---|:--:|---|---|---|---|
| **CANON-G-001** | **CRITICAL** | Ops console survivor | `LEG-022` `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md:129` vs `LETBUYY_UI_UX_GOVERNANCE.md:61-62,136,148,336-337` | LEG-022 justifies `platform-console` as survivor *"already adopts `AppNavigation`"* — but UI/UX shows **both** consoles adopt `AppNavigation` and scores ops-portal **7.0 > console 6.8** (console a11y worse). The survivor rationale is refuted by the governance set's own design authority. | In **LEG-022**, **delete the rationale clause** "(already adopts `AppNavigation`)" — it is false-as-discriminator. Replace the Evidence cell tail with the ARB-neutral wording used everywhere else: *"Survivor is an **ARB decision (UNVERIFIED)** — `platform-console` and `platform-operations-portal` both adopt `AppNavigation`; the UI/UX matrix scores ops-portal 7.0 vs console 6.8 (see DOC 06 §3.D). The pick is on ops-task fit, not shell adoption."* Do **not** change the tentative `platform-console` default (it stays tentative, as in all 6 other docs). Add the same one-line note to `LETBUYY_CANONICAL_SYSTEMS.md:473` and `:259` so the registry records that "already adopts AppNavigation" is **not** the deciding factor. |
| **CANON-G-002** | **MAJOR** | Identity (issuer path) | `LETBUYY_CANONICAL_SYSTEMS.md:74,119` (`apps/identity-platform`) vs `LETBUYY_AGENTS_V2.md:73` (`services/identity-platform` primary) | Same winner, contradictory canonical path. AGENTS_V2's `ARCH-R1` table names `services/identity-platform` as primary and buries `apps/identity-platform` in a parenthetical — but only `apps/identity-platform` exists as source. | Pin **`apps/identity-platform`** as the one canonical path (matches the registry and the on-disk reality). In **`LETBUYY_AGENTS_V2.md:73`** rewrite the row-4 runtime cell to lead with the app path: **`apps/identity-platform`** *(deployed as the `identity-platform` issuer satellite)* — and drop `services/identity-platform` as the primary. Where the Constitution/Roadmap/Scorecard use bare `identity-platform`, leave them (they don't contradict), but the two enumerating docs (DOC 02, DOC 03) MUST both say `apps/identity-platform`. |
| **CANON-G-003** | **MAJOR** | Sequencing (Wave↔Phase) | `LETBUYY_FOUNDATION_ROADMAP.md:18-32` (P0–P12) vs `LETBUYY_CANONICAL_SYSTEMS.md:70-107` + `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md:225-310` (Wave 0–8) | Roadmap sequences in Phases; registry + legacy plan sequence in Waves; reconciled in prose but no single mechanical mapping table. | Publish **one canonical Phase↔Wave crosswalk table** as a shared block and reference it from all sequencing docs. Use the mapping the Roadmap already implies (`:18-32`): P0/P1/P2-leaks=Wave 0; P3/P4/P2-engage=Wave 1; P3-recon/P8/P9/P2-×261=Wave 2; P5-domain=Wave 3; P5-freeze=Wave 4; P5-delete=Wave 5; P6/P7/P9=Wave 6; P10/P11=Wave 7; P12=Wave 8. Add it once (DOC 05 §0.1 already has the column — promote it to a standalone table) and have DOC 03 §2 + DOC 04 §3 cite "Wave N (= Phase Px, DOC 05 crosswalk)". No wave/phase value is *changed*; they are made mutually resolvable. |
| **CANON-G-004** | **MAJOR** | Design-token source | `LETBUYY_CANONICAL_SYSTEMS.md:106,266` + `LETBUYY_CONSTITUTION.md:276` (path) vs `LETBUYY_AGENTS_V2.md:288` (`@letbuyy/ui` / path) vs `LETBUYY_UI_UX_GOVERNANCE.md:215,484` (token-core trap) | One winner named 3 ways; `packages/token-core` (auth/JWT) is a same-word decoy not disambiguated outside DOC 06. | Canonical wording everywhere: **"`packages/typescript/ui/src/tokens.ts` (the `@letbuyy/ui` token source)"** — path first, alias in parens. Add to **`LETBUYY_CANONICAL_SYSTEMS.md:106`** (Design System row) and **§3.7** a one-line inheritance of DOC 06's trap: *"`packages/token-core` is the auth/JWT envelope, NOT design tokens (DOC 06 UX-R28)."* Keep AGENTS_V2 UI-R1's "`@letbuyy/ui` / path" but reorder to path-first to match the registry. |
| **CANON-G-005** | **MAJOR** | 8-runtime list (identity row + ops-console naming) | `LETBUYY_CONSTITUTION.md:165-166` (ART-04, ops console unnamed) vs `LETBUYY_AGENTS_V2.md:64-79` (ARCH-R1, names `platform-console` tentative) | List count/membership match; the only intra-list drift is the identity path (CANON-G-002) and ART-04 leaving the ops-console candidate unnamed while ARCH-R1 names it. | When applying CANON-G-002, also align the ops-console mention: in **`LETBUYY_CONSTITUTION.md:166`** change "and **one** thin ops console" → "and **one** thin ops console (tentatively `apps/platform-console`, ARB-decided per DOC 04 LEG-022)". This makes ART-04's list bit-for-bit consistent with ARCH-R1 and CANON-G-001's wording. No new system; the list stays 8 runtimes + 1 console. |
| **CANON-G-006** | **MINOR** | React renderer / reserved-svc class label | `LETBUYY_CANONICAL_SYSTEMS.md:94,235` (`FROZEN`/`KEEP_TEMPORARILY`) vs `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md:167` (`KEEP-FROZEN`) vs `LETBUYY_CONSTITUTION.md:254` (prose) | One fate, three class labels (`FROZEN`, `KEEP-FROZEN`, `KEEP_TEMPORARILY`); reserved svcs likewise "FROZEN-empty" vs "KEEP-FROZEN". | Adopt **one class token: `KEEP-FROZEN`** (the Legacy-Plan verdict word, since DOC 04 owns the taxonomy) everywhere a *class* is named, with "(NOT deleted for completeness; Wave-6 data decision)" as the standard qualifier for React. Sweep `LETBUYY_CANONICAL_SYSTEMS.md:94,97,235,252,276` and the reserved-service rows to say `KEEP-FROZEN`. Substance unchanged. |
| **CANON-G-007** | **MINOR** | MFA / Consent wave | `LETBUYY_CANONICAL_SYSTEMS.md:78,80` (Wave 4) vs `LETBUYY_FOUNDATION_ROADMAP.md:570,582,598` (P11/P12) | Registry "Wave 4" vs roadmap "P11/P12" for MFA & Consent — numerically different program points, not just vocabulary. | Resolve via the CANON-G-003 crosswalk **and** correct the registry cells: set DOC 03 MFA to "Wave 6→8 (= P12 first-class enrollment; plumbing extendable earlier)" and Consent to "Wave 7 (= P11 beta-gate; primitive buildable in P10)" so the registry's wave matches the roadmap's phase under the published mapping. Don't move the work; make the two numbers name the same point. |
| **CANON-G-008** | **MINOR** | Theme-engine schema constant | `LETBUYY_AGENTS_V2.md:277` + `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md:168` (`BUILT_IN_SECTION_SCHEMAS`) vs `LETBUYY_CANONICAL_SYSTEMS.md:95,237` (generic) | Winner schema constant named in DOC 02/04 but not pinned in the registry. | In **`LETBUYY_CANONICAL_SYSTEMS.md:237`** (Theme Engine winner), name the constant once: *"the single generated schema source is the engine's `BUILT_IN_SECTION_SCHEMAS` (storefront `RUNTIME_SECTION_SCHEMAS` is the loser)."* Aligns DOC 03 with DOC 02/04. |
| **CANON-G-009** | **MINOR** | (boundary) `mobile-bff` role | all docs | No discrepancy — `mobile-bff` consistently the canonical composite. | **No fix.** Logged for matrix completeness. |

---

## 5. What is NOT inconsistent (so the ARB doesn't over-correct)

To bound the fix surface, these were checked and found **consistent** — do not edit them:
- **Every money winner** (ledger, payments, settlement, reconciliation, billing/0%-fee, bigint paise, real crypto step-up, never-custody PA-split) is named identically across all docs that mention it (DOC 03 §3.3, Constitution ART-10…13, AGENTS_V2 PAY-R1…10, Legacy §2.6, Roadmap P3, Scorecard rows 3–5). No money domain has a second system named anywhere.
- **The renderer winner is Liquid in all 7 docs**, with React consistently the *frozen loser* (not a competing winner) — the C3 "do not delete React early" rule is stated the same way everywhere (Constitution ART-17, DOC 03 §3.5, AGENTS_V2 THEME-R1, Legacy LEG-044, Roadmap P6, Scorecard decision 9, UI/UX §11). The label verbiage (CANON-G-006) is the only drift.
- **`AppNavigation` is the one shell** and **`AdminShell`/`Sidebar`/`HeaderBar` is the consistently-named loser** in every doc — no doc crowns a second shell. The ops-console issue (CANON-G-001) is about *which app survives*, not *which shell wins*.
- **The 8-runtime topology count + membership** match across Constitution, AGENTS_V2, Canonical Systems, Scorecard (only the identity *path* drifts, CANON-G-002/005).
- **The Never-Build list** (22-service fleet, CQRS/saga, multi-region, self-custody, Wasm checkout, headless Hydrogen, full in-WhatsApp, GMV fee, 6 reserved services) is consistent across Constitution §10, AGENTS_V2 §6/NEVER, DOC 03 §5 — same items, same triggers.

---

## 6. Final note on provenance

This audit changed no winner and named no new system; it verified that the 7 docs **agree on every canonical system** and isolated the 9 places where the *naming, path, classification, or sequencing* of those agreed winners drifts. The three seed findings are all confirmed and sharpened: (a) the identity-platform path contradiction is real and lands specifically in AGENTS_V2 `ARCH-R1` (CANON-G-002) — note the Constitution uses the *bare* name, so the contradiction is DOC 02-vs-DOC 03, not Constitution-vs-DOC 03 as the seed framed it; (b) the ops-console survivor rationale is internally self-contradicted exactly as seeded, and is the one CRITICAL (CANON-G-001); (c) the "8 canonical runtimes" list is count- and membership-identical across Constitution / AGENTS_V2 / Canonical Systems / Scorecard — its only internal drift is the identity path. The single most dangerous inconsistency is **CANON-G-001**, because every other discrepancy yields a wrong *reference* that a build step would surface, whereas CANON-G-001 yields a plausible-but-wrong *deletion decision* on a rationale the governance set's own design authority refutes.

*End of CANONICAL_CONSISTENCY_REPORT.md (Phase 2 — Canonical System Consistency Audit). One new file; no repo doc modified. Evidence pinned against the 7 docs in `GOVERNANCE_REWRITE_2026_06_10/`, 2026-06-10.*
