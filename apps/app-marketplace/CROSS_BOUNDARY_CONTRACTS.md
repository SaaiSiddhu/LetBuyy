# Apps Marketplace Cross-Boundary Contracts

All contracts are proposed by the app-marketplace task and require implementation outside `apps/app-marketplace/**`. Marketplace flags default off.

### CONTRACT C-005 — Earned Built for LetBuyy Badge Field
- Needed by issue(s): #5, #49
- Owner: parallel task (services+database+packages/shared-types)
- Capability: Expose a persisted, earned `built_for_letbuyy` boolean plus badge metadata on each marketplace app.
- Proposed interface: `MarketplaceApp { built_for_letbuyy?: boolean; trust_badges?: Array<{ code: string; label: string; earned_at: string; expires_at?: string | null }> }`.
- Marketplace flag: `NEXT_PUBLIC_MP_BUILT_FOR_LETBUYY` (default off)
- FE behavior when absent: Badge is hidden unless the field is explicitly `true`.
- Acceptance: A fixture app without the field renders no badge; a fixture with `built_for_letbuyy: true` renders the badge.
- Status: PROPOSED

### CONTRACT C-010 — Real Editorial Collections
- Needed by issue(s): #10, #27
- Owner: parallel task (services+database)
- Capability: Curated collections with membership and transparent labels.
- Proposed interface: `GET /v1/app-store/collections/:slug -> { collection, apps, total }`.
- Marketplace flag: `NEXT_PUBLIC_MP_COLLECTIONS` (default off)
- FE behavior when absent: Collection pages use truthful sort-based copy and disclose that live curation is unavailable.
- Acceptance: Staff picks return only explicitly curated apps.
- Status: PROPOSED

### CONTRACT C-017 — Usage Pricing Model Support
- Needed by issue(s): #17, #70, #71
- Owner: parallel task (database+services+packages/shared-types)
- Capability: Persist and bill usage-based app pricing with merchant approval.
- Implemented interface: Persist `usage` as the canonical usage-priced app model; the forward migration converts legacy `usage_based` rows.
- Marketplace flag: `NEXT_PUBLIC_MP_USAGE_PRICING` (default off)
- FE behavior: Usage pricing is offered in submit UI and shown as metered usage charges.
- Acceptance: A submitted usage-priced app round-trips through review, billing approval, and display without schema errors.
- Status: IMPLEMENTED

### CONTRACT C-004 — Backend Search Filter Injection Fix
- Needed by issue(s): #4, #77
- Owner: parallel task (services)
- Capability: Safe full-text search without raw PostgREST `.or()` interpolation.
- Proposed interface: `GET /v1/app-store/apps?search=<encoded>` sanitizes and ranks server-side across name, tagline, description, category, developer, and keywords.
- Marketplace flag: none
- FE behavior when absent: Marketplace sanitizes query input defensively before sending it, but treats backend fix as authoritative.
- Acceptance: Crafted query strings cannot alter filters, and ranked search tests cover punctuation, quotes, commas, parentheses, and percent signs.
- Status: PROPOSED

### CONTRACT C-077 — Full-Text and Synonym Search Ranking
- Needed by issue(s): #77
- Owner: parallel task (services+database)
- Capability: Ranked full-text search with keyword/synonym support and safe query parsing.
- Proposed interface: `GET /v1/app-store/apps?search=<query>` returns rank-ordered results plus optional `matched_terms` metadata; ranking belongs behind the gateway/search service, not the Next app.
- Marketplace flag: `NEXT_PUBLIC_MP_ADVANCED_SEARCH` (default off)
- FE behavior when absent: Marketplace uses sanitized basic query input and helpful empty-state suggestions only.
- Acceptance: Searches for common synonyms return relevant apps, punctuation cannot alter filters, and ranking behavior is covered by service tests.
- Status: PROPOSED

### CONTRACT C-007 — OAuth Install Readiness
- Needed by issue(s): #7, #30, #46, #74
- Owner: parallel task (services)
- Capability: Confirm marketplace OAuth authorize/token flow is ready for browser install, optional scopes, and future re-consent.
- Proposed interface: `POST /v1/app-store/apps/:id/oauth/authorize` accepts optional scope subsets and returns installation plus authorization; token exchange remains app-to-platform.
- Marketplace flag: `NEXT_PUBLIC_MP_OAUTH_INSTALL` (default off)
- FE behavior when absent: Legacy install endpoint remains available with the same explicit consent modal.
- Acceptance: With the flag enabled, installing an app creates an OAuth authorization and active installation without using the legacy direct-install path.
- Status: PROPOSED

