# Top 100 Issues — Ranked by Impact (Phase 14)

> Scope: LetBuyy Developer App (`apps/developer-portal` + `apps/app-marketplace/developers/*`). Ranked by combined developer + business impact. Every issue is grounded in source read during this audit.
>
> **Severity:** 🟥 Critical · 🟧 High · 🟨 Medium · 🟦 Low. **DI** = Developer Impact, **BI** = Business Impact.

## Tier 1 — Critical (1–18): trust-breaking or blocking

| # | Issue | Sev | BI | DI | Recommended fix |
|---|---|---|---|---|---|
| 1 | ~30 CSS classes used by `/api`,`/oauth`,`/webhooks`,`/sdks` (+error/loading/404) are **defined nowhere** → unstyled tables/grids | 🟥 | Looks broken → no adoption | Hardest content to read | Define the classes in `globals.css` or port System B to System A classes |
| 2 | **Two parallel page systems** (`/api`↔`/api-reference`, `/sdk`↔`/sdks`, `/docs`↔`/oauth`+`/webhooks`) | 🟥 | Signals unfinished | Confusion, wrong page | Consolidate to one page per concept |
| 3 | **Two headers with conflicting link targets** ("API"→`/api` vs `/api-reference`) | 🟥 | Incoherent product | Same label → different page | One header component |
| 4 | **Fake `/dashboard` shell** duplicates the real Partner Console in another app | 🟥 | Misleads; erodes trust | Dead end | Delete; link to real console |
| 5 | **No CLI / scaffold / `create-letbuyy`** | 🟥 | No build loop → low adoption | Can't start fast | Ship `letbuyy` CLI |
| 6 | **No interactive API explorer / GraphiQL** | 🟥 | Higher time-to-first-call | Can't try calls | Ship GraphiQL (Admin/Storefront) |
| 7 | **No OpenAPI / machine-readable schema** | 🟥 | No codegen/Postman ecosystem | No typed clients | Generate OpenAPI from gateway |
| 8 | **Docs portal & console are separate apps with no links** | 🟥 | Two products, one name | Can't move learn↔do | Unify shell + cross-link |
| 9 | **App-submission icon/screenshot uploaders are fake `<div>`s** | 🟥 | Can't produce real listings | Blocked submission media | Real `<input type=file>` + handler |
| 10 | **No quickstart / "first app" path** | 🟥 | No conversion funnel | No on-ramp | Add Get-started guide |
| 11 | **"Source-backed" docs cite missing `CODEX_WS10_LEDGER.md`** | 🟥 | Undercuts core credibility claim | False reference | Fix citation + CI to validate `source:` paths |
| 12 | **No published client SDK** (only minimal server wrapper) | 🟥 | Friction → fewer apps | Hand-roll HTTP | Ship App Bridge + server SDK |
| 13 | **No way to test integrations** (no dev-store create, sandbox, webhook sender, logs) | 🟥 | Apps ship buggy | Can't verify before prod | Dev stores + test sender + logs |
| 14 | **No API key management UI** (rotate route exists; no inventory/reveal/revoke) | 🟥 | Support burden | Can't recover/rotate keys | Build credential UI on existing route |
| 15 | Hero CTA "Read API reference" → **unstyled** `/api` page | 🟥 | First click degrades trust | Bad first impression | Fix #1 or repoint CTA |
| 16 | `/api` vs `/api-reference` **contradict on GraphQL** (one lists it, one omits) | 🟥 | Can't trust docs | Can't tell if GraphQL exists | One reference; state GraphQL once |
| 17 | **No support / status / contact entry point** anywhere | 🟥 | Can't retain devs | No escalation | Add support/status/changelog |
| 18 | Error/loading/404 states render **unstyled** (undefined classes) | 🟥 | Looks broken at worst moment | Jarring failures | Style state pages |

## Tier 2 — High (19–45): major DX holes & defects

