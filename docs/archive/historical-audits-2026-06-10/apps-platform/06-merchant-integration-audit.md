# App ↔ Merchant App Integration Audit (Phase 6)

Scope: merchant-control-plane (174 files), identity-platform (51), developer-portal (10), platform-console (31), platform-operations-portal (24) — apps-platform surfaces only.

---

## 1. Merchant Admin Surfaces for Apps

| Surface | Path | State |
|---|---|---|
| Installed apps list / app settings | `apps/merchant-control-plane/src/app/[store]/settings/apps/page.tsx` + `AppsSettingsClient.tsx` | UI present; backed by `GET /v1/app-store/installations` |
| App store browsing | delegated to `apps/app-marketplace` (separate origin `apps.letbuyy.store`) | Cross-app handoff; no embedded store-in-admin |
| Install consent (scopes) screen | **not found** in admin scans | Install POST carries scopes but no rendered consent artifact |
| Embedded app viewport | **Exists**: `src/components/apps/EmbeddedAppBridgeClient.tsx` (267 lines; extension-host import, iframe + postMessage bridge, bearer-token injection at :141) mounted at `[store]/apps/[installationId]/page.tsx`; gateway endpoints embed-session/token-exchange/bridge-fetch back it | Functional host; gaps = no app-developer SDK, undocumented protocol, no e2e test |
| App billing approval | gateway `POST /charges/:id/approve` exists | No admin UI surface found for pending-charge approval |
| Theme editor | drafts/publish/preview/rollback wired (theme-engine schemas; control-plane is the editor owner per docs) | No app-block management inside editor |
| Plan/subscription (platform billing) | `settings/plan/page.tsx`, `settings/subscribe/checkout/` + `SubscribeCheckoutClient.tsx` (has TODO) | Merchant SaaS billing real; separate from app billing |

**Net:** merchant admin can list apps, install them (via marketplace app), and render embedded apps in a working bridge host; it still cannot fully **operate** them: no consent UX, no charge-approval UI, no app-block placement UI, no webhook/diagnostics view, no uninstall-with-data-retention prompt.

## 2. Admin APIs & Auth Path
- All admin traffic: app → `@letbuyy/api-client` → gateway `/v1/*` with internal SSO headers (`X-LetBuyy-Internal-*`, HMAC w/ `AUTH_SECRET`, middleware/auth.ts:64-99) or Supabase JWT.
- RBAC: 5 roles (auth-core:43-90); partner endpoints gated `requireRoleCategory('partner')`.
- **Gap — third identity class:** no `Authorization: Bearer <app_token>` path in auth middleware; apps cannot call admin APIs server-to-server with their scoped token (tokens are only checked inside `bridge/fetch`). Until the middleware recognizes app tokens + maps scopes→routes, "app with read_products scope calls GET /v1/products" does not exist.

## 3. Identity-Platform Role
- Owns human auth (login/signup/OTP/reset; 18 auth route files), session cookies consumed by all admin apps.
- Does **not** host app OAuth (that's gateway app-store.ts) — acceptable split, but consent UI naturally belongs here or in control-plane; currently nowhere.
- Auth logic split app/worker flagged in root audits (medium): rate limits on auth endpoints not verified in identity app routes.

## 4. Developer Portal & Platform Consoles
- `developer-portal`: ~10 files; landing-tier shell. Meanwhile gateway already serves `developers/me|register|apps (GET/POST)`, `partners/dashboard`, `partners/collaborator-code` — **backend ahead of frontend**; biggest cheap win is building the console onto live endpoints.
- `platform-console` (31 files) / `platform-operations-portal` (24 files): admin auth (`console-auth-server.ts`, allowed-emails + TOTP env vars), internal-console gateway routes exist; **no app-review queue, listing moderation, or payout ops UI found**; ops portal pages carry 5 TODOs (scaffold).
- `marketplace_apps.status` and `theme.submitted/approved/rejected` events imply a review pipeline that has no operator tooling.

## 5. Installation Flow Trace (merchant POV) & Defects
1. Merchant on apps.letbuyy.store clicks install → app-marketplace `POST /api/apps/[id]/install` (body: `store_id`, `scopes`, `config`, optional `webhook_url/event/secret`).
2. Marketplace route forwards with merchant session → gateway install (1943) writes installation + oauth config + webhooks + registry rows.
3. Redirect/UX back to admin: not standardized (no `return_url` contract found).

Defects: client-supplied `store_id` (server must derive from session-store binding — currently trusts backend check, unverified); no idempotency key (double-install risk); webhook secret in plaintext body; no consent screenshot/grant record; no post-install "app requires these compliance webhooks verified" gate; uninstall doesn't schedule data-purge job or fire merchant-visible confirmation of revocation.

## 6. Merchant Integration Verdict
The merchant admin is a real product for commerce operations, but as an **apps host** it is ~30% built: discovery/install plumbing exists end-to-end; operation (embed, approve charges, place blocks, debug webhooks, manage scopes) is absent. The platform staff side (review/moderation/payout ops) is the thinnest layer in the ecosystem. Remediations: doc 10 (target apps platform), doc 14 (marketplace blueprint: review workflow), doc 15 (partner platform).
