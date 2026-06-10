# Documentation Gap Analysis (Phase 10)

> Evaluates LetBuyy developer documentation against Shopify Docs across the standard documentation surfaces. Coverage = how complete; Quality = accuracy/clarity/usefulness; Presentation = how it renders.

## Coverage matrix

| Doc surface | LetBuyy | Coverage | Quality | Presentation | Shopify |
|---|---|---:|---:|---:|---|
| Quick start ("hello world") | 🟥 none | 0/10 | — | — | ✅ runnable in minutes |
| Conceptual / getting started | 🟡 prose on home only | 2/10 | 5 | A:styled | ✅ extensive |
| Authentication guide | 🟡 `/oauth` reference (no concept guide) | 6/10 | 9 | **B:unstyled** | ✅ |
| Webhooks guide | 🟡 `/webhooks` + `/docs` reference | 6/10 | 8 | **B:unstyled** | ✅ |
| API reference | 🟡 `/api` + `/api-reference` (dup, contradictory) | 6/10 | 7 | mixed | ✅ generated |
| GraphQL reference | 🟥 ~1 line; no schema/examples | 1/10 | 4 | — | ✅ full + GraphiQL |
| Tutorials (build X) | 🟥 none | 0/10 | — | — | ✅ many |
| Code examples | 🟡 snippets only | 4/10 | 6 | static | ✅ runnable, multi-lang |
| SDK guides | 🟡 `/sdk` + `/sdks` (dup) | 4/10 | 7 | mixed | ✅ |
| CLI guides | 🟥 none (no CLI) | 0/10 | — | — | ✅ |
| Publishing/review guide | 🟡 quality-gate table; no narrative | 4/10 | 7 | **B:unstyled** | ✅ |
| Extensions guides (Admin/Checkout/Theme/Functions) | 🟡 capability lists, no how-to | 3/10 | 7 | **B:unstyled** | ✅ |
| Error reference | 🟡 codes scattered | 3/10 | 6 | mixed | ✅ |
| Rate limits | 🟡 facts, no handling recipe | 5/10 | 7 | A:styled | ✅ |
| Changelog / versioning | 🟥 none | 0/10 | — | — | ✅ |
| Pricing/revenue | 🟡 buried in register wizard | 2/10 | 6 | — | ✅ |
| Glossary | 🟥 none | 0/10 | — | — | ✅ |
| Support / status / contact | 🟥 none | 0/10 | — | — | ✅ |
| Search | 🟥 none | 0/10 | — | — | ✅ |

**Presentation key:** A = System A (styled). B = System B (uses ~30 undefined CSS classes → unstyled). "mixed" = duplicated across both.

## The three documentation problems, in order

### 1. It's reference-only — there is no learning path
Shopify docs are organized as **Get started → Build (guides) → API reference → Launch**. LetBuyy has only the third bucket. There is no quickstart, no tutorial, no conceptual "how OAuth works here" — just dense, accurate tables. A developer who doesn't already know app platforms cannot self-onboard.

### 2. Half of it renders unstyled
The most authoritative pages (`/api`, `/oauth`, `/webhooks`, `/sdks`) are built from undefined CSS classes and render as raw tables/lists. The best documentation content has the worst presentation — the inverse of what you want.

### 3. It contradicts itself and cites a missing file
- `/api` vs `/api-reference` disagree on GraphQL.
- `/sdk` vs `/sdks` duplicate with different depth.
- `sdkToolingGaps` cites `apps/developer-portal/CODEX_WS10_LEDGER.md`, which **does not exist** — fatal for a docs set whose brand is "source-backed truth."

## What LetBuyy docs do better than typical (keep these)
- **Radical honesty:** explicit `SKIP — NEEDS BACKEND/SDK` ledger; never claims a capability it lacks. Most platforms over-promise; LetBuyy under-promises. Preserve this (just relabel for external devs).
- **Source-of-truth discipline:** every claim ties to code. If a generation step replaces the missing-file citation problem, this becomes a genuine differentiator ("docs guaranteed to match the running gateway").
- **Payment/compliance specificity:** the payment-safety and compliance-topic docs are more precise than many competitors'.

## Gap-closure plan (documentation)

| Priority | Action |
|---|---|
| P0 | Restyle System B (define missing classes) so existing docs are readable |
| P0 | Add **Get started** quickstart (register → app → OAuth → webhook → first call) |
| P0 | Fix the broken `CODEX_WS10_LEDGER.md` citation; add CI to validate every `source:` path |
| P1 | Merge duplicate pages; one reference, one SDK page; resolve GraphQL contradiction |
| P1 | Add error-code catalog, rate-limit handling, webhook receiver tutorial (Node/PHP) |
| P1 | Add GraphQL reference + GraphiQL |
| P2 | Add changelog/versioning, pricing/revenue page, glossary, support/status entry points, docs search |
| P2 | Add extension how-tos (Admin UI, Checkout function, theme app block) and sample apps |

## Documentation maturity score
**Current: 3.5 / 10** — accurate and honest, but reference-only, half-unstyled, internally contradictory, and missing every on-ramp surface (quickstart, tutorials, CLI, changelog, support, search). The raw material (precise, source-true content) is high quality; it is mis-packaged for the audience.
