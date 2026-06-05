# Error & Misconfiguration Report (Phase 7)

System-wide defects discovered during forensic analysis, ranked by severity. IDs are stable for cross-referencing from the roadmap (doc 21). “Verified” = directly confirmed in code this audit; “Reported” = found by scan agents, single-source.

---

## CRITICAL (exploitable or platform-breaking)

| ID | Issue | Evidence | Impact | Fix direction |
|---|---|---|---|---|
| C1 | 50 permissive RLS policy lines (`CREATE POLICY … USING (true)`), incl. `app_installations` (baseline:26324), `products` service-role (26436), `sessions`/`users_custom`/`devices`/`verification_tokens`/`customer_credentials` (23639-23674) | Verified (grep count 2026-06-05) | Any service-role-context bug = cross-tenant read/write of installs, sessions, credentials | Replace with tenant-scoped policies; service role only via dedicated RPCs |
| C2 | Service-role Supabase key available to entire gateway runtime (`Env.SUPABASE_SERVICE_ROLE_KEY`, api-gateway/src/index.ts:52) and used broadly | Verified | RLS bypass by construction across 28 routers | Per-route scoped clients; service-role confined to outbox/webhook internals |
| C3 | OAuth tokens/auth codes stored as hashes inside `app_installations.config` JSONB; no expiry sweep, rotation, revocation list, or audit | Verified (app-store.ts:126,1286-1288,1667,1820) | Token compromise unbounded in time; revocation requires config surgery; no forensics | Dedicated `oauth_tokens`/`api_keys` tables (doc 16) |
| C4 | Webhook signing secrets stored plaintext (`webhook_subscriptions.signing_secret` baseline:13049; `app_webhooks.secret` :8391) | Verified | DB read = forge all app/merchant webhooks | Hash-at-rest + show-once issuance |
| C5 | No request-time scope enforcement for app tokens; auth middleware has no app-token identity class | Verified (middleware/auth.ts paths: internal SSO + Supabase JWT only) | Any bearer accepted at bridge level gets whatever route allows; scopes are decorative | Scope→route map middleware (doc 17) |
| C6 | App iframe sandbox `allow-scripts` + `allow-same-origin` together (composition-engine.tsx iframe branch) | Verified | Same-origin framed doc can lift its own sandbox → storefront XSS | Serve frames cross-origin or drop allow-same-origin |

## HIGH

| ID | Issue | Evidence | Impact |
|---|---|---|---|
| H1 | 6/9 services are manifest-only stubs (analytics-pipeline, checkout-runtime, event-bus, media-service, notification-service, search-service) | Verified (dir listings) | Topology theater; responsibilities silently live in api-gateway/queue-workers; capacity & ownership planning corrupted |
| H2 | Webhook registry semantics undocumented (`app_webhooks` = app-level definitions; expanded at install into per-store `webhook_subscriptions` via `planAppWebhookSubscriptions`, app-engine:1420-1445) with secret stored in **both** tables; plus true dual review tables (`app_reviews` vs `marketplace_review_records`) | Verified (baseline 8391/13049, 8368/9736; expansion path verified) | Secret duplication; split-brain risk on definition edits post-install; duplicated moderation data |
| H3 | `app_installations.store_id` nullable, no FK to `sites`; missing FK `marketplace_apps→app_developers` | Reported (schema scan) | Orphaned installs; integrity unenforced |
| H4 | Declared queue consumers missing: ANALYTICS_QUEUE / SEARCH_QUEUE / NOTIFICATION_QUEUE have no found consumer code | Reported | Events accepted then dropped; silent data loss |
| H5 | Marketplace service layers swallow backend failures → empty catalogs (app-service.ts:48-56; theme-service.ts:18-23) | Verified | Outages invisible; merchants see "no apps" |
| H6 | Embedded-app chain lacks a developer-facing half: admin host page **exists** (`EmbeddedAppBridgeClient.tsx`, 267 lines, consumes extension-host, mounted at `[store]/apps/[installationId]/page.tsx`) but there is no published client App Bridge SDK, no documented postMessage/session-token contract, and no e2e test of the chain | Verified (host found on re-check; SDK absent) | Third-party devs cannot integrate without reverse-engineering the protocol; chain unproven e2e |
| H7 | PayPal inbound webhook in storefront-runtime (`api/payments/paypal/webhook/route.ts`) vs gateway-owns-API rule; Stripe/Razorpay correctly in webhook-service | Verified | Boundary violation; uneven signature/ops handling |
| H8 | No per-store or per-app rate limiting (only global 300/min/user; rateLimit.ts) ; no caps on webhook subscription count | Verified | Noisy-neighbor + fanout DoS |
| H9 | Install/uninstall lack idempotency keys & double-submit protection (app-store.ts:1943,2129; marketplace route) | Verified | Duplicate installs/charges on retry |
| H10 | CI-gate truth drift: LETBUYY_STATE.md reports `typecheck` failing (Cloudflare worker types) and governance failing — **governance re-tested 2026-06-05 and passes (128 validators)**; typecheck failure unverified by this audit. Action: re-run `pnpm typecheck` repo-wide, fix or update the state doc, make both gates blocking | Partially verified | Stale red/green signals → gates distrusted → regressions ship |
| H11 | Extension registry status not consulted by storefront render path (revoked extensions still render if placement exists) | Verified (template-resolver/composition read placements only) | Kill switch ineffective |
| H12 | `MANDATORY_COMPLIANCE_WEBHOOK_TOPICS` auto-merged into every install's subscription `event_types` (`planAppWebhookSubscriptions`, app-engine:1428-1434) — but the platform never **verifies the app actually handles them** (no challenge delivery at submission/review, no failure escalation) | Verified (auto-subscribe confirmed; verification absent) | Compliance topics delivered into the void; GDPR-equivalent flows unproven |

