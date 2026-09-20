# LetBuyy Repository Truth Audit — 2026-06-10

**Forensic, discovery-only investigation. No code, migrations, validators, or architecture were created or modified. Read-only git throughout.**

- **Repository state at audit:** branch `stepup/main`, HEAD `c4fc3cd6` (2026-06-10 08:42 IST)
- **Working tree:** massively dirty/uncommitted — **512 deleted, 410 modified, 76 untracked** paths from an executed Phases A–D13 program (`EXECUTION_LEDGER.md`, every row "not committed")
- **Deploy branch `main`:** 30 commits behind `stepup/main`; carries none of the hardening
- **Method:** 9 parallel axis auditors → 3 synthesis auditors → master synthesis; all top S0/critical claims independently spot-checked by the lead against source

---

## Headline

LetBuyy is **three platforms wearing one repository**: the deployable `main` (account takeover, anonymous RLS leaks, a silent 3% rake, un-ledgered money, unguarded payouts), HEAD (+30 commits), and an **uncommitted working tree** that holds the entire hardened end-state. The best governance, security, and money code the project has ever had exists only as unsaved edits with **zero git history** — one `git clean -fd` from deletion, one `git commit -am` from orphaning its own archives. The governance gate passes, but it reads an untracked migration, is structurally blind to the five riskiest migrations, and **machine-mandates the multi-region/chaos architecture the Constitution forbids**.

- **Repository Health Score: 3.1 / 10**
- **Production Readiness: 2.3 / 10** as-deployable today (from `main`) · **5.5 / 10** working-tree end-state (committed + merged + human seams resolved)

The gap between the two readiness numbers is the commit/merge seam. The remaining ceiling is **genuine missing capability** — concentrated in money — that survives any merge.

---

## Reports

| # | Report | Scope |
|---|--------|-------|
| 00 | **LETBUYY_REPOSITORY_TRUTH_MASTER_REPORT.md** | Master synthesis — 22 sections, all Top-25 lists, scores, registries |
| A1 | GOVERNANCE_TRUTH_REPORT.md | Canonical governance, validator census, fate of prior audits |
| A2 | ARCHITECTURE_TRUTH_REPORT.md | Where canon lives now, supersession, dangling refs, runtime-map cross-check |
| A3 | PROMPT_DRIFT_REPORT.md | Active/obsolete/dangerous prompts, the prompt factory, archive completeness |
| A4 | CODEBASE_REALITY_REPORT.md | What actually runs — topology, routes, package graph, dead weight |
| A5 | DATABASE_TRUTH_REPORT.md | 92-migration chain, RLS final-state, dead/duplicate schema, uncommitted-migration risk |
| A6 | THEME_PARITY_REPORT.md | React vs Liquid parity matrix, runtime routing, **React NOT deletion-ready** |
| A7 | IDENTITY_TRUTH_REPORT.md | Auth topology across 3 realities, session/cookie census, service_role exposure |
| A8 | MONEY_TRUTH_REPORT.md | Canonical money-path traces (a–e), ledger truth, reconciliation, commission |
| A9 | MOBILE_TRUTH_REPORT.md | 64 screens (34 dead), BFF contract, login double-spend, release lane |
| S1 | DELETION_CANDIDATE_REGISTRY.md | Repo-wide KEEP/ARCHIVE/DELETE/CANONICAL with conditions |
| S2 | DUPLICATE_REALITY_REPORT.md | 10 duplicate clusters, ~60 pairs, winner/loser per ratified canon |
| S3 | PRODUCTION_READINESS_REPORT.md | 11 domains dual-scored, blockers A/B/C, launch-today narrative |

---

## The 12 findings that matter most

1. **Everything is uncommitted.** All 40 `EXECUTION_LEDGER.md` rows say "not committed"; migrations 162–166, the `/switch` fix, asymmetric identity, RLS FORCE+GUC, DOMPurify, and the Constitution itself have no git history. (A1, A5, S3)
2. **`main` is the only deploy branch** (push-triggered, `production-deploy.yml:3-7`) and is 30 commits behind — production ships the condemned platform. (A4, S3)
3. **The commit trap:** 60 tracked root docs + 38 governance docs are deleted in-tree with archive copies that exist **only** untracked; a naive `git commit -am` orphans them. (A1, S1)
4. **Account takeover live in committed code** — `main`'s `/api/auth/switch` mints a session for any `email_verified` user with no ownership proof. Fix is working-tree-only. (A7, lead-verified)
5. **Storefront capture path writes zero ledger entries** — `confirm_order_payment_with_ledger` (baseline:1590) is naming theater; the path every shopper hits, plus 2 of 3 refund paths, un-ledgered in **all three** realities. (A8, lead-verified)
6. **No payout provider client** — `initiateTransfer` throws unconditionally; merchants can never be paid in any state. (A8, lead-verified)
7. **The gate self-block reborn** — `whole-repo-end-state-validator.mjs:172-193` requires `globalRegions:[india,apac,eu,us]` + survivability/chaos CI wiring, contradicting the one-region Constitution. (A1, A2, S2, lead-verified)
8. **Gate integrity is illusory** — `rls-force-coverage-validator` reads untracked migration 164 (green locally, errors in clean CI); `migration-safety-validator` scans tracked files only, blind to 162–166. (A5)
9. **Step-up is mock theater** — refund/payout/DSR-erase guarded by any ≥12-char self-served token; the validator certifies the mock. OIDC is a 501 skeleton. (A7)
10. **25 PUBLIC `USING(true)` RLS policies survive** final state outside the validator allowlist, including `service_role_*`-named-but-PUBLIC policies — the exact bug 163 was built to fix. (A5)
11. **React theme renderer is NOT deletion-ready** despite Liquid being the ratified winner — only type-level parity, `core.header`/`core.footer` have no Liquid counterpart, no data binding, index-only template, no canary write path, editors are React/JSON-only. (A6, lead-verified)
12. **Mobile login double-spends its single-use Turnstile token** (BFF consumes it, identity re-verifies it) and 34 of 64 screens are unreachable, including the 1,800-line theme editor. (A9, lead-verified)

---

## What this audit did NOT do

Per the mission: no redesign, no roadmap, no new architecture, no code/migration/validator/prompt generation. All "required actions" in the reports are stated only as *what must become true*, never as designs. Live infrastructure, live database state, and live provider integrations were **out of scope** (no access) and are consolidated as UNVERIFIED seams in the master report §21.

## Provenance

13 reports · ~3,870 lines · agent-based parallel audit · HEAD `c4fc3cd6` · tree 512D/410M/76?? · 2026-06-10.
