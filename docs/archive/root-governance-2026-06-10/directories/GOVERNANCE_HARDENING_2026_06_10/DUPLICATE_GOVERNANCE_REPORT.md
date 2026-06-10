# DUPLICATE GOVERNANCE DETECTION — THE SINGLE-SOURCE-OF-TRUTH AUDIT (PHASE 3)

> **Document type:** ARB governance-hardening audit. Hunts **duplicate governance** across the 7-doc stack — the same rule, decision, or list stated in more than one document — and decides, for each duplicated rule, **where it should live once** (single source of truth) and **where the others should merely reference it.**
> **Program:** Governance Hardening 2026 · Architecture Review Board (ARB) · **Phase 3 of the hardening pass.**
> **Date:** 2026-06-10 · **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · evidence pinned at `stepup/main` @ `5cf9e64e`.
> **Scope:** the 7 documents under `GOVERNANCE_REWRITE_2026_06_10/`: `000_GOVERNANCE_INDEX.md`, `LETBUYY_CONSTITUTION.md`, `LETBUYY_AGENTS_V2.md`, `LETBUYY_CANONICAL_SYSTEMS.md`, `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md`, `LETBUYY_FOUNDATION_ROADMAP.md`, `LETBUYY_UI_UX_GOVERNANCE.md`. (The `LETBUYY_FINAL_ARCHITECTURE_SCORECARD.md` reference doc is out of the named 7 but is flagged where it participates in a cluster — see §6 Undetermined.)
> **Status:** AUTHORITATIVE finding set. **No repo doc was modified.** This is one new report; every fix is a de-duplication / cross-reference instruction, never a rule change.

---

## 0. Methodology

**The governance design intent (from `000_GOVERNANCE_INDEX.md:8-15` and `LETBUYY_CONSTITUTION.md` §P.3):** a single chain of authority where each document owns a distinct *layer* of the same decision:

- **Constitution (DOC 01)** holds the **permanent principle + the Article + the testable Constitutional Rule** (the *law*).
- **AGENTS_V2 (DOC 02)** holds the **operative, citable, validator-named rule** an agent runs (the *enforcement*).
- **Canonical Systems (DOC 03)** holds the **winner per domain** (the *answer to "which system"*).
- **Legacy Plan (DOC 04)** holds the **loser, gate, and deletion order** (the *how/when to remove*).
- **Roadmap (DOC 05)** holds the **phase/wave sequencing** (the *when to build*).
- **UI/UX (DOC 06)** holds the **design-surface rule** (domain governance).

**What is acceptable vs what is a bug.** A **layered restatement** — Constitution = principle, AGENTS_V2 = enforceable rule, DOC 03 = winner — is the *designed* shape and is acceptable **only** when the restatements are (a) identical in substance and (b) explicitly cross-referenced back to the canonical home. The audit flags as a **defect** any case where:
- **(a) the same rule carries different wording, thresholds, scope, or numbers** across docs (latent contradiction that will drift apart on the next edit);
- **(b) a rule is fully *re-derived* (re-stated as primary, not "per ART-XX") in 3+ places**, so a future edit updates one and silently strands the others;
- **(c) the same list** (the never-build list, the 8 runtimes, the winner set, the UNVERIFIED register) is **maintained in parallel** in multiple docs instead of one canonical list the others cite.

**Method.** Every one of the 7 docs was read in full. Cross-cutting rule families (money/never-custody/0%-fee; tenancy RLS+GUC; identity sole-issuer; Liquid-winner; one-system-per-domain; never-build list; 8-runtime topology; scale envelope; deletion gates; honesty badge; authority chain; canonical-architecture one-liner; UNVERIFIED register) were located by `grep` to exact `path:line` and clustered. For each cluster: every location is listed, judged **IDENTICAL (safe)** or **DIVERGENT (bug)**, assigned a **single canonical home**, and given the exact instances that should become a reference vs stay as the source.

**The governing principle of every fix:** the goal is **single-source-of-truth, not deletion of rules.** No rule is weakened or removed. Duplicates are collapsed to *one definition + N cross-references*. No architecture changes.

---

## 1. Executive verdict

**18 duplicate clusters** were found across the 7-doc stack. They split:

- **5 CRITICAL — divergent duplication that can drift into contradiction.** A rule (or list) is independently re-defined in ≥2 docs with **different numbers, scope, or membership**, so the next edit to one will silently contradict the others. These are genuine single-source-of-truth defects, not cosmetic.
- **6 MAJOR — parallel-maintained lists / multi-place re-derivation.** The same enumerated set (never-build, 8 runtimes, UNVERIFIED, winner set, deletion-gate taxonomy, authority chain) is **maintained in full in multiple docs** rather than owned once and cited — benign *today* (the copies happen to agree) but structurally guaranteed to drift.
- **7 MINOR — benign layered restatement to annotate.** The designed Constitution→AGENTS_V2→DOC 03 restatement, correct in substance but **missing the explicit "per ART-XX" back-reference** that makes it safe. The fix is a one-line citation, not a content change.

**The headline:** the stack is in good shape — **most duplication is the *intended* layered restatement and the copies currently agree.** The danger is that **almost none of the cross-references point "up" to a single owning clause.** AGENTS_V2 rules cite *ADRs* (the evidence base, authority rank 6) instead of the *Constitution Article* (authority rank 1) that now owns the decision; DOC 03/04/05 re-state the envelope and never-build list from `_GOVERNANCE_SPINE.md` (an evidence-base doc that the Constitution explicitly outranks) rather than from the Constitution. So the documents are consistent **by careful authoring, not by structural single-source** — exactly the fragility this stack was built to end. The most dangerous concrete divergence is the **scale-envelope throughput number and the canonical-architecture one-liner**, which already differ in detail between docs (see DUP-G-001 / DUP-G-002).