### CONTRACT C-008 — Merchant Charge List and Plan Change Surface
- Needed by issue(s): #8, #70, #71, #72
- Owner: parallel task (services+database)
- Capability: List merchant-visible app charges and persist app plan/trial/annual/usage terms.
- Proposed interface: `GET /v1/app-store/installations/:id/charges`, `PATCH /v1/app-store/installations/:id/plan`, and persisted plan fields on marketplace apps.
- Marketplace flag: `NEXT_PUBLIC_MP_APP_BILLING_CHARGES` (default off)
- FE behavior when absent: Install consent shows price/trial terms and states that paid charges require approval, but charge list/change-plan UI is hidden.
- Acceptance: Merchant can view, approve, cancel, and change app charges from My Apps.
- Status: PROPOSED

### CONTRACT C-082 — Public Developer Profile Endpoint
- Needed by issue(s): #82, #83
- Owner: parallel task (services+packages/shared-types)
- Capability: Public developer profile fetch with verified profile fields and public apps.
- Proposed interface: `GET /v1/app-store/developers/:slug -> { developer, apps }`.
- Marketplace flag: `NEXT_PUBLIC_MP_DEVELOPER_PROFILES` (default off)
- FE behavior when absent: Developer profile route renders an honest unavailable shell.
- Acceptance: App detail developer links render a populated profile and other public apps from that developer.
- Status: PROPOSED

### CONTRACT C-020 — Category Counts
- Needed by issue(s): #20
- Owner: parallel task (services)
- Capability: Return app counts on `GET /v1/app-store/categories`.
- Proposed interface: `MarketplaceAppCategory.count: number`.
- Marketplace flag: none
- FE behavior when absent: Categories render without counts and fallback categories remain visible.
- Acceptance: Empty live categories are hidden when `count` is `0`.
- Status: PROPOSED

### CONTRACT C-024 — Full Rating Histogram
- Needed by issue(s): #24
- Owner: parallel task (services)
- Capability: Return full 1-5 star distribution independent of paginated review slice.
- Proposed interface: `GET /v1/app-store/apps/:id/reviews -> { data, total, histogram: {1:number,2:number,3:number,4:number,5:number} }`.
- Marketplace flag: none
- FE behavior when absent: Histogram is computed from loaded reviews only and labeled as loaded-review distribution.
- Acceptance: Detail page histogram matches all approved reviews.
- Status: PROPOSED

### CONTRACT C-027 — Featured and Sponsored Rails
- Needed by issue(s): #27
- Owner: parallel task (services+database)
- Capability: Explicit featured/editorial/sponsored app rails.
- Proposed interface: `GET /v1/app-store/featured?placement=home -> { data: MarketplaceApp[], label, sponsored: boolean }`.
- Marketplace flag: `NEXT_PUBLIC_MP_FEATURED_RAILS` (default off)
- FE behavior when absent: Featured rail hidden.
- Acceptance: Rail renders only explicitly returned apps and labels sponsored inventory.
- Status: PROPOSED

### CONTRACT C-028 — Post-Install App Configuration
- Needed by issue(s): #28
- Owner: parallel task (services)
- Capability: App-specific setup checklist and admin deep links.
- Proposed interface: `GET /v1/app-store/installations/:id/setup -> { checklist, deep_links }`.
- Marketplace flag: `NEXT_PUBLIC_MP_APP_CONFIG` (default off)
- FE behavior when absent: Install success links to My Apps only.
- Acceptance: Installed app shows actionable setup steps after install.
- Status: PROPOSED

### CONTRACT C-029 — Embedded App Launch Session
- Needed by issue(s): #29
- Owner: parallel task (services)
- Capability: Launch embedded apps through a signed session without unsafe third-party iframe privileges.
- Proposed interface: `POST /v1/app-store/installations/:id/embed-session -> { launch_url, session_token, expires_at, bridge_origin }`.
- Marketplace flag: `NEXT_PUBLIC_MP_EMBED_SESSION` (default off)
- FE behavior when absent: Embedded surfaces use the existing safe sandbox and do not enable `allow-same-origin` with `allow-scripts` for third-party content.
- Acceptance: Approved private activation uses a signed short-lived session and passes browser sandbox/security tests.
- Status: PROPOSED; public app activation remains frozen and human-approved.

