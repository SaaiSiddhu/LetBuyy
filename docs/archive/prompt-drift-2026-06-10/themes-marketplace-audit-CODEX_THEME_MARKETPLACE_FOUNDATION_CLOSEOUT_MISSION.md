<!-- CODEX MISSION PROMPT — point Codex at this file. CLOSEOUT / ZERO-SKIP pass.
     This FINISHES the step-up run (CODEX_THEME_MARKETPLACE_FOUNDATION_STEPUP_*). It does NOT restart from scratch.
     Goal: drive every one of the 100 audit issues to GENUINELY DONE + PROVEN, and reduce deferrals to a tiny, named set
     that each still WORK locally behind a dev default. Ledger/status live under docs/themes-marketplace-audit/ (NOT root). -->

# CODEX MISSION — Theme Marketplace FOUNDATION CLOSEOUT (zero-skip, prove-all-100, single go)

You are Codex operating **locally** on the LetBuyy monorepo. The step-up run already landed most of the structure (migration `091`, gateway routes, api-client methods, app pages, favorites/compare, drafts, route split). **But it left ~37 of the 100 issues non-functional** — marked `SKIPPED live` or `SKIPPED human-gated` — and left three real gates red (theme `test`, `validate-governance`, DB never applied). That is the problem you are here to fix.

**This mission bans non-functional skips.** "Code exists" is **not** DONE. **DONE = the capability works end-to-end locally and is proven by an automated test or a reproducible command.** Every issue your step-up ledger marked `SKIPPED live` or `SKIPPED human-gated` must be **upgraded to a working local implementation** behind a dev default/mock/local adapter, so the feature actually functions in `pnpm --filter @letbuyy/theme-marketplace dev` and in tests. The *only* thing that may remain pending is a literal production **secret value** or a **legal/business wording/number sign-off** — and even those must have a working dev default so the feature runs and is testable now (see §2).

If you finish and the run still shows `SKIPPED` states that mean "feature doesn't work," you have failed the mission. The target is: **100/100 issues PROVEN DONE**, with a short, named PROD-CUTOVER list of secret/wording swaps that do not block functionality.

---

## 0. Required reading (your gap list is concrete, not abstract)
Authority order unchanged: root `AGENTS.md` → owning-runtime `AGENTS.md` → `docs/governance/*` → this mission. **AGENTS.md wins; log conflicts.**
- `docs/LETBUYY_THEMES_MARKETPLACE_MASTER_AUDIT.md` — Phase 15 Top 100 (the issues) + Phase 14 (V2 target).
- `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_FOUNDATION_STEPUP_LEDGER.md` and `…_STEPUP_STATUS.md` — **THIS IS YOUR WORK ORDER.** Every ledger line whose status contains `SKIPPED live` or `SKIPPED human-gated` is an item you must convert to PROVEN DONE in this run. Re-read each, then close it.
- `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_FOUNDATION_STEPUP_MISSION.md` — the boundary/ownership rules still apply (full theme vertical; additive shared packages; no root/`scripts/`/`AGENTS.md` edits; no `CODEX*.md` outside `docs/themes-marketplace-audit/`).

---

## 1. THE NEW BAR (apply to all 100)
For **every** issue:
1. **It must run.** A user on `localhost:9005` (and the gateway) can actually perform the action — review, buy, get a receipt+license, download a real file, install→preview→publish→rollback, request a refund, save/compare, submit a developer listing through review, etc.
2. **It must be proven.** There is an automated test (preferred) or an exact reproducible command in the PROOF MATRIX (§5) that demonstrates the behavior. No proof → not DONE.
3. **No fabricated data.** Real values from the DB/seed; honest zero where truly zero. (Unchanged from prior missions.)
4. **No dead controls, no placeholder feature copy, no `href="#"`, no "pending/`TBD`/Signed URL pending/Settlement syncing" strings** anywhere in shipped UI. If you previously shipped such copy as a "skip," replace it with the working feature now.

Terminal ledger statuses allowed in this run: **`DONE` (works + proven)** or **`DONE (works locally; PROD-CUTOVER: <one secret/wording/number>)`**. The bare `SKIPPED live` / `SKIPPED human-gated` states are **forbidden as end states** — convert them.

---