**One numeric drift already exists** (not just a latent risk): the **8-runtime topology is described as "8 runtimes" in AGENTS_V2 but enumerated as a 4-satellite / 5-process / "4 apps + 4 workers" set in three different shorthands** across the Constitution, AGENTS_V2, and DOC 03, with the ops console sometimes inside and sometimes outside the count (DUP-G-003).

---

## 2. The duplicate-cluster table

> **Legend.** **Verdict:** IDENTICAL = safe restatement (annotate) · DIVERGENT = wording/number/scope differs (fix). **Canonical home** = where the rule should live once. **Action** = collapse the others to a reference.

| # | Topic | Locations (`path:line`) | Verdict | Canonical home | Action |
|---|---|---|---|---|---|
| **DUP-G-001** | Scale envelope (100→10k; never 100k+/1M+; ~30k orders/mo) | CONST §6 `:104-112`, R-17 `:416`; AGENTS_V2 `ENV-R1/R2` `:52-53`, PRIME-R2 `:46`; DOC 03 §0.3 `:34-36`; UI/UX `:27`; INDEX `:22` | **DIVERGENT** (throughput phrasing + "India-only" placement differ; all re-derive) | **CONST §6** | AGENTS_V2/DOC 03/UI-UX cite "per CONST §6"; drop the independently-worded `~30k orders` restatements or pin them verbatim to §6 |
| **DUP-G-002** | The canonical-architecture one-sentence | INDEX `:22`; CONST §3/§15 `:71`,`:467`; AGENTS_V2 §1 hdr `:60`, ARCH-R1 `:64-79`; DOC 03 §4 `:321`,`:407-413` | **DIVERGENT** (each "one sentence" lists a slightly different satellite/feature subset) | **CONST §15 Sign-off** (the canonical sentence) | All others quote CONST §15 verbatim or cite "per CONST §15"; stop paraphrasing |
| **DUP-G-003** | The 8-runtime topology (the enumerated set) | CONST ART-04 `:165-169`; AGENTS_V2 ARCH-R1 `:64-79`, DEPLOY-R2 `:331`, App-A `:388`; DOC 03 #1 `:72`, Deployment `:295`, §4 diagram `:321-371` | **DIVERGENT** ("8 runtimes" vs "4 apps+4 workers" vs "4 satellites"; ops console in/out of count) | **AGENTS_V2 ARCH-R1** (the one enumerated table) | CONST ART-04 + DOC 03 #1 cite "the 8 runtimes per AGENTS_V2 ARCH-R1"; one table, one count |
| **DUP-G-004** | Never-build list (the enumerated 13) | CONST §10 `:309-327` (numbered 1-13); AGENTS_V2 `NEVER-R1…R7` `:183-189`; DOC 03 §5 table `:417-437` | **DIVERGENT** (CONST=13 items, AGENTS_V2 groups into 7 rules, DOC 03=13-row table with reopen triggers; membership maps but is maintained 3×) | **CONST §10** | AGENTS_V2 `NEVER-*` + DOC 03 §5 declare "this enumerates CONST §10; on any difference §10 governs"; reopen-triggers live once |
| **DUP-G-005** | 0% transaction fee / `commission_bps=0` / kill 3% rake | CONST ART-12 `:219-223`, R-9 `:402`, Non-Goal#6 `:125`; AGENTS_V2 `PAY-R3` `:247`, `NEVER-R5` `:187`; DOC 03 #32 `:103`, Billing `:183-186`; DOC 04 LEG-042 `:159`; ROADMAP P3 `:330`,`:345` | **IDENTICAL** (consistent) | **CONST ART-12** | AGENTS_V2 PAY-R3 / DOC 03 Billing read "per ART-12"; DOC 04/ROADMAP keep (they own the *deletion*/*phase*, not the rule) |
| **DUP-G-006** | Never-custody / PA-split / merchant-of-record / razorpayx-dead | CONST Phil §3.2 `:72`, Comm §4.2-4.3 `:85-86`, ART-11 `:213-217`, R-7 `:400`, Non-Goal#1 `:120`; AGENTS_V2 `PAY-R4` `:248`, `NEVER-R2` `:184`; DOC 03 #13 `:84`, Settlement `:173-176`, diagram `:410`; DOC 04 LEG-039 `:156`; ROADMAP P3 `:329`,`:343` | **IDENTICAL** (consistent) | **CONST ART-11** | AGENTS_V2 PAY-R4 / DOC 03 Settlement read "per ART-11"; DOC 04/ROADMAP keep |
| **DUP-G-007** | Tenancy: RLS ENABLE+FORCE + per-tx GUC, off `service_role`, fail-closed | CONST Phil §3.5 `:75`, ART-08 `:193-197`, R-1/R-2/R-4 `:392-395`; AGENTS_V2 `SEC-R1` `:224`, `SEC-R9` `:235`, `IDN-R5` `:266`, `ANTI-R5` `:318`; DOC 03 #10 `:81`, Tenant-Isolation `:156-159`; ROADMAP P2 `:291-318` | **IDENTICAL** (consistent) | **CONST ART-08** | AGENTS_V2 SEC-R9 / DOC 03 Tenant-Isolation read "per ART-08"; ROADMAP keeps (phase) |
| **DUP-G-008** | Anon RLS-to-PUBLIC `USING(true)` leaks die first | CONST ART-09 `:199-203`, R-3 `:394`; AGENTS_V2 `SEC-R6` `:232`, `SEC-R8` `:234`; DOC 03 #10/#22 `:81`,`:93`,`:226-228`; DOC 04 `:230`; ROADMAP P2 `:297`,`:310` | **IDENTICAL** (consistent) | **CONST ART-09** | AGENTS_V2 SEC-R6 / DOC 03 read "per ART-09"; DOC 04/ROADMAP keep |
| **DUP-G-009** | Identity-platform = sole asymmetric issuer; others verify-only; no shared HS256 | CONST ART-05 `:173-177`, R-14 `:411`; AGENTS_V2 `IDN-R1/R2` `:262-263`, `SEC-R7` `:233`, `WIN-R3` `:141`; DOC 03 #3 `:74`, Identity `:119-122`; ROADMAP P4 `:355-379` | **IDENTICAL** (consistent) | **CONST ART-05** | AGENTS_V2 IDN-R1/R2 / DOC 03 Identity read "per ART-05"; ROADMAP keeps |
| **DUP-G-010** | Canonical double-entry ledger = sole money truth; balance derived; bigint paise; append-only | CONST ART-10 `:207-211`, ART-13 `:225-229`, R-5/R-6/R-8 `:398-401`; AGENTS_V2 `PAY-R1` `:245`, `PAY-R5/R6` `:249-250`, `ANTI-R4` `:317`, `MIG-R6` `:160`; DOC 03 #12 `:83`, Ledger `:163-166`; ROADMAP P3 `:327`,`:341` | **IDENTICAL** (consistent) | **CONST ART-10 (+ART-13 for bigint)** | AGENTS_V2 PAY-R1/R5 / DOC 03 Ledger read "per ART-10/ART-13" |
| **DUP-G-011** | Liquid is the canonical renderer (over more-complete React); React FROZEN not deleted | CONST Comm §4.7 `:90`, ART-17 `:253-257`; AGENTS_V2 `THEME-R1` `:275`, `WIN-R3` `:140`; DOC 03 #23 `:94`, Theme-Runtime `:232-235`, Rule C2/C3 `:54-61`; DOC 04 LEG-044 `:167`; ROADMAP P6 `:422` | **IDENTICAL** (consistent) | **CONST ART-17** | AGENTS_V2 THEME-R1 / DOC 03 Theme-Runtime read "per ART-17" |
| **DUP-G-012** | One-system-per-domain / single-source-of-truth / "two of everything" is a defect | CONST Phil §3.6 `:76`, R-15 `:414`; AGENTS_V2 `WIN-R4/R5` `:146-147`, `ANTI-R1` `:314`; DOC 03 Rule C1 `:44-50`; DOC 04 §0 `:11`; ROADMAP `:420` | **DIVERGENT** (the "one X per domain" enumerated parenthetical lists a *different set of Xs* in CONST R-15 vs AGENTS_V2 ANTI-R1) | **CONST R-15** | AGENTS_V2 ANTI-R1 / DOC 03 C1 cite "per CONST R-15"; the enumerated `(one ledger, one renderer, …)` list lives once in R-15 |
| **DUP-G-013** | Provider-mode honesty badge; "a stub must never read as success" | CONST Phil §3.3 `:73`, ART-20 `:275-279`, R-22 `:423`; AGENTS_V2 `PAY-R10` `:254`, `UI-R6` `:293`, `ANTI-R9` `:322`, `AGENT-R9` `:354`; DOC 03 #27/#35 `:98`,`:106`,`:257`; UI/UX §4.10 `:285-287`, UX-R4 `:460`, UX-R33 `:489`; ROADMAP P7 `:447` | **DIVERGENT** (mode triad differs: CONST/AGENTS_V2 say `mock/sandbox/live`; UI/UX says `live/sandbox/scaffold`) | **CONST ART-20 / R-22** | UI/UX UX-R4 + AGENTS_V2 UI-R6 cite "per ART-20"; **reconcile the triad wording** (`mock` vs `scaffold`) — see §3 |
| **DUP-G-014** | The one-line never-build test ("imitates Shopify's end-state…") | CONST §10 `:327`; AGENTS_V2 `ENV-R3` `:54`, `NEVER-R7` `:189`; DOC 03 §5 `:437` | **IDENTICAL** (verbatim) | **CONST §10 `:327`** | AGENTS_V2 ENV-R3/NEVER-R7 + DOC 03 §5 cite "the one-line rule, CONST §10"; keep verbatim, drop independent provenance tags |
| **DUP-G-015** | Reserved services stay empty; never declared `production`; capability in monolith+workers | CONST ART-19 `:267-271`, R-16 `:415`, Non-Goal#10 `:129`; AGENTS_V2 `ARCH-R4/R5` `:86-87`, `NEVER-R6` `:188`, `ANTI-R7` `:320`; DOC 03 #29/#30/#34 `:100-105`; DOC 04 LEG-012…017 `:114-119` | **IDENTICAL** (consistent) | **CONST ART-19** | AGENTS_V2 ARCH-R4 / DOC 03 read "per ART-19"; DOC 04 keeps (it owns the per-service deletion rows) |
| **DUP-G-016** | Deploy meta-blocker is the keystone; branch-lag guard = 0 | CONST ART-03 `:159-163`, R-20 `:421`; AGENTS_V2 `DEPLOY-R1` `:330`, `ANTI-R11` `:324`; DOC 03 Deployment `:296-297`; DOC 04 Wave 0 `:79`,`:226-228`; ROADMAP P1 `:264-287` | **IDENTICAL** (consistent) | **CONST ART-03** | AGENTS_V2 DEPLOY-R1 reads "per ART-03"; DOC 04/ROADMAP keep (they own the order/phase) |
| **DUP-G-017** | The UNVERIFIED register (anon-GRANTs, ops-console survivor, dead-table writers, live-state) | CONST §14.4 `:453-459`; AGENTS_V2 App-B `:397-402`; DOC 03 §7.1 `:472-477`; DOC 04 §6.1 `:365-372`; ROADMAP §5 `:653-664`; INDEX `:60` | **DIVERGENT** (each doc keeps its **own** UNVERIFIED list; counts/items differ — ROADMAP has 11, DOC 03 has 5, CONST has 4) | **CONST §14.4** (the master) + one shared register | Subordinate docs cite "the UNVERIFIED register, CONST §14.4"; stop maintaining 5 parallel lists that already differ in length |
| **DUP-G-018** | The authority chain / 6-rank precedence ladder | INDEX `:8-15`,`:27-35`; CONST §P.3 `:30-41`; AGENTS_V2 `AUTH-CHAIN` `:26-41`; DOC 03 §0.1 `:15-26`; DOC 04 `:13`; ROADMAP `:6`; UI/UX §0 `:14` | **DIVERGENT** (each doc re-tabulates the full 6-rank ladder; the rank-4/5 grouping label differs between INDEX and CONST) | **CONST §P.3** | Every other doc shows only "its own rank + a pointer to CONST §P.3 for the full chain"; one ladder, six citations |