### CONTRACT C-031 — Data Handling Disclosure Field
- Needed by issue(s): #31
- Owner: parallel task (database+packages/shared-types)
- Capability: Persist partner-provided data collection/retention disclosures.
- Proposed interface: `MarketplaceApp.data_handling`.
- Marketplace flag: none
- FE behavior when absent: Disclosure block hidden.
- Acceptance: App detail renders disclosure for populated apps.
- Status: PROPOSED

### CONTRACT C-032 — Support SLA Tracking
- Needed by issue(s): #32
- Owner: parallel task (services+database)
- Capability: Persist and measure support SLA signals.
- Proposed interface: `MarketplaceApp.support_sla` plus future measured response stats.
- Marketplace flag: none
- FE behavior when absent: SLA hidden.
- Acceptance: Listing renders SLA only for populated apps.
- Status: PROPOSED

### CONTRACT C-033 — Changelog / Release Notes Model
- Needed by issue(s): #33, #46
- Owner: parallel task (database+services)
- Capability: Versioned release notes.
- Proposed interface: `GET /v1/app-store/apps/:id/releases -> { version, notes, released_at }[]`.
- Marketplace flag: none
- FE behavior when absent: Changelog hidden unless passthrough fields are present.
- Acceptance: Detail page renders release notes in newest-first order.
- Status: PROPOSED

### CONTRACT C-046 — App Update, Versioning, and Re-Review
- Needed by issue(s): #2, #46, #47, #99
- Owner: parallel task (services+database)
- Capability: Update app listings, submit new versions, re-review scope changes, delist/archive.
- Proposed interface: `PATCH /v1/app-store/developers/apps/:id`, `POST /v1/app-store/developers/apps/:id/versions`, `POST /v1/app-store/developers/apps/:id/archive`.
- Marketplace flag: `NEXT_PUBLIC_MP_APP_UPDATE` (default off)
- FE behavior when absent: Edit/new-version/delist controls are disabled or unavailable.
- Acceptance: Published app updates create review records and require re-consent when scopes widen.
- Status: PROPOSED

### CONTRACT C-048 — Suspension Appeal
- Needed by issue(s): #48
- Owner: parallel task (services)
- Capability: Submit appeal for rejected/suspended apps.
- Proposed interface: `POST /v1/app-store/developers/apps/:id/appeals`.
- Marketplace flag: `NEXT_PUBLIC_MP_DEVELOPER_APPEALS` (default off)
- FE behavior when absent: Status messaging renders without appeal submission.
- Acceptance: Rejected/suspended app can create an appeal record.
- Status: PROPOSED

### CONTRACT C-050 — Developer KYC/GST Policy
- Needed by issue(s): #50
- Owner: human + parallel task (services+database)
- Capability: Human-approved KYC/GSTIN policy and verification state.
- Proposed interface: `MarketplaceAppDeveloper.kyc_status`, `gstin_verified`, payout eligibility reason.
- Marketplace flag: none
- FE behavior when absent: No verified-KYC claim is rendered.
- Acceptance: Payout surfaces show only verified status from backend.
- Status: PROPOSED

### CONTRACT C-053 — Multi-Currency Pricing
- Needed by issue(s): #53
- Owner: parallel task (services+database+packages/shared-types)
- Capability: Currency-aware app pricing.
- Proposed interface: `MarketplaceApp.prices: Array<{ currency, interval, amount_minor }>` and currency negotiation.
- Marketplace flag: `NEXT_PUBLIC_MP_MULTI_CURRENCY` (default off)
- FE behavior when absent: INR is used.
- Acceptance: Non-INR stores see correct localized prices.
- Status: PROPOSED

### CONTRACT C-066 — Review Moderation and Reports
- Needed by issue(s): #66, #81
- Owner: parallel task (services+database)
- Capability: Report reviews/listings and expose moderation queue.
- Proposed interface: `POST /v1/app-store/apps/:id/reports`, `POST /v1/app-store/reviews/:id/reports`.
- Marketplace flag: `NEXT_PUBLIC_MP_REVIEW_MODERATION` (default off)
- FE behavior when absent: Report controls are visible as unavailable, with no fake submission.
- Acceptance: Reports create moderation records with actor/store context.
- Status: PROPOSED