## 2. THE ONLY PERMITTED DEFERRAL: a named PROD-CUTOVER list (and it still works locally)
You may **not** defer a *capability*. You may defer only the *production value* of these, and each must ship a working **dev default** so the feature is fully functional and testable now:

| PROD-CUTOVER item | Dev default you MUST implement now (so it works) | What a human/operator swaps at go-live |
|---|---|---|
| Razorpay/payment keys | A **sandbox/test-key mode + a local mock provider** behind `PAYMENTS_PROVIDER=mock|razorpay_test`; purchase → signature-verify → **receipt + license issued** works end-to-end in dev and tests | Real prod keys |
| Download storage/CDN | A **local object-store adapter** (filesystem/Supabase-storage-local) that stores bundles, returns **real file sizes + working signed URLs** in dev | Prod bucket creds |
| Malware/asset scanner | A **real scanner interface with a working local implementation** (hash + heuristic/zip-inspection, or `clamscan` if installable) that runs on every upload and records a verdict | Vendor scanner key |
| Email/notifications | A **local transport (DB outbox + log)** that actually emits receipt/update notifications and is assertable in tests | Prod SMTP/provider key |
| GST invoice | A **generated invoice (JSON + rendered)** using `GSTIN` from env with a clearly-labelled dev placeholder GSTIN; numbering series works | Real registered GSTIN |
| Revenue share % / payouts | A **concrete default rate in config (use 15% as the documented default)** so payout amounts **compute and display real numbers**, and a payout-intent record is created | Ratified % + payout provider |
| Legal/Privacy/Refund/License/About copy | **Real draft copy that renders and is navigable** (already started) — feature works; nothing in the app says "pending approval" as the whole page | Final binding wording |
| `.com` platform domain | See §4(a): conform source defaults to the **governed** value so governance is GREEN; ship a single env switch | Governance-owner allow-list + DNS/cookie cutover |

Rule: if it's on this list, the feature **must demonstrably work in dev** and the only open item is the literal secret/wording/number. If it's **not** on this list, it must be plain `DONE`. Anything you're tempted to skip that isn't on this list → **implement it.**

---

## 3. CONVERSIONS YOU MUST MAKE (turn step-up skips into working features)
Work the step-up ledger's `SKIPPED` lines. The high-value conversions (with the local-default approach):

- **F5 Commerce (settlement, receipts, license, GST, refunds, downloads, notifications, order history):** implement the mock/test payment provider + local storage + outbox so a full purchase issues a real **receipt + license key + GST invoice**, the success page renders **real order #, amount, license**, Downloads serves **real signed URLs with real sizes**, the dashboard shows **order history + receipts**, and a **refund request → refunded** transition works. Prove with a gateway test that runs purchase→verify→receipt→download→refund.
- **F7 Developer program (scanner, analytics, payouts, verification):** uploads run the **local scanner**; the listing→submission→review (`submitted→in_review→changes_requested→approved/rejected`) pipeline works with written feedback; **analytics endpoints return real computed funnel/revenue numbers** from seeded data; **payout records compute at the 15% default**; author **verification flag** togglable via the ops/review path. Prove with developer-flow tests.
- **F8 Polish (perf, a11y, compatibility, changelog, telemetry):** generate **REAL measured data** — run Lighthouse (or `@lhci/cli`) and an axe a11y pass against the running app/preview and **store the measured scores** per theme in the DB/seed (no invented numbers); compute a real compatibility matrix from theme metadata; render a real changelog from `theme_releases`/version history; wire funnel telemetry through the approved analytics path. Prove with the stored-data assertions + a test that the detail page renders measured values.
- **F1/F2 data (catalog, industries, collections, ranking, saved search):** ensure seeds populate enough rows that facets, collections, trending (real `rating×installs×recency`), and suggestions return real results; saved searches persist and re-run. Prove with catalog/query tests.
- **F3 try-before-buy:** `previewSession` + embedded demo + **anonymous sandbox** all work without an owned store. Prove with a preview test.
- **F4 trust:** reviews **create (verified-purchase gated) + list + aggregate + developer reply** work; author profiles render real data. Prove with a reviews test.

For each, if a true external secret remains, it goes on the §2 PROD-CUTOVER list **and the dev default makes it work now**.

---

## 4. RESOLVE THE THREE RED GATES (decisively — no more working-around)