**Tally:** 18 clusters — **5 DIVERGENT/CRITICAL** (DUP-G-001, -002, -003, -012, -013), **6 MAJOR parallel-list** (DUP-G-004, -017, -018 + the structural re-derivation in -007/-009/-010 family where the cite points to ADR not Article), **7 MINOR benign-restatement-to-annotate** (DUP-G-005, -006, -008, -011, -014, -015, -016). (The money/tenancy/identity/ledger/Liquid clusters are content-identical; their defect is purely the *missing up-reference*, which is why they are MINOR not CRITICAL.)

---

## 3. Per-cluster detail — the DIVERGENT (dangerous) clusters

### DUP-G-001 — Scale envelope: the throughput number and "India-only" placement drift

The envelope is **re-derived in full in 5 places** and they are *not byte-identical*:
- **CONST §6 `:108`** (the constant): *"India-only. Design for 100 → 1,000 → 10,000 merchants. NEVER optimize for 100,000+ or 1,000,000+."* + `:110` *"approximately 30,000 orders per month."*
- **AGENTS_V2 `ENV-R1` `:52`:** *"100 → 1,000 → 10,000 **India** merchants only. India-only. ~30k orders/month."* (folds "India" into the merchant count; CONST keeps it as a separate lead clause).
- **DOC 03 §0.3 `:36`:** *"~30k orders/mo at the top of the envelope is trivial for one Postgres."*
- **UI/UX `:27`:** *"100 → 1,000 → 10,000 merchants … never for 100k+/1M+."* (drops the order figure).