## MEDIUM

| ID | Issue | Evidence |
|---|---|---|
| M1 | 97 `console.*` statements across 58 active files incl. auth/checkout paths (storefront api routes, app-marketplace api routes, `packages/typescript/utils/src/auth.ts`) | Verified (grep 2026-06-05) |
| M2 | Hardcoded staging fallback `DEFAULT_API_BASE_URL='https://api.staging.letbuyy.store'` (app-marketplace client.ts:14) | Verified |
| M3 | Per-request Liquid engine instantiation, `cache:false` (theme-renderer.ts:230) | Verified |
| M4 | Demo-store hardcode in prod path (`isUrbanKicksDemoSubdomain`, store-service.ts:55-56) | Verified |
| M5 | Webhook secret accepted via client POST body on install (marketplace install route:21) | Verified |
| M6 | No audit logging on app install/uninstall/scope changes; flag audit table mutable | Reported |
| M7 | Tenant resolution implemented 3× (auth middleware, store-context, tenant lib) | Reported |
| M8 | Sequential storefront data fetch before render (data-binding-engine.ts:46-84) | Verified |
| M9 | `developer-portal` shell (10 files) vs live partner endpoints — capability gap presented to developers | Verified |
| M10 | No app/extension/version tables (`app_versions`, `theme_app_extensions`, `app_assets`) | Verified absent |
| M11 | 18% tax hardcoded in invoice creation (webhook-service:655-670) | Verified |
| M12 | `verified` flag on app_developers never set true anywhere | Reported |
| M13 | Missing composite indexes: `webhook_subscriptions(site_id,status)`, `app_installations(store_id,status)` | Reported |
| M14 | No CSRF tokens on mutating admin routes (double-submit absent) | Reported |
| M15 | Env vars defined but unused (`PLATFORM_CONSOLE_TOTP_SECRET`, `PAYMENT_CONFIG_ENCRYPTION_KEY` w/o encryption code) ; Env iface vars absent from templates (`PRIMARY_REGION`,`FAILOVER_REGION`) | Reported |
| M16 | Stale root docs contradict code in both directions (see doc 02 §11) — governance memory drift | Verified |
| M17 | Operator mobile app = stock Flutter counter (`apps/mobile/operator-app/lib/main.dart`); shopper-app manifest-only | Verified |
| M18 | No uninstall data-purge job / retention policy for app-held merchant data | Verified absent |

## LOW

| ID | Issue |
|---|---|
| L1 | 73 root-level .md files (~12.8K LOC) — superseded ledgers/wave reports belong in docs/archive/ |
| L2 | 12 TODO/FIXME hotspots (ops-portal scaffolds, SubscribeCheckoutClient, 3 gateway routes) |
| L3 | Dead in-scope files: `app-marketplace/src/lib/marketplace-display.ts`, `src/proxy.ts` (no inbound imports) |
| L4 | ~15–20 orphaned ops/telemetry tables (purchase_orders*, restock_events, regional_routing_overrides, provider_health_snapshots, query_snapshots, deployment_* …) defined, never queried |
| L5 | `AGENTS.md` count drift ("65 migrations" vs 7 files post-squash) |
| L6 | Webhook event/glob naming not centrally documented for developers |
| L7 | `LiquidHydrationIslands` implementation file not co-located/found in package (declared in theme-bundle.ts:30-51) — wiring opacity |

## Misconfiguration Checklist (Phase 7 enumerations)
- **Missing registrations:** app embeds (none), `@app` block acceptance in theme sections, checkout/admin extension hosts, queue consumers (H4), app-block picker in editor.
- **Missing events:** `app.scope_updated`, `app.token.revoked`, `app_block.placed/removed`, `payout.*` producers.
- **Missing webhooks enforcement:** compliance topics at submission (H12); delivery dashboard for developers.
- **Missing permissions:** scope catalog + route map (C5); webhook-topic↔scope binding.
- **Missing APIs:** app-token-auth admin API, app proxy, usage-record ingestion, token rotation/revocation, placement CRUD.
- **Missing scopes:** none defined canonically — free strings only.
- **Missing runtime contracts:** placement snapshot in release manifest; extension version pinning; app data-binding declaration.
- **Missing DB relations:** H3 set; `oauth_tokens`, `api_keys`, `app_versions`, `app_subscriptions`, `app_usage_records`, `theme_app_extensions`, `app_assets`, `partner_orgs/members`.
- **Missing env/flags:** M15; no flag targeting/exemptions (percentage-only, shared-types:1951-2027).
- **Missing ownership rules:** which runtime owns app OAuth (gateway today) and consent UI (nobody) — codify in runtime-boundaries.md.