### CONTRACT C-040 — Extension Configuration Endpoint
- Needed by issue(s): #40
- Owner: parallel task (services)
- Capability: Read and update extension/function registrations for installed apps without adding app-local Next API routes.
- Proposed interface: `GET /v1/app-store/installations/:id/extensions`, `PATCH /v1/app-store/installations/:id/extensions/:extension_id`, `PATCH /v1/app-store/installations/:id/functions/:function_id`.
- Marketplace flag: `NEXT_PUBLIC_MP_EXTENSION_CONFIG` (default off)
- FE behavior when absent: Extension configuration panel renders an honest unavailable state.
- Acceptance: Merchant can view and update app extension settings through gateway-owned routes.
- Status: PROPOSED

### CONTRACT C-075 — Compatibility / Works With
- Needed by issue(s): #75, #76
- Owner: parallel task (database+packages/shared-types)
- Capability: Multiple category tags and compatibility fields.
- Proposed interface: `MarketplaceApp.works_with: string[]`, `category_tags: string[]`.
- Marketplace flag: `NEXT_PUBLIC_MP_WORKS_WITH` (default off)
- FE behavior when absent: Works-with/tags hidden unless passthrough fields exist.
- Acceptance: Detail page renders all tags without relying on single `category_id`.
- Status: PROPOSED

### CONTRACT C-080 — App Demo Video Field
- Needed by issue(s): #80
- Owner: parallel task (media-service+database)
- Capability: Approved demo video URL.
- Proposed interface: `MarketplaceApp.video_url`.
- Marketplace flag: none
- FE behavior when absent: Video section hidden.
- Acceptance: Detail page renders controls for approved videos only.
- Status: PROPOSED

### CONTRACT C-085 — Marketplace Notifications
- Needed by issue(s): #85
- Owner: parallel task (services+database)
- Capability: Merchant/developer marketplace notification inbox.
- Proposed interface: `GET /v1/app-store/notifications`, `PATCH /v1/app-store/notifications/:id/read`.
- Marketplace flag: `NEXT_PUBLIC_MP_APP_NOTIFICATIONS` (default off)
- FE behavior when absent: Inbox hidden.
- Acceptance: Review decisions, installs, charges, and new reviews create notifications.
- Status: PROPOSED

### CONTRACT C-086 — App Activity Log
- Needed by issue(s): #86
- Owner: parallel task (services+database)
- Capability: Store-scoped app activity events.
- Proposed interface: `GET /v1/app-store/installations/:id/activity`.
- Marketplace flag: `NEXT_PUBLIC_MP_APP_ACTIVITY` (default off)
- FE behavior when absent: Activity hidden.
- Acceptance: My Apps renders signed app activity with timestamps and actor/app context.
- Status: PROPOSED

### CONTRACT C-087 — Uninstall Reason Persistence
- Needed by issue(s): #87
- Owner: parallel task (services+database)
- Capability: Persist uninstall reason.
- Proposed interface: `DELETE /v1/app-store/apps/:id/install { reason?: string }`.
- Marketplace flag: none
- FE behavior when absent: Existing uninstall confirmation remains.
- Acceptance: Reason is stored and available to partners/ops.
- Status: PROPOSED

### CONTRACT C-088 — Rate-Limit Visibility
- Needed by issue(s): #88
- Owner: parallel task (services)
- Capability: Document and expose app API rate-limit headers.
- Proposed interface: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- Marketplace flag: none
- FE behavior when absent: No rate-limit claims rendered.
- Acceptance: Docs and app API responses expose consistent limits.
- Status: PROPOSED

### CONTRACT C-089 — Catalog CDN/Cache Contract
- Needed by issue(s): #89
- Owner: parallel task (services+infrastructure)
- Capability: Public catalog cache semantics and CDN headers.
- Proposed interface: cache headers on `GET /v1/app-store/apps`, `/categories`, app detail.
- Marketplace flag: `NEXT_PUBLIC_MP_CATALOG_CDN` (default off)
- FE behavior when absent: Next pages declare best-effort revalidate but no CDN claim is shown.
- Acceptance: Public catalog responses include cache headers and purge strategy.
- Status: PROPOSED

### CONTRACT C-091 — Marketplace Telemetry Sink
- Needed by issue(s): #91
- Owner: parallel task (services+observability)
- Capability: Persist discovery-to-install funnel events.
- Proposed interface: `POST /v1/app-store/telemetry/events`.
- Marketplace flag: `NEXT_PUBLIC_MP_TELEMETRY` (default off)
- FE behavior when absent: Client telemetry hook is no-op.
- Acceptance: Search/detail/consent/install/review events are correlated by request/session/store.
- Status: PROPOSED

