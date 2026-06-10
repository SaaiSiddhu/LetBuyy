# FOUNDATION_RISK_MATRIX

> Generated at **PHASE A.5** (between the repository audit and Wave 0). One consolidated register of every risk the foundation step-up must hold, derived from `FOUNDATION_STEPUP_MISSION_REVIEW.md`, the forensics/challenge evidence, `LETBUYY_SINGLE_SOURCE_OF_TRUTH.md`, and PHASE A artifacts. Severity: **S0** catastrophic (data/money loss, breach, outage) · **S1** mission/build/CI failure · **S2** rollback/ordering gap · **S3** ambiguity. "Mitigation" names the wave/control that owns it. Codex re-verifies "Current state" against the live code at execution time (addresses are hints).

## PHASE A.5 Reconciliation
- Verified against PHASE A commit `ff8f96c4` on `stepup/main`.
- PHASE A added build/repo risks not present in the seeded matrix: duplicate migration prefix `129`, tracked `artifacts/shopify-ux/**`, active source/build dependencies on several V2 quarantine packages, deploy workflows that still deploy dormant marketplace apps, and pre-existing user-owned dirty edits in frozen auth paths.
- No new S0 lacks a named wave/control. New PHASE A drift is classified S1/S2 because it threatens build, migration, or governance correctness but is not itself a live money/tenancy cutover.

## Money
| Risk | Sev | Current state (evidence) | Mitigation |
|---|:--:|---|---|
| Balances zero on cutover (ledger never backfilled) | **S0** | balance reads mutable `wallet_ledger_entries`; ledger unpopulated for history (`routes/wallet.ts` `summarize`) | **Wave 1.1a** backfill + per-site reconciliation (≡, tol 0) before the read-flip; STOP on mismatch |
| `integer→bigint` lock/rewrite on live money tables | **S0** | `*_minor integer` in `migrations/119` | **Wave 1.8** EXPAND→CONTRACT only (§4.3) |
| Payout double-release / unfunded release | **S0** | no `FOR UPDATE`, no balance check (`routes/payouts.ts`) | **Wave 1.3** lock + balance check + idempotency + state guard |
| Spendable balance not authoritative | S1 | mutable single-entry table is truth, not the ledger | **Wave 1.1** read from `ledger_entries` |
| Capture never posts to ledger | S1 | `buildPaymentCaptureLedgerPosting` test-only (`packages/payments/src/index.ts`) | **Wave 1.2** wire capture→`pa_clearing` |
| Refunds not ledgered; partial refund corrupts state | S1 | `refund_clearing` dead (`routes/payments.ts`) | **Wave 1.5** refund→ledger + partial fix |
| Reconciliation can't detect a break (auto-plug) | S1 | imbalances absorbed into `reserve` (`billing-core`) | **Wave 1.7** stop auto-plug; alert on real breaks (soak first) |
| Fee/GST double-booked | S1 | settlement + commission both book (`payouts.ts`,`commission.ts`) | **Wave 1.6** remove double-book |
| `mock` payment marks orders paid in prod | S1 | `… || 'mock'` default (`routes/payments.ts`) | **Wave 1.9** kill default; reject in prod via `isProductionRuntime` |
| Fabricated payout UTR | S2 | adapter synthesizes `UTR…`, no provider call | **Wave 1.4** `PayoutProvider` (RazorpayX default), throws when no creds (CLASS-A SKIP), no fake fallback |
| Money-write inconsistency during balance-flip | S2 | live writes during cutover | **R-17** per-site consistency-verified flip |

## Auth / Identity / Security
| Risk | Sev | Current state | Mitigation |
|---|:--:|---|---|
| Shared secret forges identity AND authorizes money headers | **S0** | `INTERNAL_API_SECRET \|\| AUTH_SECRET` reused (`auth-core`), public gateway, no mTLS | **Wave 4** isolate+rotate secret; lock perimeter (default IP-allowlist); nonce/jti |
| Static `super_admin` god-token | S1 | `middleware/auth.ts` mints synthetic super_admin | **Wave 2/4** remove; per-principal admin identity |
| MFA enrolled-not-enforced; shared admin TOTP | S1 | `routes/auth.ts`; `admin-mfa-scaffold.ts` | **Wave 4** enforce MFA; per-principal TOTP |
| 30-day session, no idle/rotation/revocation | S2 | opaque bearer, `last_active` unused | **Wave 4** idle+rotation+reuse-detection+revocation |
| Customer storefront has no CSRF | S2 | SameSite=Lax only | **Wave 4/6** add CSRF tokens (customer realm) |
| Account-enumeration oracle (404 "user not found") | S3 | reset/intent flow (`routes/auth.ts`) | **Wave 4** uniform responses |

## Tenancy
| Risk | Sev | Current state | Mitigation |
|---|:--:|---|---|
| Incomplete tenant registry → silent IDOR | **S0** | "migrate hot routes then the rest" (unbounded) | **Wave 2.0** schema-derived exhaustive `tenant-tables.registry.ts` + gate |
| Service-role bypasses RLS (app path) | S1 | `getSupabaseUser` 0 call-sites; `USING(true)` policies | **Wave 2** fail-closed `tenantScoped`; drop `USING(true)` |
| `requireRole` trusts JWT claim | S1 | role read from token | **Wave 2** resolve server-side |
| New layer loosens an existing ownership check | S2 | migration risk | **Wave 2** add-then-migrate-then-ban; never loosen mid-flight |