**Why it is a bug.** Five independent prose copies of a *constitutional constant* guarantee that the next refinement (e.g. revising the order estimate, or adding a fourth tier) updates one and strands four. The number `~30k orders/mo` is already stated three different ways. **Canonical home: CONST §6.** All subordinate docs should cite "the scale envelope, CONST §6 (constitutional constant)" and **not restate the throughput figure independently** — or, if a restatement is wanted for readability, it must be a verbatim block-quote of §6, not a paraphrase.

### DUP-G-002 — The canonical-architecture "one sentence" is paraphrased, not quoted

The Index explicitly advertises this sentence as *"one sentence, identical across all docs"* (`INDEX:21`) — but it is in fact **paraphrased differently in each doc**:
- **INDEX `:22`** and **CONST §15 `:467`** and **AGENTS_V2 §1 header `:60`** and **DOC 03 §4 `:321`** each list the monolith + satellites + ledger + issuer + RLS + Liquid + checkout — but with **different satellite emphasis, different feature subsets, and different parenthetical detail** (e.g. only some mention "one design-system token source + app shell + honesty badge"; only some mention "ap-south").

**Why it is a bug.** The stack *claims* an identical canonical sentence and then maintains four divergent copies — the precise "identical-restatement-that-isn't" failure mode. **Canonical home: CONST §15 (the Sign-off sentence) is the most complete.** Make it the literal source; every other doc **block-quotes it verbatim** or cites "the canonical architecture, CONST §15." This is the cheapest high-value fix in the report: it converts a claimed-identical-but-actually-divergent sentence into a genuinely single-sourced one.

### DUP-G-003 — The 8-runtime topology: "8 runtimes" vs "4 apps + 4 workers" vs "4 satellites"