### CONTRACT C-092 — Experiment Assignment
- Needed by issue(s): #92
- Owner: parallel task (services)
- Capability: Stable experiment assignment and exposure logging.
- Proposed interface: `GET /v1/app-store/experiments`.
- Marketplace flag: `NEXT_PUBLIC_MP_EXPERIMENTS` (default off)
- FE behavior when absent: All experiments disabled.
- Acceptance: Assignment is stable per merchant/store and logged.
- Status: PROPOSED

### CONTRACT C-093 — Environment Catalog Parity
- Needed by issue(s): #93
- Owner: parallel task (services+database)
- Capability: Staging/production catalog parity checks.
- Proposed interface: environment catalog health endpoint or governance report.
- Marketplace flag: none
- FE behavior when absent: Status file records contract only.
- Acceptance: CI/governance reports mismatched catalog prerequisites.
- Status: PROPOSED

### CONTRACT C-094 — Private App Distribution
- Needed by issue(s): #94
- Owner: parallel task (services+database)
- Capability: Private install links with scoped access.
- Proposed interface: `POST /v1/app-store/developers/apps/:id/private-install-link`.
- Marketplace flag: `NEXT_PUBLIC_MP_PRIVATE_DISTRIBUTION` (default off)
- FE behavior when absent: Submit form labels private distribution as contract-gated.
- Acceptance: Private links install only into authorized stores.
- Status: PROPOSED

### CONTRACT C-095 — Developer Team Roles
- Needed by issue(s): #95
- Owner: parallel task (services+database)
- Capability: Partner team members and roles.
- Proposed interface: `GET/POST /v1/app-store/developers/team`.
- Marketplace flag: none
- FE behavior when absent: No team role UI rendered.
- Acceptance: Developers can invite/manage scoped team members.
- Status: PROPOSED

### CONTRACT C-096 — Developer 2FA / Security Settings
- Needed by issue(s): #96
- Owner: parallel task (auth/services)
- Capability: Developer account security settings and 2FA enforcement.
- Proposed interface: auth-owned security settings endpoint.
- Marketplace flag: none
- FE behavior when absent: No 2FA claim rendered.
- Acceptance: Sensitive partner actions require enforced 2FA.
- Status: PROPOSED

### CONTRACT C-001 — Launch Catalog Seed
- Needed by issue(s): #1, #65
- Owner: human + parallel task (database)
- Capability: Human-approved launch partner app catalog seed with active install-count semantics.
- Proposed interface: governed seed data for `marketplace_apps`, `app_categories`, media, and partner rows.
- Marketplace flag: none
- FE behavior when absent: Empty states remain honest.
- Acceptance: Seeded apps are real, approved, and legally cleared.
- Status: PROPOSED

### CONTRACT C-003 — Revenue Share Policy
- Needed by issue(s): #3
- Owner: human + parallel task (services)
- Capability: Single approved revenue-share rate and backend default.
- Proposed interface: config-backed `revenue_share_bps` policy with docs.
- Marketplace flag: none
- FE behavior when absent: UI avoids hardcoded commission rates.
- Acceptance: UI, docs, billing defaults, and payout ledger agree.
- Status: PROPOSED

### CONTRACT C-006 — Real Review Gates
- Needed by issue(s): #6, #45
- Owner: parallel task (services+operations)
- Capability: Executed review checks rather than rubber-stamped checks.
- Proposed interface: automated check results for manifest, scopes, URLs, TLS, GDPR webhooks, static/dependency scan.
- Marketplace flag: none
- FE behavior when absent: Review page lists preparation items and human-policy skip.
- Acceptance: Review record passes only when checks actually run and pass.
- Status: PROPOSED

### CONTRACT C-014 — Media Upload
- Needed by issue(s): #14
- Owner: parallel task (media-service+services)
- Capability: Upload icons, screenshots, and videos for app listings.
- Proposed interface: signed upload route returning approved media IDs/URLs.
- Marketplace flag: none
- FE behavior when absent: Submit upload zones remain informational; detail placeholders remain honest.
- Acceptance: Approved media appears on listing detail and sitemap metadata.
- Status: PROPOSED

### CONTRACT C-015 — Per-App Analytics
- Needed by issue(s): #15
- Owner: parallel task (services+observability)
- Capability: Per-app installs, funnel, churn, revenue, ratings trend.
- Proposed interface: `GET /v1/app-store/developers/apps/:id/analytics`.
- Marketplace flag: none
- FE behavior when absent: Dashboard shows aggregate partner analytics only.
- Acceptance: Manage panel renders per-app analytics from backend.
- Status: PROPOSED