## Theme / Design / Mobile
| Risk | Sev | Current state | Mitigation |
|---|:--:|---|---|
| Renderer↔registry enforcement blanks live stores | S1 | renderer ignores registry; strict mode could fail saved sections | **Wave 6** WARN→audit→ENFORCE; fallback placeholder, never blank |
| Design ratchet bricks CI on existing debt | S1 | 574 inline styles, 152 arbitrary radii pre-exist | **Wave 5** baseline-ratchet (fail on NEW only); debt burns down non-blocking |
| Flutter workspace breaks on quarantine/token-gen | S2 | operator/shopper apps + hand Dart colors | **Wave 7/5** verify Flutter build after changes |
| Liquid/extensions off in prod (silent capability loss) | S3 | `FEATURE_LIQUID/EXTENSIONS="false"` | **Wave 0** flag-truth doc; **Wave 6** Liquid decision = CLASS-A SKIP, default OFF + honest |

## Build / Migration / Repository
| Risk | Sev | Current state | Mitigation |
|---|:--:|---|---|
| Stale `file:line` → Codex edits wrong code | **S0→S1** | references days old; lines drift as edits land | **PHASE A** audit; **Directive 8** address-by-symbol |
| Quarantine breaks build / deploy filters | S1 | `runtime-composition` may have storefront edge use | **§4.4** DELETE→QUARANTINE→VERIFY→DELETE + 0-importer proof at HEAD |
| Quarantine targets are active dependencies at PHASE A | S1 | `IMPORT_GRAPH.md` shows 0-importer proof fails for `distributed-runtime`, `projection-runtime`, `orchestration`, `application-services`, `app-engine`, `extension-host`, and `runtime-composition`; service/mobile quarantine roots are also referenced by topology/manifests/tests | **Wave 7 / §4.4 / WAVE FINAL** rewire first, then fresh 0-importer proof, then quarantine; `runtime-composition` defaults KEEP-minimal unless real use is removed |
| Tracked generated artifacts remain source authority | S1 | `git ls-files artifacts build test-results .turbo .dart_tool node_modules` shows tracked `artifacts/shopify-ux/**` screenshots | **Wave 7 / §4.4** quarantine generated artifacts from source authority, update ignores, verify build/dependency gates; no history rewrite by Codex |
| Duplicate migration prefix can break replay/order assumptions | S1 | PHASE A found duplicate prefix `129`: `129_internal_os_executive_analytics_rollups.sql` and `129_mobile_customer_segments.sql` | **Wave 0 / migration safety gate** detect and report before new migrations; future migrations must use sequential unique prefixes and forward-only idempotent files |
| Migration not resumable / double-applied on restart | S1 | autonomous re-run risk | **§4.3** idempotent, existence-guarded, tested `down` |
| Validator reclassification drops a real gate | S2 | `gate`/`report` split | **Wave 0** never demote dependency validators; justify each |
| Acyclic graph broken by refactor | S2 | boundary risk | per-wave `validate:dependencies` checkpoint |
| `tsconfig.workspace.json` references missing package root | S2 | PHASE A found reference to `packages/typescript/utils` but no package manifest in that root | **Wave 0 / dependency graph gate** decide whether to restore the package authority or remove stale reference with build proof |
| Frozen path dirty before mission starts | S2 | Pre-existing unstaged edits in locked auth paths `apps/identity-platform/src/app/api/auth/switch/route.ts` and `apps/identity-platform/src/lib/auth/cookies.ts` | **Per-wave frozen-file check** do not stage these without explicit owner/override; final frozen audit must distinguish pre-existing user changes from Codex edits |

## Execution / Deployment / Process
| Risk | Sev | Current state | Mitigation |
|---|:--:|---|---|
| Autonomous prod deploy of money changes | **S0** | "do everything in one go" + `production-deploy.yml` edit | **Directive 7** no prod actions; prod apply = human `SKIP-DEPLOY` |
| Production workflows already run migrations/deploys if manually invoked | S1 | `ACTIVE_DEPLOYMENT_TOPOLOGY.md` shows `production-deploy.yml` pushes production migrations, sets Worker secrets, deploys Workers/Vercel, and runs smoke tests | **Directive 7 / Wave 3** Codex never invokes shared/prod workflows; produce `SKIP-DEPLOY` apply/verify/rollback runbooks only |
| Dormant marketplaces are still in production deploy topology | S2 | Production workflow deploys `app-marketplace` and `theme-marketplace` despite SSOT `KEEP-DORMANT`; staging deploy also includes both | **PHASE A baseline + Wave 7 cleanup** treat as topology drift; do not add investment; any deploy filter change requires build/deploy-filter proof |
| Context loss after hours of autonomous run | S1 | long single mission | **§4.5** STATUS state machine + resume marker; `FOUNDATION_EXECUTION_DASHBOARD.md` |
| No checkpoint → can't tell where a run stopped/failed | S1 | — | **§4.1** per-wave checkpoint + reports; dashboard updated per wave |
| Tests can't run → "prove it" skipped | S1 | money tests need a real Postgres | **§4.7** ephemeral Postgres fixture; STOP if it can't start |
| Branch isolation breaks cross-wave deps | S2 | one-go vs per-branch | **§HOW TO RUN** `stepup/main` integration branch |
| Frozen path edited accidentally | S2 | sacred territory | `FOUNDATION_REPO_LOCKS.md` + pre-commit frozen gate |
| Final-state debt introduced silently | S1 | refactors finish "green" but drift | **WAVE FINAL** `FOUNDATION_FINAL_AUDIT.md` vs PHASE A baseline |
| CLASS-B item SKIP'd instead of stopped | S1 | SKIP misuse | **§2** CLASS-A vs CLASS-B; STOP on CLASS-B |

## Summary
- **S0 (7):** ledger backfill, bigint ALTER, payout double-release, shared-secret forgery, tenant-registry completeness, prod-deploy, stale-line edits. All owned by a named control above.
- **No S0 is left to convention.** Every S0 has a hard STOP or a blocking gate in the V2 mission.
