# Internal console redesign — 21 October 2026

## Delivered

The existing `apps/internal/console` now uses a light, purple operations workspace. The canonical `AppNavigation`, `Navigation`, `Modal`, theme provider, controls and design tokens remain the foundation. Dark mode remains reachable. The gateway, identity issuer, tenant guard, MFA, approval enforcement and mutation handlers are unchanged.

The shared shell applies to the existing console routes, including record details. Improvements include grouped navigation, active-route breadcrumbs, responsive navigation, keyboard workspace search (Cmd/Ctrl+K), account controls, refresh/retry, skip navigation, loading/error recovery, semantic light/dark colours, readable table headers, explicit empty results, and pagination ranges. Workspace search searches destinations; record searches remain server-backed and scoped to their own workspace.

The overview now links real platform counters and operational queues. Missing revenue/history is explicitly unavailable, with an informative empty chart. Missing health rollups are not represented as healthy zeroes. Labels distinguish live counters, recorded periods, and report freshness. No synthetic metrics, customer records or approvals were introduced.

The shell keeps the app-platform feature gate: developer operations and ecosystem governance are omitted from navigation while their existing routes are disabled. The feature flag was not enabled.

## Reference inspection

Inspected the authenticated [Jaishop administration site](https://admin.jaishop.in/) read-only. Visited all 42 primary destinations discovered in navigation, plus account/authenticator presentation. Navigation disclosures and page reads only; no submissions, saves, exports, financial actions or account changes. Private record contents are excluded from this report.

Observed patterns carried into LetBuyy: grouped business/platform navigation, restrained neutral surfaces, persistent workspace context, labeled filters, contextual actions, compact record tables, clear status, searchable directories, and recovery paths. Jaishop's gold, referral earnings and custody/payout business model was not adopted.

| Area | Primary reference routes visited |
| --- | --- |
| Home and service | `/`, `/cases`, `/customers`, `/support`, `/customers/banks`, `/network` |
| Purchases | `/purchases`, `/purchases/orders`, `/reviews`, `/fulfilment` |
| Earnings and settlement | `/earnings`, `/earnings/health`, `/payouts`, `/weekly`, `/settlement` |
| Reports | `/reports/overview`, `/reports/bank-statements`, `/reports`, `/reports/daily`, `/reports/expenses`, `/reports/audit`, `/reports/archive` |
| Business configuration | `/rates`, `/packages`, `/plans`, `/promotions` |
| Communication | `/enquiries`, `/customer-notices`, `/website`, `/brochures` |
| Governance | `/audit`, `/staff`, `/privacy`, `/retention` |
| Administration | `/setup`, `/accounting-review`, `/manage/reward-rules`, `/payout-policy`, `/simulator`, `/downloads`, `/manage`, `/notifications` |

Seven destinations remained loading during inspection: `/`, `/reports/overview`, `/reports/daily`, `/reports/archive`, `/rates`, `/manage/reward-rules`, and `/payout-policy`. Their content is unverified. This is coverage of primary navigation and representative UI states, not a claim to have inspected every record, nested workflow or permission tier.

## Console coverage and needed capabilities

31 existing page source files were inventoried, including authentication, aliases and detail pages. The common shell covers these routes without adding another runtime or business system.

| Capability | Existing workspace and redesign treatment |
| --- | --- |
| Merchant oversight | Store directory, merchant search/profile, founding programme; shared filters, tables and contextual links |
| Access management | Users, employees, permission and access-review forms; existing server authority retained |
| Finance | Revenue, subscriptions, ledger reconciliation; existing ledger/approval contracts retained |
| Review and enforcement | Listing/reel review, trust-and-safety cases, risk evidence; existing revisions and actions retained |
| Operational response | Health, jobs, incidents, on-call and postmortems; existing guarded actions retained |
| Governance | Independent approvals, audit log, privacy/retention and settings |
| Navigation and recovery | Added workspace search, mobile navigation, refresh/retry, loading and error boundaries |
| Future app ecosystem | Existing disabled feature remains disabled; no new marketplace or payout execution capability |

## Validation

- Console production build and TypeScript check pass.
- Console regression suites: 32 application/auth tests and 12 federation/session tests pass.
- Shared UI: 47 tests pass, including two landmark composition regressions; shared UI build passes.
- Console CSS stylelint and repository design-system governance pass. The reachability validator now follows the theme toggle into `ConsoleShell`; the invariant remains enforced.
- Console ESLint reports zero errors and 25 remaining warnings in existing page controls/colours. No suppression or baseline update was used.
- Browser checks cover the overview plus all 19 enabled navigation destinations. Workspace search matching/empty results, Escape dismissal, mobile navigation, and light/dark switching were exercised. Record-detail mutations were not performed.
- Local screenshots and machine-readable browser results are in `.tmp/local-backend/console-redesign-*` (ignored local evidence).

## Remaining backend limitations

**21 October follow-up:** the observed store, subscription, founding-allocation, compliance and merchant-search read failures are now repaired and verified locally. See [Console read repair](CONSOLE_READ_REPAIR_2026-10-21.md) for the current disposition and exact acceptance. The following paragraphs retain the original redesign-stage observations.

Successful page rendering is not proof that every business workflow is ready. The real local backend exposed pre-existing failures in directory/subscription/founding reads and compliance reads. In particular, unscoped `sites`, `subscriptions` and `founding_merchant_allocations` queries are rejected by the tenant guard. The redesign displays errors and retry controls instead of fabricated empty results. No guard bypass or broader database access was introduced to make screenshots look successful.

These reads need a separate, permission-specific backend repair with security and database regression coverage. Populated-record detail journeys, destructive actions, financial operations, independent second-operator approvals and production provider integrations remain unverified in this empty local development dataset. Missing rollups are explicitly labeled. This change is a console interface redesign, not production readiness certification.

## Architecture and safety

Applied the requested web UI, admin UI and Cloudflare–Supabase architecture skills. Changes follow ARCH-R1/R10 (existing console), WIN-R4 (reuse canonical systems), UI-R1/R2/R3/R5 (tokens, shell, themes, Lucide), and CODE-R3 (sanitized errors). The shared workspace gained an additive `as` option so console pages compose under one main landmark; standalone consumers retain their default main. Existing local setup reports and secrets were preserved. No deployment or external reference-site mutation occurred.

> Follow-up, 21 October 2026: the broader page audit, additional repairs and current verification limits are recorded in [CONSOLE_ALL_PAGES_AUDIT_2026-10-21.md](CONSOLE_ALL_PAGES_AUDIT_2026-10-21.md). This earlier report remains dated evidence.
