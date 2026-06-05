# Partner Platform Architecture (Phase 14)

Target: Shopify-Partner-Dashboard-grade developer platform. Strategy: **the backend half-exists** (`/v1/app-store/developers/*`, `/partners/*` live in gateway); the work is orgs/teams data model, credentials, and building `apps/developer-portal` (currently a ~10-file shell) into the console.

---

## 1. Organization & Team Model

```
partner_orgs        (id, name, slug, country, payout_profile jsonb, tier: standard|plus, status)
partner_org_members (org_id, user_id, role: owner|admin|developer|finance|readonly, invited_by, status)
app_developers      (existing, baseline:8311) → becomes legacy alias: backfill each row into partner_orgs
                     (company_name→name) + owner membership; keep column-compat view during migration
collaborator_access (org_id, store_id, scopes[], status)  ← formalizes existing POST /partners/collaborator-code
```
RBAC: extend auth-core role categories (`partner` exists) with org-scoped membership checks in gateway middleware; `requireRoleCategory('partner')` (app-store.ts:2369) upgraded to `requireOrgRole(orgId, roles…)`.

## 2. Apps & Credentials
- App ownership moves `developer_id → org_id`.
- Credentials: `oauth_clients` per app (doc 10 §3) with secret rotation (two active secrets, staged rollover) + `api_keys` for Partner-API automation (CI deploys of extensions).
- Dev/test stores: `sites.site_kind='development'` flag — free, order-capped, watermarked storefront; created from portal; installable with draft app versions (pre-review testing). This is the single highest-leverage missing dev tool.

## 3. Developer Portal (apps/developer-portal build-out)

| Section | Backing API (exists ✓ / new ✷) |
|---|---|
| Dashboard (installs, MRR, alerts) | ✓ `GET /partners/dashboard` + ✷ analytics |
| Apps list/create | ✓ `GET/POST /developers/apps` |
| App settings (URLs, redirect URIs, scopes) | ✷ `PATCH /developers/apps/:id` |
| Credentials (client id/secret, rotate; API keys) | ✷ |
| Versions & extensions (upload TAE, validation report, submit) | ✷ versions endpoints (doc 14 §6) |
| Webhooks debugger (deliveries log, payload preview, redrive) | ✷ `GET /developers/apps/:id/webhook-deliveries`, `POST …/redrive` — data already in `webhook_deliveries` |
| Billing & payouts (statements, ledger) | ✷ over `partner_payout_ledger_entries` |
| Team & org management | ✷ org endpoints |
| Collaborator stores | ✓ collaborator-code + ✷ list/revoke |
| Logs & usage (API calls, rate-limit status) | ✷ from gateway rate-limit counters |
| Docs | static; generated scope/topic catalogs from shared-types (single source) |

UX parity notes: validation reports must be actionable (file+line from doc 11 validators); webhook debugger is the #1 retention feature for app devs.

## 4. Partner API & CLI
- Partner API: token = `api_keys`; endpoints: app CRUD, version upload, validation status, dev-store create, metrics export. Versioned under `/v1/partner/*` (new router beside app-store).
- CLI (`@letbuyy/cli`, roadmap P10): `login` (device code via identity-platform), `app create/dev/deploy`, `extension dev` (local liquid render preview using theme-engine in Node — engine already isomorphic), `webhook trigger` (sandbox deliveries). Until CLI ships, portal upload is the path; design APIs CLI-first so portal consumes the same Partner API.

## 5. Monitoring & Quotas (platform-protective)
- Per-org quotas: apps (20), draft versions (10/app/day), dev stores (5), API rate tier by org tier.
- Abuse controls: org-level suspension cascades (listings suspended, tokens revoked, extensions edge-killed); duplicate-app fingerprinting at submission.
- SLO surfacing: webhook delivery success %, median review turnaround — public on portal status page (trust).

## 6. Payouts
Monthly cycle: ledger close → statement PDF (notification-core email) → payout via Razorpay Route (env vars `RAZORPAY_ROUTE_*` already in templates — currently unused; this is their consumer) → `payout.released|failed` events → portal status. KYC: payout blocked until org payout_profile verified (manual ops in platform-operations-portal v1; `app_developers.verified` flag finally gets a writer — fixes M12).
