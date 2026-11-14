# Real local pricing verification — 30 October 2026

> **Later follow-up:** fresh signup through plan selection, billing and cancellation is now verified separately in owned disposable tests with the same real catalog. The preserved shared database remains read-only. See [signup/billing verification](../letbuyy-signup-billing-local-2026-10-30/VERIFICATION.md). Earlier limitations below describe this public-pricing stage.

The marketing site now reads the preserved local PostgreSQL catalog through the canonical gateway on **9010**. The missing dependency was the stopped Docker/Supabase stack and gateway process. Starting these existing services restored pricing; no new application-source or environment-file changes were necessary in this follow-up.

## Running services

| Service | Local URL | State |
| --- | --- | --- |
| Marketing | http://127.0.0.1:9006/in/pricing | Running, existing development configuration |
| Canonical gateway | http://127.0.0.1:9010/v1/pricing | Running with Wrangler local mode |
| Canonical accounts | http://localhost:9002/signup | Running; available-plan links reach the signup form |
| Preserved local Supabase | http://127.0.0.1:54321 | Existing `letbuyy-web-local-20261021` stack restarted by Docker |

The temporary production-build listener on9036 was stopped after checking it. No fixture gateway is used. Existing database configuration disables automatic migrations and seeds. No reset, seed, migration, catalog update, account creation, external message, payment, commit, push or deployment was performed.

## Catalog observed

These are **existing local data**, not a claim about the live production catalog. Source plan amounts are stored in paise and converted by the existing `billing-core` resolver.

| Plan | Regular monthly | Current local founding monthly | Availability |
| --- | --- | --- | --- |
| Launch | ₹299 | ₹199 | Available |
| Growth | ₹999 | ₹699 | Available |
| Scale | ₹2,499 | No founding offer | Coming soon; no purchase link |
| Commerce OS | ₹5,999 | No founding offer | Coming soon; no purchase link |

The existing program is active, not paused, with0 used /100 total slots. The displayed overall remaining count is100. No cohort allocation or business policy was changed.

## Verification and evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Database → canonical price resolver → gateway → marketing API | Pass: all4 plans, exact feature/comparison arrays, prices, status, availability and founding counters match | [DB/API parity](evidence/database-api-parity.json), [public snapshot](evidence/database-public-snapshot.json) |
| Desktop and375px mobile, English/Hindi/Tamil | Pass:6 samples; four cards, correct amounts and available/disabled actions, one H1, no captured page/hydration errors or document overflow | [Browser results](evidence/browser-pricing.json) |
| Server-rendered pricing without JavaScript | Pass: home and pricing expose actual ₹199 / ₹699 content with JS disabled | [Browser results](evidence/browser-pricing.json) |
| Comparison controls | Pass:110 rows; differences reduces to61; restoring returns110; expand/collapse works | [Browser results](evidence/browser-pricing.json) |
| Mobile pointer and keyboard controls | Pass: visible switch, expansion, Space toggle and restoration | [Mobile controls](evidence/mobile-comparison.json) |
| Available plan → local accounts | Pass: actual CTA reaches `/signup` with visible email form; no data entered or form submitted | [Handoff evidence](evidence/browser-pricing.json), [screenshot](evidence/signup-handoff.png) |
| Actual gateway outage → retry recovery | Pass: only task-owned gateway stopped; marketing API502, honest unavailable state, zero plan cards; real gateway restarted and existing page retry restores four cards | [Outage/recovery](evidence/gateway-outage-recovery.json) |
| Existing production build with real gateway | Pass: temporary production server returned200 and actual pricing on home, pricing page and API | [Production check](evidence/production-build-pricing.json) |
| Focused canonical pricing tests |19/19 pass; conversion, unavailable/locked-price safeguards and structural route contracts | [Test output](evidence/founding-tests.log) |
| Data preservation | Pass: complete selected public plan rows and founding program match before/after read-only transactions | [Preservation check](evidence/data-preservation.json) |

Screenshots: [desktop plan cards](evidence/real-plan-cards-desktop.png), [mobile plan cards](evidence/real-plan-cards-mobile.png), [unavailable state](evidence/gateway-outage-mobile.png). Reusable browser/parity probes are in [scripts](scripts/); execute from the repository root with the installed SEO managed Chromium runtime and explicit local-origin allowlist. All browser non-GET/HEAD requests were blocked. Full selected public catalog and raw public API response bodies are retained in `evidence/`; credentials and auth headers are excluded.

The first comparison harness attempt incorrectly clicked the intentionally hidden checkbox input. The corrected probe clicks the visible wrapping label, then confirms checked state and actual row changes; keyboard operation passed independently. No application fix was needed for that harness failure.

## Scope limits

Verified the public pricing journey through the signup handoff. Account/OTP creation, authenticated subscription activation, taxes, checkout, invoice issuance and provider payments were not executed. No claim of end-to-end paid subscription acceptance is made. The database was not stopped or fault-injected; backend behavior during database loss was not tested. Server shutdown/restart persistence across machine reboots was not configured. The prior marketing build and source checks remain in the [SEO implementation report](../letbuyy-seo-local-repair-2026-10-30/IMPLEMENTATION-AND-VERIFICATION.md); this follow-up adds actual local-data acceptance and does not rerun unrelated SEO checks.

The public pricing snapshot is time-specific. Re-run parity and browser checks after future plan/program changes; literal test expectations of199/699 and110/61 reflect this captured dataset.