| # | Issue | Sev | BI | DI | Fix |
|---|---|---|---|---|---|
| 19 | `.docs-grid--two` undefined → intended 2-col layouts always stack | 🟧 | Looks unfinished | Cramped reading | Define responsive grid |
| 20 | 6-col tables overflow with no `overflow-x` wrapper (mobile) | 🟧 | Mobile-broken | Unusable on phone | `overflow-x:auto` wrapper |
| 21 | No docs search | 🟧 | Poor discoverability | Can't find content | Add search |
| 22 | No persistent sidebar / in-page TOC | 🟧 | Hard to navigate | Lost in long pages | Sidebar + TOC |
| 23 | No GraphQL reference/schema/examples (1 line only) | 🟧 | GraphQL unusable in practice | No queries to copy | GraphQL ref + GraphiQL |
| 24 | Register wizard step-1 "Continue" silently no-ops on empty fields | 🟧 | Drop-off at signup | Confusing dead-end | Inline validation + focus |
| 25 | Register collects `tax_id`/agreements but API drops them | 🟧 | Compliance/payout risk | Misleading form | Persist or remove fields |
| 26 | No webhook test sender (dispatch is internal-only) | 🟧 | Apps ship with bad webhook code | Can't simulate | Public test-delivery endpoint/UI |
| 27 | No webhook delivery log/inspector for devs | 🟧 | More support tickets | Can't debug deliveries | Delivery log + replay UI |
| 28 | No developer analytics (install funnel/API traffic) `[SKIP]` | 🟧 | No growth insight for devs | Flying blind | Surface partner aggregate fully |
| 29 | No dev-store create/manage in dev app | 🟧 | Can't test installs | No sandbox | Dev-store create flow |
| 30 | Multiple response envelopes devs must defensively handle | 🟧 | Bug magnet | Cognitive load | SDK normalizes envelope |
| 31 | Mixed key casing (`idempotency_key` vs `idempotencyKey`) | 🟧 | Integration bugs | Easy to get wrong | SDK normalizes; document clearly |
| 32 | No error-code catalog/handling guide (codes scattered) | 🟧 | Fragile integrations | Can't program errors | One catalog + recipes |
| 33 | No copy buttons / language tabs on code | 🟧 | Friction | Manual copy errors | Add copy + tabs |
| 34 | App Bridge is GET-only (no writes) | 🟧 | Limits embedded apps | Can't mutate via bridge | Implement scoped write bridge |
| 35 | Internal jargon in public copy ("D0", "WS11", "ws13", `file.ts:line`) | 🟧 | Unprofessional | Confusing | Rewrite for external devs |
| 36 | Marketplace dashboard `.catch` redirects **all** errors to `/register` | 🟧 | Locks out devs on transient errors | Loop/lockout | Branch on 401/404 only |
| 37 | No app versioning/release management in dev app | 🟧 | Risky updates | No safe release | Version + release flow |
| 38 | No reviewer feedback loop (status string + notes only) | 🟧 | Slow approvals | Opaque rejections | Threaded review + resubmit |
| 39 | Quality-gate copy reads as impossible **listing** barrier (it's a badge gate) | 🟧 | Deters submissions | Misread requirement | Clarify badge vs listing |
| 40 | Marketplace dev pages: hundreds of inline styles, no media queries | 🟧 | Unmaintainable, unresponsive | Inconsistent UI | Move to CSS classes |
| 41 | Dashboard app-row (stats+actions one flex row) overflows on mobile | 🟧 | Mobile-broken console | Hard to use | Responsive wrap |
| 42 | No changelog / API versioning policy page (`X-LetBuyy-API-Version` exists) | 🟧 | Breaking-change surprises | Can't track changes | Changelog page |
| 43 | No tutorials/guides (reference-only) | 🟧 | Steep learning curve | Self-onboarding hard | Add guides |
| 44 | Curated (hand-listed) endpoints will drift from real routes | 🟧 | Docs rot | Stale info | Generate from source |
| 45 | `/developers` landing advertises "Documentation" but links nowhere to it | 🟧 | Lost funnel to docs | Can't find docs | Add docs link |

## Tier 3 — Medium (46–75): polish, completeness, consistency

| # | Issue | Sev | BI | DI | Fix |
|---|---|---|---|---|---|
| 46 | Dead exports `dashboardSurfaces`, `dashboardShell`(v2), `evidenceSources` unused | 🟨 | Wasted work | Confusing codebase | Wire in or delete |
| 47 | `DashboardSurfaceMatrix` component unused | 🟨 | Dead code | — | Remove/use |
| 48 | Richest dashboard data (charges/payouts/collaborator) authored but never rendered | 🟨 | Hidden value | Missing info | Render in console |
| 49 | No glossary (store=site, installation, manifest, app block) | 🟨 | Onboarding friction | Undefined terms | Add glossary |
| 50 | No pricing/revenue page (15%/GST buried in wizard) | 🟨 | Monetization unclear | Hard to find terms | Pricing page |
| 51 | Rate limits documented without backoff/handling recipe | 🟨 | 429 mishandling | Retry bugs | Add handling guide |
| 52 | No full webhook receiver example (pseudocode only) | 🟨 | Slow integration | Trial-and-error | Node/PHP receiver tutorial |
| 53 | Collaborator-code "copy" is an icon with no handler | 🟨 | Minor friction | Manual copy | Wire copy button |
| 54 | No visible focus styles on System B links/buttons | 🟨 | A11y/keyboard | Hard to navigate by keyboard | Add focus-visible |
| 55 | Touch targets on System B (method pills, buttons) likely <44px | 🟨 | Mobile usability | Mis-taps | Min 44px targets |
| 56 | Tables lack `<caption>`/scope semantics styling | 🟨 | A11y | Screen-reader clarity | Add caption/scope |
| 57 | Amber "skip" pill contrast + small caption font legibility | 🟨 | A11y/readability | Hard to read | Verify WCAG AA |
| 58 | System A first breakpoint 820px leaves 768px tablets in mobile layout | 🟨 | Wasted space | Suboptimal | Add 640–768 tier |
| 59 | Nav horizontal-scroll (≤720px) has no affordance | 🟨 | Hidden nav items | Missed links | Scroll shadow/indicator |
| 60 | No sample apps / starter repos | 🟨 | Slower starts | No reference impl | Publish samples |
| 61 | No Postman/Insomnia collection | 🟨 | Ecosystem gap | Manual setup | Export from OpenAPI |
| 62 | No multi-language server SDKs (PHP/Python/etc.) | 🟨 | Limits audience | Lang lock-in | Add libs |
| 63 | No EventBridge/PubSub webhook delivery (HTTPS only) | 🟨 | Enterprise gap | Infra friction | Add cloud delivery |
| 64 | No developer-facing webhook replay (ops-only) | 🟨 | Support burden | Can't recover | Expose scoped replay |
| 65 | No teams/roles UI (scopes/collaborator exist) | 🟨 | Agencies underserved | Hard to collaborate | Team management |
| 66 | No extension UI design system (Polaris-equivalent) for devs | 🟨 | Inconsistent app UIs | Build from scratch | Publish design-system primitives |
| 67 | `/sdk` "Quick-starts" are not quick-starts (contract lists) | 🟨 | Mismatched expectation | Misleading title | Rename / add real quickstart |
| 68 | No "what happens after registration" confirmation | 🟨 | Drop-off | Uncertainty | Post-register screen |
| 69 | `verified=false/status=pending` not explained in UI | 🟨 | Confusion | Unclear state | Explain verification |
| 70 | No app-listing builder (preview/screencast/locale) | 🟨 | Weaker listings | Limited listing | Listing builder |
| 71 | Duplicate HMAC snippet across `/docs` and `/webhooks` | 🟨 | Maintenance | Inconsistency risk | Single source |
| 72 | No dark/light toggle or i18n (tokens exist) | 🟨 | Preference/locale | Minor | Add toggle/i18n |
| 73 | No "Run in explorer" links from reference | 🟨 | Slower learning | Context switch | Link ref→explorer |
| 74 | No per-endpoint cURL for every route | 🟨 | Incomplete examples | Guesswork | Generate cURL |
| 75 | Payment-safety strengths not surfaced as selling points | 🟨 | Lost differentiation | Underappreciated | Add "why LetBuyy is safe" page |

## Tier 4 — Low (76–100): refinements & nice-to-haves

| # | Issue | Sev | BI | DI | Fix |
|---|---|---|---|---|---|
| 76 | Home CTA copy generic ("Start a theme or app") | 🟦 | Minor | Weak guidance | Action-specific CTA |
| 77 | `slideUp` staggered animation on landing can feel slow | 🟦 | Minor | Perceived latency | Reduce/none |
| 78 | **Confirmed broken link:** dashboard "Edit" links to `/developers/apps/:id/edit`, which has **no route** (only `…/apps/new` exists) → 404 on every app row (mis-tiered low; effectively High) | 🟧 | Can't edit listings | Dead button | Add the `apps/[id]/edit` route |
| 79 | `/my-apps` purpose overlaps dashboard listings | 🟦 | Redundancy | Mild confusion | Clarify/merge |
| 80 | No breadcrumb on deep pages | 🟦 | Wayfinding | Minor | Add breadcrumbs |
| 81 | No "last updated" on docs pages | 🟦 | Trust/freshness | Uncertainty | Add timestamps |
| 82 | No feedback widget ("was this helpful?") | 🟦 | No doc telemetry | — | Add widget |
| 83 | Code samples not syntax-highlighted | 🟦 | Readability | Harder scanning | Add highlighting |
| 84 | No keyboard shortcuts (e.g., `/` to search) | 🟦 | Power-user DX | Minor | Add shortcuts |
| 85 | No app categories taxonomy doc for devs | 🟦 | Listing confusion | Guessing category | Document categories |
| 86 | No rate-limit simulator/calculator | 🟦 | Minor | Capacity planning | Optional tool |
| 87 | No SLA/uptime commitment surfaced | 🟦 | Enterprise trust | Risk unknown | Publish SLA |
| 88 | No localized docs (English only) | 🟦 | Reach (India multi-lingual) | Access | i18n later |
| 89 | No "report a doc issue" link | 🟦 | Doc quality loop | — | Add link |
| 90 | No dependency/version matrix (manifest schema versions) | 🟦 | Compatibility | Confusion | Version matrix |
| 91 | No partner newsletter/changelog subscribe | 🟦 | Retention | Missed updates | Subscribe option |
| 92 | No example webhook payloads per topic (beyond lifecycle) | 🟦 | Integration guesswork | Trial/error | Add payload samples |
| 93 | No "test mode" indicator for credentials | 🟦 | Prod/test mix-ups | Risk | Test-mode flag |
| 94 | No app uninstall/data-retention guidance for devs | 🟦 | Compliance gaps | Unclear duties | Add guidance |
| 95 | No accessibility statement | 🟦 | Compliance/trust | — | Add statement |
| 96 | No print/offline-friendly docs | 🟦 | Minor | — | CSS print styles |
| 97 | Footer text identical-but-different across systems | 🟦 | Inconsistency | Minor | Unify footer |
| 98 | No favicon/OG metadata audit for dev portal | 🟦 | Sharing/branding | — | Add OG tags |
| 99 | No analytics on portal (which docs read) | 🟦 | No prioritization data | — | Add privacy-safe analytics |
| 100 | No deprecation policy for scopes/endpoints | 🟦 | Future breakage | Planning risk | Publish deprecation policy |

---

## Rollup
- **Critical: 18** · **High: 27** · **Medium: 30** · **Low: 25** = **100**.
- **~70% of the top 45 issues are front-end, docs, IA, or tooling** — fixable without backend changes.
- The **single highest-ROI fix** is #1 (define the missing CSS): it repairs 4 reference pages + 3 state screens at once.
- The **single highest-trust fix** is #4 (delete the fake dashboard) + #2/#3 (de-duplicate pages/nav): removing self-contradiction moves the trust needle more than any new feature.