### CONTRACT C-016 — App Health and API Usage
- Needed by issue(s): #16
- Owner: parallel task (services+observability)
- Capability: API usage, error rate, p95 latency, webhook health.
- Proposed interface: `GET /v1/app-store/developers/apps/:id/health`.
- Marketplace flag: none
- FE behavior when absent: No health claims rendered.
- Acceptance: Health metrics power trust gates and partner dashboard.
- Status: PROPOSED

### CONTRACT C-023 — Developer Reply to Reviews
- Needed by issue(s): #23
- Owner: parallel task (services+database)
- Capability: Developer replies to reviews.
- Proposed interface: `POST /v1/app-store/reviews/:id/replies`.
- Marketplace flag: none
- FE behavior when absent: Reply UI hidden.
- Acceptance: Approved replies render under reviews with moderation state.
- Status: PROPOSED

### CONTRACT C-041 — Webhook CRUD
- Needed by issue(s): #41
- Owner: parallel task (services+database)
- Capability: Developer webhook management UI backing endpoints.
- Proposed interface: `GET/POST/PATCH/DELETE /v1/app-store/developers/apps/:id/webhooks`.
- Marketplace flag: none
- FE behavior when absent: Webhook UI hidden.
- Acceptance: Developers can register and test webhooks.
- Status: PROPOSED

### CONTRACT C-042 — Development Store Provisioning
- Needed by issue(s): #42
- Owner: parallel task (services)
- Capability: Provision developer test stores.
- Proposed interface: `POST /v1/app-store/developers/development-stores`.
- Marketplace flag: none
- FE behavior when absent: Dashboard only lists existing development stores.
- Acceptance: Partner can create a managed development store.
- Status: PROPOSED

### CONTRACT C-067 — Payout Statements
- Needed by issue(s): #67
- Owner: parallel task (services+database)
- Capability: Downloadable payout statements.
- Proposed interface: `GET /v1/app-store/partners/payout-statements`.
- Marketplace flag: none
- FE behavior when absent: Payout ledger remains summary-only.
- Acceptance: Partner can view/download monthly statements.
- Status: PROPOSED

### CONTRACT C-068 — GST Invoices
- Needed by issue(s): #68
- Owner: parallel task (services+database)
- Capability: GST invoice generation for partner payouts/fees.
- Proposed interface: `GET /v1/app-store/partners/gst-invoices`.
- Marketplace flag: none
- FE behavior when absent: No invoice claims rendered.
- Acceptance: GST invoices match ledger entries.
- Status: PROPOSED

### CONTRACT C-069 — App Billing Refunds
- Needed by issue(s): #69
- Owner: parallel task (payments/services)
- Capability: App charge refunds and disputes.
- Proposed interface: `POST /v1/app-store/charges/:id/refunds`.
- Marketplace flag: none
- FE behavior when absent: Refund UI hidden.
- Acceptance: Refund updates charge, payout, and merchant bill state idempotently.
- Status: PROPOSED

### CONTRACT C-072 — App Billing Proration
- Needed by issue(s): #72
- Owner: parallel task (payments/services)
- Capability: Prorate plan changes.
- Proposed interface: plan-change API returns proration preview and approved charge.
- Marketplace flag: none
- FE behavior when absent: Plan change UI hidden.
- Acceptance: Upgrades/downgrades calculate server-side proration.
- Status: PROPOSED

### CONTRACT C-084 — Public Partner Directory Endpoint
- Needed by issue(s): #84
- Owner: parallel task (services+database)
- Capability: Searchable public directory of approved app partners.
- Proposed interface: `GET /v1/app-store/partners?search=&page=&limit= -> { data, total, page, limit }`.
- Marketplace flag: `NEXT_PUBLIC_MP_PARTNER_DIRECTORY` (default off)
- FE behavior when absent: Directory route renders an unavailable shell and no fake partners.
- Acceptance: Directory lists only approved/verified public partners and paginates.
- Status: PROPOSED

### CONTRACT C-044 — Published Developer Docs Availability
- Needed by issue(s): #44
- Owner: human/platform docs
- Capability: Confirm production docs exist at `https://docs.letbuyy.com/apps` and `https://docs.letbuyy.com/api`.
- Proposed interface: Human-owned docs publication and link verification.
- Marketplace flag: none
- FE behavior when absent: Links point to canonical docs paths without claiming availability.
- Acceptance: Production docs URLs return 200 and contain app submission, OAuth, billing, extension, and review guidance.
- Status: PROPOSED