The same topology is **counted and grouped three different ways**:
- **CONST ART-04 `:166`:** "`api-gateway` (the modular monolith) + `queue-workers` + `mobile-bff` + `identity-platform` + `webhook-service`, plus the Next.js read/admin apps (`storefront-runtime`, `merchant-control-plane`, `marketing-site`) and **one** thin ops console" → reads as **monolith + 4 satellites + 3 Next apps + 1 console = 9 named roots** but is framed as "modular monolith + four satellites."
- **AGENTS_V2 ARCH-R1 `:64-79`:** an **explicit 8-row table** ("the 8 canonical runtimes") — and then `:79` adds the Flutter app + "one thin ops console" *as supporting surfaces outside the 8*.
- **DOC 03 #1 `:72`:** "Modular monolith `api-gateway` + 4 satellites" (no app count); **DOC 03 Deployment `:295`:** "the V1 8-runtime topology (4 apps + 4 workers + 6 reserved-empty)."

**Why it is a bug.** Three groupings — "4 satellites," "8 runtimes," "4 apps + 4 workers" — describe the same estate but **the ops console is sometimes inside the count and sometimes a supporting surface**, and the "8" reconciles to the named roots only if you place exactly the Next apps in and the console out. A reader cannot tell from CONST ART-04 whether the count is 8 or 9 (this is *literally* the 8-vs-9 ambiguity the rewrite exists to kill). **Canonical home: AGENTS_V2 ARCH-R1's enumerated 8-row table** (it is the only place that enumerates rather than prose-lists). CONST ART-04 and DOC 03 #1 should say "the canonical 8 runtimes per AGENTS_V2 ARCH-R1" and not re-list the members with a different grouping. **One table, one count, one decision on whether the console is the 8th-or-supporting.**

### DUP-G-012 — "one X per domain": the enumerated list of Xs differs between docs

- **CONST R-15 `:414`:** *"exactly one canonical system per domain (one ledger, one renderer-canonical, one auth issuer, one storefront runtime, one token source, one app shell, one ops console)."* — **7 enumerated Xs.**
- **AGENTS_V2 ANTI-R1 `:314`:** *"two of everything (two ledgers, two renderers, two auth stacks, two **draft systems**, two token sources, two ops consoles)."* — different set: **includes "draft systems," omits "storefront runtime" and "app shell."**
- **DOC 03 Rule C1 `:44`** states the principle without an enumerated parenthetical (correct).