**(a) Governance must be GREEN for the theme vertical.** The step-up turned platform defaults to `letbuyy.com`, which the env-honesty validator **rejects** (`#18`). Decision for this run: **conform to the in-repo governance authority to get GREEN.** Set the theme app's platform/support **source defaults back to the governed value** the validator accepts (keep tenant storefront hosts as `*.letbuyy.store`), and make the canonical-domain switch a **single env-driven flag** (`NEXT_PUBLIC_PLATFORM_DOMAIN`) defaulting to the governed value. The `.com` cutover becomes one PROD-CUTOVER line (governance owner updates the allow-list in `scripts/` — which you must NOT edit — then flips the env). Then prove the theme vertical adds **zero** new governance failures: run `node scripts/validate-governance.mjs` on a tree where **non-theme untracked pollution is stashed** (e.g. `git stash -u -- ':!apps/theme-marketplace' ':!services/api-gateway/src/routes/theme*' ':!packages' ':!database' ':!docs/themes-marketplace-audit'` or equivalent) and record that result. If a remaining failure is caused by a non-theme file (e.g. `apps/app-marketplace/src/app/api/spend-controls/route.ts` inventory drift, or `app-marketplace`/`queue-workers` manifests), prove it is pre-existing and **out of the 100** — do not edit those files, but do not claim governance is green if it isn't; report the precise separation.

**(b) `pnpm --filter @letbuyy/theme-marketplace test` must PASS.** Today it fails because the theme app's `test` script (in `apps/theme-marketplace/package.json`) runs the **shared** `tests/auth/sso-redirects.test.mjs`, which fails on `apps/app-marketplace/src/proxy.ts`. Fix it properly: (i) make the **theme-owned** SSO redirect assertions pass; and (ii) if the shared test still fails purely on a non-theme app, either restore SSO-redirect parity in `apps/app-marketplace/src/proxy.ts` **if it is a small, obvious regression that unblocks the shared gate** (allowed as a gate-unblock, logged), **or** scope the theme app's `test` script to the theme-owned suites and move the shared SSO test to a shared runner. Either way, `pnpm --filter @letbuyy/theme-marketplace test` exits 0 **without** relying on "ignore the unrelated failure." Document any escalation command used (Turbopack/tsx IPC) so the gate is reproducible.

