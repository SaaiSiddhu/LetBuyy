# LEGACY ELIMINATION GAP REPORT — PHASE 4 (GOVERNANCE HARDENING)

> **Document type:** ARB governance-completeness audit of the legacy-elimination layer. This report does **not** change a single deletion decision, fate, gate, or wave. It audits whether **every** loser/legacy/dead system in the LetBuyy tree has a **complete, gated, rollback-safe disposition** — exactly one fate, a migration path where it is a winner's predecessor, a validation gate on every deletion, a rollback on every migration, and an ordering that never deletes a thing before its replacement is live.
> **Date:** 2026-06-10 · **Author:** Architecture Review Board (ARB) — Governance Hardening pass · **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store`
> **Subject documents (READ, not modified):** `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md` (DOC 04 — 78 LEG rows), `LETBUYY_CANONICAL_SYSTEMS.md` (DOC 03 — winner registry), `LETBUYY_FOUNDATION_ROADMAP.md` (DOC 05), `LETBUYY_CONSTITUTION.md` (ART-24), `LETBUYY_AGENTS_V2.md` (DEL/MIG rules).
> **Cross-referenced source layer:** `STRATEGIC_CANONICALIZATION_2026_06_10/SAFE_DELETION_PLAN.md` (DEL-0…062 blocks), `LEGACY_ERADICATION_REGISTER.md` (LEG-001…078 source).
> **Output:** ONE new report. No subject doc edited.

---

## 0. Methodology

For every loser, legacy, dormant, dead, or duplicate system named anywhere in the canonicalization/forensic corpus, this audit asked seven completeness questions and recorded a gap (with `path:line`) wherever the answer was "no":

1. **One fate.** Exactly one verdict ∈ {KEEP, MIGRATE/MIGRATE-then-DELETE, ARCHIVE, DELETE}. Flag any system with **no fate**, or **two conflicting fates** across docs.
2. **Migration path for every winner.** Every DOC 03 §2/§3 canonical winner that supersedes a loser names a current→canonical path. Flag winners with none.
3. **Validation gate on every deletion.** Every `DELETE` / `MIGRATE-then-DELETE` names its pre-delete checks (zero-importer, build, test, governance, winner-live). Flag a deletion with no gate.
4. **Rollback on every migration.** Every `MIGRATE-then-DELETE` / migration has a rollback (`git revert` / paired DOWN). Flag migrations with no rollback.
5. **Gate-on-winner integrity.** Every `DELETE_AFTER_MIGRATION` names the WINNER it gates on, and that winner exists in DOC 03. Flag orphan gates (gated on an undefined winner) and winners nothing is gated on.
6. **Ordering integrity.** A `DELETE_AFTER_MIGRATION` item is ordered AFTER its winner's go-live wave. Flag delete-before-replacement.
7. **Coverage.** Cross-check the forensic DEAD/LEGACY set (~28k LOC dead packages, parallel auth/money/theme systems, duplicate schemas, theater validators, ~120 governance docs, 60+ root docs) — is each represented in the LEG register with a fate? Flag any DEAD/LEGACY system the forensic/canonicalization work named that has **no LEG row** here.

**Method:** every claim below is pinned to a `file:line` in the subject or source docs and was read directly (no inference from summaries). IDs are `LEGV-G-001 … LEGV-G-018`.

---

## 1. Executive verdict

**The legacy-elimination layer is, on the 78 enumerated LEG rows, the single most complete artifact in the LetBuyy governance corpus.** Disposition, gating, and rollback discipline are near-total *for the rows that exist*. The gaps are not "the law is unsafe" — they are **(a) one undetermined fate that the governance never forces a decision on, and (b) a coverage seam where ~6 named losers live only in DOC 03 prose and never received a LEG row, a gate, a wave, or a rollback.** Both are *governance-completeness* defects, not deletion-safety errors in the rows already written.

### Coverage scorecard (of what is enumerated)

| Completeness dimension | Result | Evidence |
|---|---|---|
| **Every LEG row has exactly one fate** | **77 / 78** | The lone exception is the **conditional/undetermined fate** on LEG-022 (`DOC04:129`) — see LEGV-G-001 (CRITICAL). |
| **No conflicting fates across docs** | **PASS (0 conflicts)** | DOC 04 verdict ↔ DOC 03 §3 "Deletion Plan" ↔ `LEGACY_ERADICATION_REGISTER.md` classification ↔ `SAFE_DELETION_PLAN.md` DEL class map 1:1 for all 78. The 4-verdict↔5-class mapping is explicit and lossless (`DOC04:28-36`). |
| **Validation gate on every deletion (of LEG rows)** | **78 / 78** | Every LEG row carries a "Validate-before-delete" column; every `DEL-xxx` block carries Pre-/Post-deletion validation + the V-IMPORT/BUILD/TEST/GOV/SMOKE/ROLLBACK taxonomy (`DOC04:40-54`; `SAFE_DELETION_PLAN.md:33-46`). **0 ungated deletions among the LEG rows.** |
| **Rollback on every deletion/migration (of LEG rows)** | **78 / 78** | Every `DEL-xxx` block has a Rollback Plan; R-DEL-3/R-DEL-8 + ART-24 + `MIG-R3` mandate paired DOWN / `git revert` (`SAFE_DELETION_PLAN.md:631-637`; `DOC04:322-338`). |
| **Gate-on-winner integrity** | **PASS (0 orphan gates)** | Every `MIGRATE-then-DELETE` names a DOC 03 winner that is defined in DOC 03 §2/§3. No deletion gates on a non-existent winner. |
| **Ordering integrity** | **PASS (0 delete-before-replacement)** | The wave model (`DOC04:220-311`) gates every money/auth/theme deletion strictly after its winner's go-live wave; W1 money paths gate on A3 LIVE, W2c auth on A1 LIVE, W4 theme on A5 LIVE. |
| **Coverage of the forensic DEAD/LEGACY set** | **GAP** | ~6 losers named in DOC 03 §2 "Replaces/kills" have **no LEG row** (no gate/wave/rollback): client React cart, inventory side-doors, scalar discount RPC, mock label generators, the `AdminShell`/`Sidebar`/`HeaderBar` shell fork + per-app `--lb-*` redefs, the 4 mobile color classes + 8 hand-rolled shells. See LEGV-G-007…012 + the missing-coverage table §3.8. |

**Disposition coverage:** 77/78 LEG rows fully dispositioned (98.7%); +~6 prose-only losers undispositioned at the operative (gated) level.
**Gate coverage:** 100% of LEG-row deletions; 0% of the ~6 prose-only losers (no gate exists).
**Rollback coverage:** 100% of LEG-row deletions; n/a for the prose-only losers (no deletion artifact exists to roll back).

**Bottom line:** The plan is safe to execute as written for all 78 rows. Before it can claim *"every loser is dispositioned,"* it must (1) force the LEG-022/023 ops-console survivor decision with a gate that has an owner + a deadline, and (2) promote the ~6 DOC-03-prose-only losers into real LEG rows with gates, waves, and rollbacks.

---

## 2. The gap tables

### 2.1 No-fate / conditional-fate (a system whose verdict is never forced to one value)

| Gap ID | System | Doc · path:line | Problem |
|---|---|---|---|
| LEGV-G-001 | **LEG-022 `apps/platform-console`** | `DOC04:129` | Fate literally written as **"KEEP (if survivor) / MIGRATE-then-DELETE (if not)"** — a **two-valued, undetermined verdict**. The disambiguating decision ("ARB picks the survivor") is marked **UNVERIFIED** in the same cell and is never forced by any gate, owner, or deadline. One of two *deployed production apps* therefore has no settled fate. |
| LEGV-G-002 | **LEG-023 `apps/platform-operations-portal`** | `DOC04:130` | Fate written as **"MIGRATE-then-DELETE (if not survivor)"** — conditional on the same unforced LEG-022 decision. If the ARB silently never chooses, **both** apps persist (the exact C1 "two parallel systems" failure ART-24 exists to end), with neither's deletion gate ever satisfiable. |

### 2.2 Conflicting-fate (same system, two different verdicts across docs)

| Gap ID | System | Doc · path:line | Finding |
|---|---|---|---|
| — | (none found) | — | **PASS.** No system carries two conflicting fates. The 4-verdict scheme in DOC 04 (`DOC04:28-36`) maps deterministically onto the 5-class legend in `LEGACY_ERADICATION_REGISTER.md:30-36`; DOC 03 §3 "Deletion Plan" text agrees with DOC 04 for all 78 rows. The only *near*-conflict is presentational: DOC 04 uses verdict label `MIGRATE-then-DELETE` while the source register uses `DELETE_AFTER_MIGRATION` (`LEGACY_ERADICATION_REGISTER.md:33`) — same meaning, explicitly mapped, not a conflict. |

### 2.3 No-migration-path (a winner named with no current→canonical path)

| Gap ID | Winner (DOC 03) | path:line | Problem |
|---|---|---|---|
| LEGV-G-003 | **Discounts** — "the typed 3-class `combines_with` discount engine (ACTIVATE)" | `DOC03:90`, `DOC03:210-213` | DOC 03 §3 gives a one-line migration ("Activate the typed engine; demote the scalar RPC") but the loser — the **scalar single-code discount RPC** — has **no LEG row, no DEL block, no gate, no wave, no rollback**. The migration is named but not *operationalized*; "demote" has no validate-before-delete. |
| LEGV-G-004 | **Cart** — "server-authoritative; client cart → thin view" | `DOC03:88`, `DOC03:200-203` | Migration is "demote the client cart to a view," but the loser (`cart-context.tsx`, `stock:999`) is dispositioned only as prose "LEGACY → thin view (Wave 3)" — **no LEG row / DEL block / gate / rollback**. A demotion that touches the live buyer path has no V-SMOKE gate. |
| LEGV-G-005 | **Inventory** — "single reserve→commit; one path" | `DOC03:89`, `DOC03:205-208` | Migration "unify the side doors onto the one path," but the losers (**direct-`available`-decrement side doors; order-edit add-item-without-reservation**) have **no LEG row / gate / rollback**. (P8 W-21 in DOC 05 names the work, `ROADMAP:488`, but there is no *deletion-validation* gate for removing the side doors.) |
| LEGV-G-006 | **Shipping** — "Shiprocket-real; others mocked behind the adapter" | `DOC03:91`, `DOC03:215-218` | Migration "wire the Shiprocket adapter," loser = **scaffold/mock label generators**, dispositioned only as prose "→ adapter mocks (Wave 3)" — **no LEG row / gate**. (Lower severity: these are *demoted to seams*, not deleted; but the demotion still has no validate step.) |

### 2.4 No-validation-gate (a deletion with no pre-delete checks)

| Gap ID | Deletion | path:line | Problem |
|---|---|---|---|
| LEGV-G-007 | The **6 prose-only losers** (LEGV-G-003…006 + LEGV-G-011/012 below) | DOC 03 §2 rows 17/18/19/20/27/35 (`DOC03:88-91,98,106`) | Each is dispositioned in DOC 03 prose ("→ thin view", "→ unified", "LEGACY Wave 3/4-5") but **carries no LEG row**, hence **no "Validate-before-delete" column and no `DEL-xxx` block** with V-IMPORT/V-BUILD/V-TEST/V-SMOKE/V-ROLLBACK. They are the only "deletions/demotions" in the entire program with **no operative validation gate.** |
| LEGV-G-008 | (sub-case, money-adjacent) inventory side-door removal | `DOC03:89` | Because inventory is a *checkout-path* control, removing a direct-decrement side door without a V-SMOKE(reserve→commit still serves) gate risks an oversell regression — a deletion that *should* be in the heaviest-gated bucket (`TEST-R2`, `AGENTS_V2:200`) has no gate at all. |

### 2.5 No-rollback (a migration with no revert/DOWN)

| Gap ID | Item | path:line | Finding |
|---|---|---|---|
| — | (none among LEG rows) | `SAFE_DELETION_PLAN.md:631-637`; `DOC04:322-323` | **PASS for all 78 LEG rows.** Every `DEL-xxx` block has a Rollback Plan; R-DEL-3 / `MIG-R3` make a missing DOWN a defect; the program *itself* fixes the only known rollback debt (LEG-059/060: the 3 missing migration rollbacks 138/140/157 + the 151/160 `DROP COLUMN` residue) as a **precondition** to the schema waves (`DOC04:296`, `SAFE_DELETION_PLAN.md:593-609`). |
| LEGV-G-009 | The ~6 prose-only losers | DOC 03 §2 rows 17/18/19/20/27/35 | Corollary of LEGV-G-007: with no DEL block, they have **no rollback plan** either. A "demote client cart to a view" change on the live path has no documented revert. (Listed separately because the *rollback* dimension specifically — not just the gate — is unaddressed.) |

### 2.6 Orphan-gate (gated on a winner that is not defined) / winner nothing gates on

| Gap ID | Item | path:line | Finding |
|---|---|---|---|
| — | (no orphan gates) | DOC 03 §2 (`DOC03:70-107`) | **PASS.** Every `MIGRATE-then-DELETE` gate names a DOC 03 winner that is defined: A1 identity-platform (`DOC03:74`), A3 canonical ledger + PA-split (`DOC03:83-84`), A5 Liquid/theme-engine (`DOC03:94-95`), A6 storefront-runtime (`DOC03:97`). No deletion gates on an undefined system. |
| LEGV-G-010 | **GST** and **Consent (DPDP)** winners gate **nothing** (informational) | `DOC03:92` (GST), `DOC03:80` (Consent) | Two `CANONICAL (build)` winners have "Deletion Plan: None (build). No loser." — correct (they are greenfield, no predecessor). Flagged only to confirm the *inverse* check passed: these are legitimately winners-that-gate-nothing, not orphans. **No action** beyond noting the audit verified them. |

### 2.7 Ordering-violation (delete scheduled before its replacement is live)

| Gap ID | Item | path:line | Finding |
|---|---|---|---|
| — | (none) | `DOC04:220-311`; `ROADMAP:368-410` | **PASS.** The ordering law is airtight: W0 deploy-unblock first (`DOC04:225-233`); W1 money deletions gate on "A3 canonical ledger + PA-split rail LIVE & smoked" (`DOC04:269-270`); W2c auth deletions gate on "A1 identity-platform sole issuer LIVE" (`DOC04:258-259`); W4 theme deletions gate on "A5 Liquid at parity LIVE" (`DOC04:287-288`); LEG-044 React renderer delete is explicitly deferred to a **W6 data-driven** decision (`DOC04:307-310`). No item deletes before its winner's go-live wave. |
| LEGV-G-011 (latent) | LEG-053 `sessions_v2` drop wave ambiguity | `DOC04:181` (col "Wave" = **`W2c/W5`**); `SAFE_DELETION_PLAN.md:366` (Wave = **`W2c/W5`**) | Not an ordering *violation* but an **under-specified order**: LEG-053's wave is written as the disjunction "W2c/W5". Its true gate (DEL-025 removes the identity-foundation boundary) fixes it to *after* W2c, but the dual-wave label leaves a scheduler free to place the `DROP TABLE sessions_v2` in either wave. Minor; tighten to "W2c (after DEL-025); DDL may batch into W5." |

### 2.8 Missing-coverage (DEAD/LEGACY systems named by the forensic/canonicalization work with NO LEG row)

| Gap ID | Loser (named in DOC 03 §2 "Replaces/kills") | path:line | Why it is a coverage gap |
|---|---|---|---|
| LEGV-G-007 *(table-anchor)* | **client-only React cart** (`cart-context.tsx`, `stock:999`) | `DOC03:88` | Named as the loser for the Cart winner; **Trace column carries no `LEG-` ID**; absent from the 78-row register and from `SAFE_DELETION_PLAN.md`. |
| LEGV-G-008 *(table-anchor)* | **direct-`available`-decrement side doors; order-edit add-item-without-reservation** | `DOC03:89` | Named as the loser for Inventory; no `LEG-` ID in Trace; no DEL block. |
| LEGV-G-003 *(table-anchor)* | **scalar single-code discount RPC** | `DOC03:90` | Named as the loser for Discounts; no `LEG-` ID; no DEL block. |
| LEGV-G-006 *(table-anchor)* | **scaffold/mock label generators** | `DOC03:91` | Named as the loser for Shipping; no `LEG-` ID; no DEL block. |
| LEGV-G-011 | **`AdminShell` / `Sidebar` / `HeaderBar` shell fork + per-app `--lb-*` redefs** | `DOC03:98`, `DOC03:259`, `DOC03:269` | DOC 03 §3 dispositions it as "LEGACY (Wave 4-5)" in prose but it has **no LEG row, no DEL block, no gate, no rollback** — the only design-system *code fork* with a fate but no operative deletion record. (LEG-030 covers the 4 session libs; nothing covers the 8 shells / `AdminShell` fork.) |
| LEGV-G-012 | **3 token sources → 1; 4 mobile color classes; 8 hand-rolled shells; the drift-baselining ratchet** | `DOC03:106`, `DOC03:269` | DOC 03 row 35 (Design System) names these losers; dispositioned only as prose "(Wave 4-5, ratchet-down)". The **duplicate `LetbuyyColorTokens`** is partly captured by LEG (mobile, `DOC03:99`) but the *web-side* token-source collapse + the 8 shells have **no LEG row / gate / rollback**. |

> **Coverage note (what IS covered — for contrast):** the heavyweight forensic DEAD/LEGACY set is fully represented: ~28.7k LOC CQRS/saga cluster (LEG-001…006), `legacy/firebase` ~15.3k LOC (LEG-071), ~36 theater validators (LEG-063), ~120/60+ governance + root docs (LEG-074/075), 4 parallel auth impls (LEG-024…030), the un-ledgered money paths + 4 compat ledgers + razorpayx + 3% rake (LEG-031…043/054), dual schemas (LEG-051…056), the theme forks (LEG-044…050). The coverage gap is **narrow and specific**: it is the *small, code-level commerce/design losers* that DOC 03 named in prose but that never graduated into the gated register.

### 2.9 In-place S0 fixes acknowledged as non-LEG (audited — correctly handled, listed for completeness)

| Item | path:line | Disposition status |
|---|---|---|
| 6 `USING(true)`→PUBLIC RLS policies; anon `super_admin_allowlist`; `user_metadata.role` channel; `MOCK_JWKS`; `AUTH_SECRET` fallback; `gift_cards.balance` precision dup; `emitDomainEvent` swallow; `compensation_actions` zero-executor | `DOC04:216` (footnote), `DOC04:230` | **CORRECTLY handled, no gap.** DOC 04's §2 footnote explicitly states these are **replace-in-place invariant fixes, not removable artifacts**, tracked in DOC 03 §3 + the forensic register (ISSUE-003…009, AUTH-004, IDN-029, PAY-007/023/026) and sequenced into Waves 0–1. They are not "undisposed" — they are dispositioned as *fixes*, which is the right category. Verified against ART-24 (`CONSTITUTION:301-305`) and SEC-R6/R8 (`AGENTS_V2:232,234`). |

---

## 3. Legacy Elimination Gap Findings (the register)

> **Severity rubric:** **CRITICAL** = an undisposed/undetermined system, a delete-before-winner, or no validation gate on a money/auth deletion. **MAJOR** = a named loser with no gate/wave/rollback (coverage gap on a live path), or a winner with no operationalized migration. **MINOR** = under-specified order/wave, presentational ambiguity, or a demoted-to-seam loser missing only a validate step.
> **EXACT FIX = the precise governance addition.** No deletion decision is changed; only the disposition is *completed*.

| ID | Severity | System (LEG-ID) | Doc + path:line | Gap | EXACT FIX |
|---|---|---|---|---|---|
| **LEGV-G-001** | **CRITICAL** | LEG-022 `platform-console` | `DOC04:129`; ART-24 `CONSTITUTION:302` | Fate is the two-valued **"KEEP (if survivor) / MIGRATE-then-DELETE (if not)"**; the survivor decision is UNVERIFIED and **no gate forces it**. A deployed prod app has no settled fate. | Add **GATE-OPS-SURVIVOR** as a hard predecessor of W3: *"Before any W3 ops-console work, the ARB MUST record (owner: ARB chair; deadline: W3 entry) the single survivor in DOC 04 §2; until recorded, both LEG-022 and LEG-023 are frozen-no-delete."* Then **resolve LEG-022's fate to a single value** in the row (KEEP **or** MIGRATE-then-DELETE) once recorded. The decision must not be discoverable only as a tentative parenthetical. |
| **LEGV-G-002** | **CRITICAL** | LEG-023 `platform-operations-portal` | `DOC04:130` | Fate "MIGRATE-then-DELETE (if not survivor)" is conditional on the unforced LEG-022 decision; if the ARB never chooses, **both apps persist** and neither deletion gate is ever satisfiable. | Bind LEG-023's fate to GATE-OPS-SURVIVOR (LEGV-G-001): once the survivor is recorded, set the **non-survivor** to a single `MIGRATE-then-DELETE` and the **survivor** to `KEEP`. Add to the gate: *"exactly one of {LEG-022, LEG-023} resolves to KEEP; the other to MIGRATE-then-DELETE; a validator asserts the prod deploy matrix contains exactly one ops console post-W3."* |
| **LEGV-G-007** | **MAJOR** | (no LEG-ID) client React cart | `DOC03:88` | Loser named in DOC 03 §2; **no LEG row, no DEL block, no validation gate, no rollback**; lives only as prose "→ thin view (Wave 3)". | **Add LEG-079 / DEL-079:** verdict `MIGRATE-then-DELETE`; replaced-by = server-authoritative cart (DOC 03 #17); gate = server cart LIVE + cart-bound signed handoff (P8 W-19) live; wave W3; validate = V-IMPORT(client-cart write callers→0) → V-SMOKE(buyer add-to-cart via server cart) → V-BUILD → V-TEST; rollback = `git revert` (re-enable client cart view). |
| **LEGV-G-008** | **MAJOR** | (no LEG-ID) inventory side-doors | `DOC03:89` | Direct-`available`-decrement side doors + order-edit add-item-without-reservation named as losers; **no gate** — and because this is a checkout-path oversell control it belongs in the heaviest-gated bucket (`TEST-R2`). | **Add LEG-080 / DEL-080:** verdict `MIGRATE-then-DELETE`; replaced-by = single reserve→commit path (DOC 03 #18); gate = reserve→commit on the live path + sweeper scheduled (P8 W-21); wave W3; validate = V-IMPORT(direct-decrement callers→0) → **V-SMOKE(oversell closed under `FOR UPDATE`)** → V-TEST(concurrency suite) ; rollback = `git revert`. Tag FULL-9-class per `TEST-R2`. |
| **LEGV-G-003** | **MAJOR** | (no LEG-ID) scalar discount RPC | `DOC03:90,210-213` | Winner ("typed `combines_with` engine, ACTIVATE") names the migration but the loser scalar RPC has **no LEG row / gate / wave / rollback**. | **Add LEG-081 / DEL-081:** verdict `MIGRATE-then-DELETE` (TRANSITIONAL→LEGACY); replaced-by = typed discount engine (DOC 03 #19); gate = typed engine ACTIVATED on the live checkout; wave W3; validate = V-IMPORT(scalar-RPC callers→0) → V-SMOKE(a multi-code discount applies) → V-TEST → V-ROLLBACK(paired DOWN if the RPC is dropped). |
| **LEGV-G-011** | **MAJOR** | (no LEG-ID) `AdminShell`/`Sidebar`/`HeaderBar` fork | `DOC03:98,259,269` | The design-system **shell code fork** + per-app `--lb-*` redefs are dispositioned as prose "LEGACY (Wave 4-5)" with **no LEG row / DEL block / gate / rollback** — the only DS code fork without an operative deletion record. | **Add LEG-082 / DEL-082:** verdict `MIGRATE-then-DELETE`; replaced-by = `AppNavigation` shell + `@letbuyy/ui` (DOC 03 #27/#35); gate = `AppNavigation` adopted on the app being de-forked (rolling 2/9→9/9); wave W4-5; validate = V-IMPORT(fork-shell imports→0 per app) → V-SMOKE(app navigation works) → V-BUILD → V-TEST; rollback = `git revert` per app. (Per-app, so a regressed app reverts independently.) |
| **LEGV-G-012** | **MAJOR** | (partial LEG-ID) web token-source collapse + 8 shells | `DOC03:106,269` | DOC 03 #35 names "3 token sources → 1" and "8 hand-rolled shells"; only the **mobile** color-class fork is LEG-tracked (via DOC 03 #28). The **web-side token-source collapse** and the **8-shell consolidation** have no LEG row / gate. | **Extend coverage:** either fold into LEG-082 (shells) + a new **LEG-083 / DEL-083** for the web token-source collapse (verdict `MIGRATE-then-DELETE`; replaced-by = single DTCG `tokens.ts`; gate = generated bridge live + stylelint ratchet in CI; wave W4-5; validate = V-IMPORT(non-canonical token-source imports→0) → V-BUILD → CI-ratchet green; rollback = `git revert`). |
| **LEGV-G-004** | **MINOR** | (no LEG-ID) client cart (rollback dimension) | `DOC03:200-203` | Sub-dimension of LEGV-G-007: the *rollback* for "demote client cart to a view" on the live buyer path is specifically undocumented. | Covered by the LEG-079 rollback field (LEGV-G-007 fix); no separate action if LEG-079 is added with its `git revert` rollback. Listed to ensure the rollback dimension is not dropped. |
| **LEGV-G-006** | **MINOR** | (no LEG-ID) mock label generators | `DOC03:91,215-218` | Loser is *demoted to an adapter mock*, not deleted; still it has no validate step for the demotion. Lower severity because nothing is removed — the mock becomes the seam. | Add a one-line note to the Shipping deletion plan (or a thin LEG-084): verdict = `MIGRATE` (demote-to-seam, not delete); gate = Shiprocket adapter live; validate = V-SMOKE(real carrier path serves; mock remains behind the adapter). No deletion, so no rollback beyond `git revert`. |
| **LEGV-G-010** | **MINOR** | LEG-053 `sessions_v2` (wave) | `DOC04:181`; `SAFE_DELETION_PLAN.md:366` | Wave label is the disjunction **"W2c/W5"**, leaving the `DROP TABLE` schedulable in either wave. | Tighten the wave to **"W2c (gated on DEL-025 removing the identity-foundation boundary); the DDL DROP may batch into W5 with the other table drops."** No decision change — just remove the ambiguity. |
| **LEGV-G-013** | **MINOR** | LEG-058 migration `129` | `DOC04:185`; `SAFE_DELETION_PLAN.md:584-591` | Gate "confirm both already applied live (UNVERIFIED)" has no owner/forcing step; if unverified at W5, the renumber could corrupt migration lineage. | Add to DEL-058: *"BLOCK the renumber until `supabase migration list` (live) confirms both `129_*` applied; owner: DB-owning engineer; if not applied live, encode an explicit ordering record instead of renaming."* (The substance is already in the UNVERIFIED list `DOC04:372` — promote it into the gate.) |
| **LEGV-G-014** | **MINOR** | LEG-071 `legacy/firebase` (git-tracked) | `DOC04:208`; `LEGACY_ERADICATION_REGISTER.md:235` | ARCHIVE gate names "confirm git-tracked (UNVERIFIED — `git ls-files legacy/`)" but does not make the `git mv` *block* on that proof. | Add to DEL-071: *"`git mv` MUST NOT proceed until `git ls-files legacy/` (from the macOS repo root) returns the 37 tracked files; if `legacy/` is untracked, `git add` then archive so history is captured."* (Promotes the UNVERIFIED caveat into a hard pre-archive gate.) |
| **LEGV-G-015** | **MINOR** | LEG-061 / LEG-050 table drops | `DOC04:188,173`; `SAFE_DELETION_PLAN.md:614,542` | The `pg_stat_user_tables` zero-writer proof is named in the gate but DEL-R5 (`AGENTS_V2:174`) makes it law; the gate does not name an **owner** for the live-DB probe, so it can be skipped under deploy pressure. | Add to DEL-061/DEL-050: *"owner = DB-owning engineer; the `pg_stat_user_tables` write-count proof (window ≥30d) is a merge-blocking artifact attached to the drop PR; no DROP merges without it."* (Substance exists; this adds the accountable owner + the blocking artifact.) |
| **LEGV-G-016** | **MINOR** | DEL-069 remainder | `DOC04:256`; `SAFE_DELETION_PLAN.md:100-107` | Wave ordering step 21 references **"LEG-069 (remainder)"** but only `DEL-069a` has a block; the non-`a` remainder of LEG-069 (the broader secret migration) has no distinct gated block. | Add **DEL-069b** (or extend DEL-069a): *"after the W0 secret-shaped-vars move, complete the remaining `SKIP_NEEDS_HUMAN` plaintext→`wrangler secret` migration; validate = preflight green + V-SMOKE(consuming routes resolve secrets); wave W2b."* |
| **LEGV-G-017** | **MINOR** | LEG-007 `search-core` ordering | `DOC04:98`; `SAFE_DELETION_PLAN.md:271` | DEL-007's V-IMPORT→0 depends on **DEL-002** also removing `application-services` (a second importer), but DEL-007 sits in W2b while DEL-002 is W2a — the cross-wave dependency is correct but stated only in prose, not as a hard "after DEL-002" gate field. | Add to DEL-007 Dependencies (already partially present): make explicit *"HARD: DEL-002 merged first (it is `search-core`'s second importer); V-IMPORT(search-core) is only valid after both the `api-types` `export *` fix AND DEL-002."* |
| **LEGV-G-018** | **MINOR** | LEG-044 React renderer (the C3 guardrail — confirm, not fix) | `DOC04:167,310`; `CONSTITUTION:301` | Audited the directive's deliberate test: LEG-044 is `KEEP-FROZEN`, the delete decision deferred to a W6 data-driven fork. **No gap** — this is *correct by design*. Flagged only to certify the audit confirmed the C3-protected loser is **not** deleted early and is the one place a "loser with a live winner" is correctly NOT auto-deletable. | **No fix.** Confirms ART-24 + R-DEL-6 (`DOC04:331-332`) are honored. Recorded so the report's "every loser dispositioned" claim explicitly accounts for the one intentionally-deferred fate. |

---

## 4. What the audit confirmed is COMPLETE (the strengths, so the gaps are not over-read)

- **The validation-gate taxonomy is constitutional and exhaustive** for every LEG row: six gates (V-IMPORT/V-BUILD/V-TEST/V-GOV/V-SMOKE/V-ROLLBACK), a per-verdict gate matrix (`DOC04:49-54`), and the inviolable Rule X "nothing deleted until validation is green" (`DOC04:15-17`), restated as ART-24 (`CONSTITUTION:301-305`), R-23 (`CONSTITUTION:424`), and AGENTS_V2 DEL-R1…R6 (`AGENTS_V2:166-176`).
- **Rollback is a precondition, not an afterthought:** R-DEL-3 (no bare DROP; paired DOWN), R-DEL-8 (isolated revertible commits), and the program *fixes its own rollback debt first* (LEG-059/060 author the 3 missing migration rollbacks + the 151/160 `DROP COLUMN` residue as a Wave-5 precondition, `DOC04:296`).
- **The validator-liveness loop is handled** (R-DEL-4 / DEL-R3): the asserting validators (LEG-063) and manifest prose (LEG-064) are cut in the **same change set** as the dead packages they assert, preventing the CI deadlock (`DOC04:325-326`, `AGENTS_V2:172`).
- **Money/auth deletions are the most-gated:** W1 money paths gate on the canonical ledger LIVE + the reconciliation harness proving zero drift, with a deploy+revert of the *winner* before the legacy path is touched (`DOC04:334-335`).
- **The C3-protected case is correctly NOT deleted early** (React renderer, LEG-044/048 — `DOC04:167,171,331`).
- **Every DEAD-now S0 that is not a removable file is correctly categorized as a replace-in-place fix**, not left undisposed (`DOC04:216`).

---

## 5. The single most dangerous gap

**LEGV-G-001 / LEGV-G-002 — the ops-console survivor is a conditional fate that no gate ever forces to a decision.**

This is the worst gap because it is the only place where the governance **defines a system without deciding its fate** and then provides **no forcing function**. LEG-022's verdict is literally `KEEP (if survivor) / MIGRATE-then-DELETE (if not)` (`DOC04:129`); LEG-023's is `MIGRATE-then-DELETE (if not survivor)` (`DOC04:130`). The disambiguator — "ARB picks the survivor" — is stamped **UNVERIFIED** in three places (`DOC04:129,284,368`; `CONSTITUTION:302`; `DOC03:473`) and is never attached to a gate with an owner or a deadline.

Why it is dangerous, not cosmetic: ART-24 exists to end the "two of everything" maintenance tax, and these are **two deployed production apps** (`production-deploy.yml:367-370`). If the decision is silently deferred — the default outcome when no gate forces it — **both apps persist indefinitely**, which is the exact C1 failure the entire program targets, *and* neither app's deletion gate ("sliver lands in survivor") can ever be satisfied because no survivor is named. A conditional fate with no decision-forcing mechanism is functionally **no fate**. Every other loser in the 78-row register has a single, decided verdict; this one does not, and it is the one a busy ARB is most likely to leave unresolved.

**Fix (governance only, no decision pre-empted):** add **GATE-OPS-SURVIVOR** as a hard W3 predecessor — *the ARB MUST record one survivor (owner + deadline) in DOC 04 §2 before any W3 ops-console work; until recorded, both rows are frozen-no-delete; once recorded, exactly one resolves to KEEP and the other to MIGRATE-then-DELETE; a validator asserts the post-W3 prod matrix contains exactly one ops console.* This forces the choice without making it.

---

## 6. Anything undetermined (carried forward, not silently resolved)

These are UNVERIFIED gates the plan itself flags; this audit **does not** resolve them and recommends each become an *owned, blocking* gate (see the MINOR findings):

1. **The ops-console survivor** (LEG-022/023) — an ARB decision, not a code fact (`DOC04:368`, `DOC03:473`). **The central undetermined item** (LEGV-G-001/002).
2. **`legacy/` git-tracked status** — `git ls-files legacy/` returned empty from the Linux mount; 37 tracked files reported at the real macOS repo (`DOC04:366`, `LEGACY_ERADICATION_REGISTER.md:235`). Promote to a hard pre-ARCHIVE gate (LEGV-G-014).
3. **Live-DB writers for the ~37 product-dead + 6 theme tables** (LEG-061/050) — cannot be confirmed code-only; `pg_stat_user_tables` proof required before any DROP (`DOC04:367`). Promote to an owned, merge-blocking artifact (LEGV-G-015).
4. **The 6 anon RLS GRANTs** — set by Supabase's managed bootstrap, not repo SQL; need an anon-key / `\dp public.orders` probe before final S0 sign-off (`DOC04:370`). (Tracked as a fix, not a deletion — no LEG gap, but the probe is undischarged.)
5. **`pnpm turbo build` green baseline** — assumed by the W2a dead-package deletions; not executed (`DOC04:371`). The W2a gate-to-enter ("`pnpm turbo build` green baseline", `DOC04:235`) already names it; confirm it is run before W2a.
6. **Migration `129` live-apply status** (LEG-058) — confirm both applied before renumbering (`DOC04:372`). Promote to a blocking gate (LEGV-G-013).
7. **GraphQL / extensions / Liquid actual prod execution** (LEG-010/011/044) — flags are `false` in prod config but no prod probe confirms zero live clients (`DOC04:369`). Confirm before DEL-010/011.

**Net:** the 78-row register is gated, rollback-safe, and correctly ordered. To make the program's claim *"every loser is dispositioned, gated, and reversible"* literally true, it needs **(a) GATE-OPS-SURVIVOR** (force the one conditional fate) and **(b) ~5 new LEG rows (LEG-079…083)** that promote the DOC-03-prose-only commerce/design losers into the gated register. No deletion decision changes; the dispositions are merely *completed*.

---

*End of LEGACY_ELIMINATION_GAP_REPORT.md — Phase 4, Governance Hardening. Audits completeness only; changes no deletion decision. 18 findings (2 CRITICAL, 5 MAJOR, 11 MINOR). Subject corpus: `GOVERNANCE_REWRITE_2026_06_10/` DOC 03/04/05 + Constitution + AGENTS_V2; source layer `STRATEGIC_CANONICALIZATION_2026_06_10/` SAFE_DELETION_PLAN + LEGACY_ERADICATION_REGISTER. Evidence pinned at `stepup/main` @ `c4fc3cd6`, 2026-06-10.*