**Why it is a bug.** The two enumerated parentheticals are **non-identical lists of "the things there is one of."** A reader who treats AGENTS_V2 ANTI-R1 as the canonical enumeration would not see "one storefront runtime" or "one app shell"; a reader on CONST R-15 would not see "one draft system." On the next edit they diverge further. **Canonical home: CONST R-15.** AGENTS_V2 ANTI-R1 and DOC 03 C1 should cite "the single-source-of-truth invariant, CONST R-15" and drop their own enumerated list (or replicate R-15's list verbatim). The *enumeration of single-instance domains* must live in exactly one place.

### DUP-G-013 — The honesty-badge mode triad: `mock/sandbox/live` vs `live/sandbox/scaffold`

This is the most insidious divergence because it is a **value-set mismatch in a money-truth control**:
- **CONST Phil §3.3 `:73`, ART-20 `:276`, R-22 `:423`:** the badge renders **`mock/sandbox/live`.**
- **AGENTS_V2 `PAY-R10` `:254`, `UI-R6` `:293`:** **`mock/sandbox/live`** (agrees with CONST).
- **UI/UX §2 `:48`, §4.10 `:287`, UX-R4 `:460`:** the badge renders **`live/sandbox/scaffold`** — and `:287` explicitly says *"absent `provider_mode` renders 'scaffold/unknown,' never 'sandbox-as-success.'"*

**Why it is a bug (and why it is CRITICAL despite looking cosmetic).** Two governance docs mandate a **different enumeration of provider modes** for the same `ProviderModeBadge` component. An implementer reading the Constitution builds a `mock` variant; an implementer reading the UI/UX doc builds a `scaffold` variant and treats "absent mode" as `scaffold`. The badge is the platform's single financial-honesty surface (CONST Phil §3.3) — a split definition means the validator (UX-R4 route enumeration) and the component could disagree on the legal value set. **Canonical home: CONST ART-20 / R-22** owns the *principle* ("a stub must never read as success") and the mode vocabulary. **The triad must be reconciled to one set.** Recommendation: the UI/UX `scaffold` term is arguably the better label for "no real adapter wired" than `mock`, but **that is an ARB wording decision** — the audit's finding is only that the two docs MUST NOT carry different value sets. Whichever wins, CONST ART-20 states it once and UI/UX UX-R4 cites "the provider-mode triad per CONST ART-20."

---

## 4. Per-cluster detail — the MAJOR parallel-list clusters

### DUP-G-004 — The never-build list is maintained in full three times

- **CONST §10 `:309-327`:** the authoritative **numbered 1-13** list with reopen triggers, marked "reproduced from spine S6."
- **AGENTS_V2 `NEVER-R1…R7` `:183-189`:** the same items **regrouped into 7 rules.**
- **DOC 03 §5 `:417-437`:** the same items as a **13-row table** with a "Why" and "Reopen trigger" column.

The three currently agree, but each carries its **own reopen-trigger text** (e.g. CONST §10 item 8 "≈5,000 merchants + inbound developer demand"; DOC 03 §5 row "~5k merchants + developer demand"; AGENTS_V2 NEVER-R3 "≈5k merchants + inbound developers"). **Three copies of 13 reopen triggers = 39 strings that must be hand-kept in sync.** **Canonical home: CONST §10.** AGENTS_V2 `NEVER-*` and DOC 03 §5 should declare "this enumerates the Never-Build List, CONST §10; reopen triggers are defined there; on any difference §10 governs." The reopen-trigger text lives **once**.

### DUP-G-017 — Five parallel UNVERIFIED registers that already differ in length

- **CONST §14.4 `:453-459`** — 4 items. **AGENTS_V2 App-B `:397-402`** — 4 items (+ a 5th about DOC 01/03 not existing yet). **DOC 03 §7.1 `:472-477`** — 5 items. **DOC 04 §6.1 `:365-372`** — 7 items. **ROADMAP §5 `:653-664`** — 11 items.

**Why it is a bug.** The UNVERIFIED register is a **safety list** (items that must be probed before irreversible action — anon GRANTs, dead-table writers, ops-console survivor). It is maintained in **five places with five different lengths.** An agent reading CONST §14.4 sees 4; the real list (ROADMAP §5) has 11. When one item is verified-and-closed, it must be struck from five lists — and the divergent lengths prove this is already not happening cleanly. **Canonical home: a single shared register.** Because the items are program-scoped, the most-complete (ROADMAP §5, 11 items) or a new dedicated `UNVERIFIED_REGISTER` should be the master; CONST §14.4 keeps only the items that are *constitutionally load-bearing* and cites the master for the rest. Subordinate docs cite "the UNVERIFIED register" rather than re-listing.

### DUP-G-018 — The 6-rank authority chain is re-tabulated in every doc

The full precedence ladder (CONST > AGENTS_V2 > Canonical Systems > Legacy+Roadmap > UI/UX > Evidence) appears as a **full table** in INDEX (`:8-15`,`:27-35`), CONST §P.3 (`:30-41`), AGENTS_V2 AUTH-CHAIN (`:26-41`), DOC 03 §0.1 (`:15-26`), and as a prose line in DOC 04 (`:13`), ROADMAP (`:6`), UI/UX (`:14`). The **rank-4 grouping label differs** (INDEX `:33` calls DOC 04+05 jointly "convergence"; CONST §P.3 item 4 lists them as one rank but DOC 03 §0.1 splits the row). **Canonical home: CONST §P.3.** Every subordinate doc should state only **its own rank + "see CONST §P.3 for the full chain,"** not re-tabulate all six. (The header banner stating "I am rank N, subordinate to 1…N-1" is correct and should stay; the *full-ladder table* should not be in 4 places.)

### The structural sub-finding inside the IDENTICAL clusters (why -007/-009/-010 are flagged MAJOR-adjacent)

The money/tenancy/identity/ledger clusters (DUP-G-006/-007/-009/-010) are content-identical, so they are scored MINOR. **But they share a structural defect worth calling out as a MAJOR pattern:** the AGENTS_V2 operative rules cite **ADRs** (`ADR-005`, `ADR-008`, `ADR-010`, `ADR-011`) and **forensic ISSUE-IDs** — i.e. the **evidence base at authority rank 6** — as their authority, **not the Constitution Article (rank 1) that now owns the decision.** Example: AGENTS_V2 `PAY-R4` `:248` cites "(ISSUE-014; ADR-011)" but never "ART-11," even though ART-11 is now the supreme owner. This means the operative rulebook points *down and sideways* to the evidence instead of *up* to the law. It is not a contradiction today, but it inverts the single-source chain: if ART-11 is amended, the AGENTS_V2 rule's citation still points at the (now-superseded) ADR. **Fix pattern (applies across the money/tenancy/identity/theme rule families):** every AGENTS_V2 rule that restates an Article should cite **"per CONST ART-XX (evidence: ADR-YY)"** — Article first as the owning authority, ADR retained only as the "why."

---

## 5. Duplicate Governance Findings (register)

> **Severity:** **CRITICAL** = divergent duplication that can drift into contradiction (different wording/threshold/scope/value-set, or a list maintained in parallel that *already* differs). **MAJOR** = a list/ladder maintained in full in multiple docs (benign today, structurally drift-prone). **MINOR** = benign layered restatement that is content-correct but missing the explicit up-reference. **EXACT FIX** is a de-duplication / cross-reference instruction — no rule is weakened.

| ID | Sev | Topic | Locations | Canonical home | EXACT FIX |
|---|---|---|---|---|---|
| **DUP-G-001** | **CRITICAL** | Scale envelope + ~30k orders/mo | CONST §6 `:104-112`; AGENTS_V2 ENV-R1/R2 `:52-53`; DOC 03 §0.3 `:36`; UI/UX `:27` | CONST §6 | Make CONST §6 the sole source of the envelope + throughput. AGENTS_V2 ENV-R1/R2, DOC 03 §0.3, UI/UX `:27` read **"the scale envelope per CONST §6 (constitutional constant)"** and MUST NOT independently paraphrase the `~30k orders/mo` figure; if restated for readability, block-quote §6 verbatim. |
| **DUP-G-002** | **CRITICAL** | Canonical-architecture one-sentence | INDEX `:22`; CONST §15 `:467`; AGENTS_V2 §1 `:60`; DOC 03 §4 `:321` | CONST §15 (Sign-off sentence) | Designate CONST §15's sentence as the literal canonical architecture statement. INDEX/AGENTS_V2/DOC 03 **block-quote it verbatim** or cite "per CONST §15." Stop maintaining four paraphrases of a sentence the Index claims is "identical across all docs." |
| **DUP-G-003** | **CRITICAL** | 8-runtime topology enumeration | CONST ART-04 `:165-169`; AGENTS_V2 ARCH-R1 `:64-79` + DEPLOY-R2 `:331`; DOC 03 #1 `:72` + Deployment `:295` | AGENTS_V2 ARCH-R1 (the 8-row table) | Make ARCH-R1's enumerated table the single source. CONST ART-04 and DOC 03 #1 cite **"the canonical 8 runtimes per AGENTS_V2 ARCH-R1"** and do not re-list members with a different grouping. ARB resolves once whether the thin ops console is the 8th runtime or a supporting surface, and that decision lives only in ARCH-R1. |
| **DUP-G-004** | **MAJOR** | Never-build list (the 13 + reopen triggers) | CONST §10 `:309-327`; AGENTS_V2 NEVER-R1…R7 `:183-189`; DOC 03 §5 `:417-437` | CONST §10 | CONST §10 owns the list + the 13 reopen triggers. AGENTS_V2 NEVER-* and DOC 03 §5 add a header **"this enumerates the Never-Build List, CONST §10; reopen triggers are defined there; §10 governs on any difference."** The 39 reopen-trigger strings live once, in §10. |
| **DUP-G-005** | **MINOR** | 0% fee / `commission_bps=0` | CONST ART-12 `:219-223`; AGENTS_V2 PAY-R3 `:247`, NEVER-R5 `:187`; DOC 03 Billing `:183-186` | CONST ART-12 | AGENTS_V2 PAY-R3 and DOC 03 Billing read **"0% / `commission_bps=0` per CONST ART-12"** (Article first; keep ADR-012 as evidence). DOC 04 LEG-042 / ROADMAP P3 keep their text (they own deletion/phase, not the rule). |
| **DUP-G-006** | **MINOR** | Never-custody / PA-split / MoR | CONST ART-11 `:213-217`; AGENTS_V2 PAY-R4 `:248`, NEVER-R2 `:184`; DOC 03 Settlement `:173-176` | CONST ART-11 | AGENTS_V2 PAY-R4 and DOC 03 Settlement read **"never-custody / PA-split per CONST ART-11."** Replace the bare "(ISSUE-014; ADR-011)" citation with "per ART-11 (evidence: ADR-011)." |
| **DUP-G-007** | **MINOR** | RLS ENABLE+FORCE+GUC off `service_role` | CONST ART-08 `:193-197` + R-1…R-4 `:392-395`; AGENTS_V2 SEC-R9 `:235`, SEC-R1 `:224`; DOC 03 Tenant-Isolation `:156-159` | CONST ART-08 | AGENTS_V2 SEC-R9 and DOC 03 Tenant-Isolation read **"layered fail-closed tenancy per CONST ART-08."** ROADMAP P2 keeps (phase). |
| **DUP-G-008** | **MINOR** | Anon `USING(true)`→PUBLIC leaks | CONST ART-09 `:199-203` + R-3 `:394`; AGENTS_V2 SEC-R6 `:232`, SEC-R8 `:234`; DOC 03 `:226-228` | CONST ART-09 | AGENTS_V2 SEC-R6 and DOC 03 read **"anon-leak prohibition per CONST ART-09."** DOC 04/ROADMAP keep (deletion/phase). |
| **DUP-G-009** | **MINOR** | identity-platform sole asymmetric issuer | CONST ART-05 `:173-177` + R-14 `:411`; AGENTS_V2 IDN-R1/R2 `:262-263`, SEC-R7 `:233` | CONST ART-05 | AGENTS_V2 IDN-R1/R2 and DOC 03 Identity read **"sole issuer / asymmetric per CONST ART-05."** Cite Article first, ADR-005 as evidence. |
| **DUP-G-010** | **MINOR** | Canonical ledger / derived balance / bigint paise | CONST ART-10 `:207-211` + ART-13 `:225-229` + R-5…R-8 `:398-401`; AGENTS_V2 PAY-R1 `:245`, PAY-R5/R6 `:249-250` | CONST ART-10 (+ART-13) | AGENTS_V2 PAY-R1/R5/R6 and DOC 03 Ledger read **"single ledger truth per CONST ART-10; bigint paise per ART-13."** |
| **DUP-G-011** | **MINOR** | Liquid wins over React; React FROZEN | CONST ART-17 `:253-257`; AGENTS_V2 THEME-R1 `:275`, WIN-R3 `:140`; DOC 03 Theme-Runtime `:232-235` | CONST ART-17 | AGENTS_V2 THEME-R1 and DOC 03 Theme-Runtime read **"Liquid canonical / React frozen per CONST ART-17."** DOC 03 Rule C3 keeps (it owns the "don't-delete-loser-yet" mechanics). |
| **DUP-G-012** | **CRITICAL** | "one X per domain" — enumerated Xs differ | CONST R-15 `:414`; AGENTS_V2 ANTI-R1 `:314`; DOC 03 C1 `:44-50` | CONST R-15 | CONST R-15 owns the enumerated single-instance list. AGENTS_V2 ANTI-R1 and DOC 03 C1 cite **"the single-source invariant, CONST R-15"** and either drop their own enumerated parenthetical or replicate R-15's list verbatim. Reconcile the membership (R-15 has "storefront runtime, app shell"; ANTI-R1 has "draft systems") into one list in R-15. |
| **DUP-G-013** | **CRITICAL** | Honesty-badge mode triad mismatch | CONST ART-20 `:276` + R-22 `:423` + Phil §3.3 `:73`; AGENTS_V2 UI-R6 `:293`, PAY-R10 `:254`; UI/UX §4.10 `:287`, UX-R4 `:460` | CONST ART-20 / R-22 | CONST ART-20 states the provider-mode value set **once** (ARB reconciles `mock/sandbox/live` vs `live/sandbox/scaffold` — they MUST NOT differ across docs). UI/UX UX-R4 + AGENTS_V2 UI-R6 cite **"the provider-mode triad per CONST ART-20"** and drop their own value set. The "stub never reads as success" principle stays owned by ART-20 / R-22. |
| **DUP-G-014** | **MINOR** | The one-line never-build test | CONST §10 `:327`; AGENTS_V2 ENV-R3 `:54` + NEVER-R7 `:189`; DOC 03 §5 `:437` | CONST §10 `:327` | All restatements are verbatim — keep them, but tag each **"the one-line rule, CONST §10"** and drop the divergent provenance tags ("spine S6 / FREEZE §2 / V1 §4" vs "Constitution §6; ADR-023") so the source is unambiguous. |
| **DUP-G-015** | **MINOR** | Reserved services empty; not `production` | CONST ART-19 `:267-271` + R-16 `:415`; AGENTS_V2 ARCH-R4/R5 `:86-87`, NEVER-R6 `:188`; DOC 03 #29/#30/#34 | CONST ART-19 | AGENTS_V2 ARCH-R4/R5 and DOC 03 read **"reserved-services-empty per CONST ART-19."** DOC 04 LEG-012…017 keep (per-service deletion rows). |
| **DUP-G-016** | **MINOR** | Deploy meta-blocker keystone; lag=0 | CONST ART-03 `:159-163` + R-20 `:421`; AGENTS_V2 DEPLOY-R1 `:330`; DOC 04 Wave 0 `:226`; ROADMAP P1 `:264` | CONST ART-03 | AGENTS_V2 DEPLOY-R1 reads **"the deploy keystone per CONST ART-03."** DOC 04 Wave 0 + ROADMAP P1 keep (they own the order/phase). |
| **DUP-G-017** | **MAJOR** | The UNVERIFIED register (5 parallel lists) | CONST §14.4 `:453-459`; AGENTS_V2 App-B `:397-402`; DOC 03 §7.1 `:472-477`; DOC 04 §6.1 `:365-372`; ROADMAP §5 `:653-664` | One shared register (master = ROADMAP §5 / a dedicated file) | Designate one master UNVERIFIED register. CONST §14.4 keeps only the constitutionally-load-bearing items + cites the master; AGENTS_V2/DOC 03/DOC 04 cite **"the UNVERIFIED register"** rather than maintaining their own (the 4-vs-5-vs-7-vs-11 length drift proves they already diverge). |
| **DUP-G-018** | **MAJOR** | The 6-rank authority chain (full table ×4) | INDEX `:27-35`; CONST §P.3 `:30-41`; AGENTS_V2 AUTH-CHAIN `:26-41`; DOC 03 §0.1 `:15-26` | CONST §P.3 | CONST §P.3 owns the full ladder. INDEX/AGENTS_V2/DOC 03 keep their one-line "I am rank N" banner but replace the **full 6-row table** with "see CONST §P.3 for the complete chain." Reconcile the rank-4 grouping label (INDEX vs CONST). |

---

## 6. Notes for the final response

**What is undetermined / needs an ARB call (not resolvable by de-duplication alone):**
1. **DUP-G-013 (honesty-badge triad)** — `mock/sandbox/live` (Constitution, AGENTS_V2) vs `live/sandbox/scaffold` (UI/UX) is a genuine **value-set conflict**, not just placement. De-duplication can collapse it to one home (CONST ART-20), but **which triad wins is an ARB wording decision** — the audit only establishes they MUST be identical.
2. **DUP-G-003 (ops console in/out of the "8")** — whether the thin ops console is the 8th runtime or a supporting surface is currently answered differently across CONST ART-04 and AGENTS_V2 ARCH-R1; resolving the count to a single number is an ARB call (and couples to the still-UNVERIFIED ops-console survivor decision).
3. **The 8th document.** `LETBUYY_FINAL_ARCHITECTURE_SCORECARD.md` (listed in `INDEX:35` as a "reference" doc, **outside the named 7**) **also restates** never-custody (`:91`,`:114`,`:217`), the 8-runtime topology (`:27`,`:84`,`:241`), the validator-retarget list, and "two parallel systems" (`:232`,`:242`) — and carries its own TOP-20 lists. It was **not in this audit's 7-doc scope**, but it is a real additional parallel-maintenance surface for several clusters (notably DUP-G-003, -006, the validator-retarget list). The ARB should decide whether the Scorecard is folded into the audited set or explicitly marked "reference-only, cites the 7, never re-derives."
4. **DUP-G-017 master location** — the report recommends a single UNVERIFIED register but does not pick whether it lives in ROADMAP §5 (the longest, 11 items) or a new dedicated file; that is a structural ARB choice.

All other 14 findings are mechanically fixable by inserting a cross-reference ("per CONST ART-XX / §N") and removing the independently-worded restatement — **no rule content changes, nothing is weakened.**

*End of DUPLICATE_GOVERNANCE_REPORT.md (Governance Hardening 2026, Phase 3). 18 duplicate clusters; 5 divergent/CRITICAL, 6 MAJOR parallel-list, 7 MINOR benign-restatement. The fix everywhere is single-source-of-truth: one owning clause + N cross-references, never a deleted or weakened rule. No repo doc was modified. Evidence pinned at `stepup/main` @ `5cf9e64e`, 2026-06-10.*