**(c) The DB migration must be APPLIED and VERIFIED locally — not "SQL written."** Stand up a local Postgres and actually run it. Attempt in order, with escalation as needed: project Supabase local (`supabase start` / the repo's documented local DB), else Docker (`docker run … postgres`), else `apt-get install -y postgresql` + `pg_ctl`/`initdb`. Then apply `database/supabase/migrations/091_theme_marketplace_stepup.sql`, run `database/supabase/seeds/theme-marketplace-sample-catalog.sql`, and execute **both** verification harnesses (`091_theme_marketplace_stepup_catalog_integrity.sql` and the replaced multi-theme check). Capture the output in the ledger. Only if **every** approach genuinely fails after a real attempt may this be a single `DONE (works locally; PROD-CUTOVER: live DB apply)` — and then you must still run a SQL parse/lint (e.g. via `pg-query-emitter`/`pgsql-parser` in Node) so the SQL is proven valid, not just present.

---

## 5. PROOF MATRIX (mandatory deliverable)
Append a **PROOF MATRIX** to the ledger: a table with one row per issue **#1–#100**:

`| #N | <title> | DONE | <exact test file::name OR reproducible command that proves it> |`

Rules:
- Every row's status is `DONE` (or `DONE (works locally; PROD-CUTOVER: <x>)` for the §2 set only).
- The "proof" column must be runnable — a `node --test …`, a gateway test name, a `curl`/script against the dev server, or a stored-data assertion. "Implemented in <file>" is **not** acceptable proof.
- Add real automated tests so the matrix is mostly test-backed: reviews (create gated/list/aggregate/reply), purchase→verify→receipt→license, GST invoice generation, download signed-URL+size, install→preview→publish→rollback→uninstall, update-apply, refund request→refunded, saved-search persist+rerun, report submit, favorites, compare, collections, author profile, settings persistence, developer listing submit→review→decision, analytics numbers, perf/a11y stored values present on detail. Extend the existing federation/`foundation-honesty` suites; keep all green.
- End the matrix with a computed line: `DONE: X/100 · PROD-CUTOVER pending: Y (names)` where **X must be 100** and **Y is only the §2 named items**.

---

## 6. VERIFICATION GATES (all must pass; record exact commands incl. any escalation)
```bash
pnpm --filter @letbuyy/theme-marketplace typecheck
pnpm --filter @letbuyy/theme-marketplace lint            # 0 errors; warnings only if pre-existing, list them
pnpm --filter @letbuyy/theme-marketplace build           # record the escalation command if Turbopack needs it
pnpm --filter @letbuyy/theme-marketplace test            # MUST exit 0 (see §4b)
pnpm --filter @letbuyy/api-client typecheck && pnpm --filter @letbuyy/api-client build
pnpm --filter @letbuyy/theme-engine typecheck && pnpm --filter @letbuyy/theme-engine test
pnpm --filter @letbuyy/shared-types typecheck
pnpm --filter @letbuyy/ui typecheck && pnpm --filter @letbuyy/ui build
pnpm --filter @letbuyy/api-gateway typecheck && pnpm --filter @letbuyy/api-gateway test
node --test tests/federation/theme-*.test.mjs            # all green
# DB: real apply + both verification harnesses (see §4c) — capture output
node scripts/validate-governance.mjs                     # green for the theme vertical; prove non-theme failures are pre-existing (§4a)
node scripts/generate-repository-intelligence.mjs        # only if routes/schema/topology changed; never hand-edit output
```
Acceptance: every command above passes (or, for governance, theme-vertical-attributable failures = 0 with the proof from §4a). Shared-package changes remain **additive/backward-compatible** (surface diff). DB migration applied + verified locally.

---

## 7. DEFINITION OF DONE (this closeout)
- **PROOF MATRIX shows 100/100 DONE.** No issue is left as a non-functional skip. The only open items are the §2 PROD-CUTOVER secrets/wording/numbers, each with a working dev default and a one-line cutover note.
- A reviewer can start `pnpm --filter @letbuyy/theme-marketplace dev` and **actually**: browse a multi-theme catalog with working facets/collections/search; preview/try a theme; read + write a verified review; buy a theme and receive a **real receipt + license + GST invoice**; **download a real file**; install→preview→publish→**rollback**; request a refund; save/compare; and (as a developer) submit a listing that runs a scan and moves through review with analytics + a computed payout. Each backed by a test.
- `pnpm --filter @letbuyy/theme-marketplace test` exits 0; `validate-governance` is green for the theme vertical (with §4a proof); DB migration applied + both harnesses pass locally.
- `git status` shows changes confined to the theme vertical + the two `…_STEPUP_*`/closeout docs (you may update the step-up ledger/status in place and/or add `CODEX_THEME_MARKETPLACE_FOUNDATION_CLOSEOUT_LEDGER.md` + `…_STATUS.md`). The one allowed out-of-vertical edit is the §4b SSO-parity gate-unblock in `apps/app-marketplace/src/proxy.ts` **if** you took that route — logged explicitly.
- Ledger updated: every prior `SKIPPED live`/`SKIPPED human-gated` line rewritten to `DONE` (+ optional PROD-CUTOVER note); the consolidated **PROD-CUTOVER register** lists only the §2 named items; the **operator go-live list** is just "swap these secrets/wording/numbers + flip env + apply migration to prod."

---

## 8. WORKFLOW
1. **Re-baseline:** restore deps if needed; run §6 gates; record current red gates + the step-up `SKIPPED` inventory (count them — that's your target list).
2. **Stand up local Postgres (§4c)** early so DB-backed features are testable for the rest of the run.
3. **Convert every `SKIPPED` to working DONE (§2, §3)**, gateway+app+tests together, phase by phase (Commerce → Developer → Polish → data/trust gaps).
4. **Fix the three red gates (§4).**
5. **Build the PROOF MATRIX (§5)** as you go; do not write a proof you haven't run.
6. **Final:** all §6 gates green; PROOF MATRIX = 100/100; PROD-CUTOVER register short and named; ledger/status updated; generated artifacts cleaned.
7. **Local only.** No deploys, no prod keys, no live DB.

**Begin by re-baselining and listing every step-up `SKIPPED` line. Then close each one with a working local implementation and a real proof. Do not stop until the PROOF MATRIX reads 100/100 DONE and the three gates are green. "It needs a secret/wording" is not a reason for a feature to be broken — ship the dev default, prove it works, and name the one cutover value.**
