# Runtime Ownership Blueprint & New Services (Deliverables 21, 24)

Settles which canonical runtime owns each apps-platform capability, the fate of each reserved service root, and the (small) list of genuinely new services. Constraint: `docs/governance/runtime-boundaries.md` remains authoritative; this doc proposes its apps-platform amendment.

---

## 1. Ownership Table (normative)

| Capability | Owner | Explicitly NOT owned by |
|---|---|---|
| App OAuth server, tokens, scopes enforcement | services/api-gateway (`app-store/oauth` module) | identity-platform (human auth only) |
| Consent & charge-approval UI | apps/merchant-control-plane | app-marketplace |
| App catalog UI | apps/app-marketplace | control-plane |
| Developer console UI | apps/developer-portal | platform-console |
| Review/moderation UI | apps/platform-console | developer-portal |
| Payout/KYC ops UI | apps/platform-operations-portal | platform-console |
| App/extension/version persistence + review state machine | api-gateway modules | any Next.js BFF |
| TAE validation pipeline | packages/app-engine (validators) invoked by gateway | theme-engine (provides liquid validators only) |
| Liquid engine, tags/filters/budgets | packages/theme-engine | storefront-runtime (consumer) |
| Frame/web-component hosting policy | packages/extension-host (single host used by admin + storefront) | hand-rolled iframes in apps |
| Placement/embed storage + release snapshot | api-gateway + theme release machinery | storefront request path |
| Storefront composition (manifest-driven) | apps/storefront-runtime | theme-engine |
| App asset CDN | services/media-service (activated) | storefront-runtime |
| Webhook delivery (app + merchant) | services/webhook-service | gateway (only outbox dispatch) |
| Domain event outbox + cron dispatch | services/api-gateway (status quo) | event-bus (until P9+) |
| Event fanout/replay-for-apps | services/event-bus (future charter) | webhook-service |
| Queue consumption (analytics/search/notifications) | services/queue-workers (consolidated consumers) | phantom services |
| Notifications (merchant/developer email) | packages/notification-core now → services/notification-service when charter funded | — |
| Checkout UI extensions host | services/checkout-runtime (P10+ charter) | storefront-runtime |
| Functions runtime | api-gateway isolate executor (P10+; NOT a new service) | — |
| App Bridge client SDK | packages/typescript/app-bridge (new package, not runtime) | — |
| Feature flags engine | packages/feature-flags (extracted from shared-types) | — |

## 2. Reserved Service Roots — Verdicts

| Root | Verdict | Charter |
|---|---|---|
| services/media-service | **ACTIVATE (P3)** | App/theme asset ingestion, R2 immutable paths, signed uploads, CDN headers — first real consumer of `letbuyy-media-*` buckets |
| services/event-bus | KEEP RESERVED (charter P9+) | Consumer-group fanout + event replay API for apps; until then outbox dispatch stays in gateway |
| services/checkout-runtime | KEEP RESERVED (charter P10+) | Checkout UI extension host + checkout DO coordination |
| services/notification-service | KEEP RESERVED | Materialize when notification volume justifies extraction from notification-core-in-gateway |
| services/search-service | RETIRE root OR charter with consumer | Search indexing consumer currently phantom (H4); decision owner: platform team — if retiring, governance PR updates runtime-boundaries + deletes queue bindings |
| services/analytics-pipeline | RETIRE root OR charter | Same as search; app analytics (doc 14 §5) could be its charter — pick one in P0 |

Rule going forward: a reserved root must carry `runtime.manifest.json` field `"incubation_review": "<date ≤ +2 quarters>"`; lapsed reviews fail governance validator (new validator added to scripts/validators/).

## 3. New Services To Build (Deliverable 21) — deliberately minimal
1. **media-service activation** (above) — the only new worker in P0–P8.
2. **No other new top-level services.** Everything else lands as gateway modules, packages, or app surfaces. Rationale: 6 stub roots already demonstrate the cost of premature service splitting; the bottleneck is product capability, not scale. Extraction triggers documented per module (e.g., oauth module extracts to identity-platform-adjacent worker if token QPS > 1k/s sustained).

## 4. New Packages
`@letbuyy/app-bridge` (client SDK: session token fetch, modal/toast/redirect actions, fetch wrapper) · `@letbuyy/feature-flags` (extracted, + targeting) · `@letbuyy/observability` (logger w/ redaction, request-id) · app-engine split into submodules (doc 09 D3) — same package, internal layout.

## 5. Governance Amendments Required (single PR, P0)
1. runtime-boundaries.md: add Ownership Table §1; reserved-root incubation rule §2.
2. Root AGENTS.md: Apps Platform section (OAuth owner, consent owner, extension pipeline owner); fix migration-count claim.
3. New validators: rls-policy lint (no USING(true) outside allowlist), service-role usage lint, reserved-root incubation check.
4. `node scripts/validate-governance.mjs` green required pre/post (CLAUDE.md rule) — gated in CI (doc 09 E2/E3).
