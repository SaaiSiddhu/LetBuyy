# App Installation Journey Audit (Phase 9)

Walks the full lifecycle — browse → view permissions → install → authorize → configure → use → upgrade → cancel → uninstall — flagging every friction point and missing step. Parent: [Master Audit](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md).

## Stage-by-stage

### 1. Browse → 2. View permissions
- App detail (`apps/[slug]/page.tsx`) has a dedicated **Permission review** section + sidebar permissions panel listing scopes with human labels. Good transparency.
- **Friction:** scopes show as a flat list with no "why this scope is needed" rationale and no data-handling disclosure. Pricing is shown but **billing terms are not surfaced in the same place as the install action**.

### 3. Install → 4. Authorize
- `AppInstallConsentPanel` opens a `Modal` listing scopes (label + raw code), optional privacy/terms links, then `POST /api/apps/:id/install {scopes}`.
- Backend (`install-lifecycle-routes.ts`): optional **idempotency** via `X-Idempotency-Key`, **scope normalization** against `app.api_scopes`, upsert `app_installations` (active), **webhook subscription provisioning**, `app.installed` outbox event, `install_count` increment. This is solid.
- **Major gap:** this **is not the OAuth flow.** The real `/app-store/apps/:id/oauth/authorize` + `/oauth/token` exist and mint JWTs, but the marketplace never calls them. The consent panel sends the app's **entire declared scope set** with no per-scope opt-out and no incremental authorization.
- **Security note:** on success the panel renders the app in an `<iframe sandbox="allow-forms allow-popups allow-same-origin allow-scripts">`. `allow-same-origin` + `allow-scripts` together is unsafe if the launch target is same-origin; third-party apps must be served cross-origin and the sandbox tightened.

### 5. Configure
- **Missing.** There is no post-install setup/onboarding. The success state either embeds `app_url` in an iframe or, if no URL, shows "Launch target unavailable." No setup checklist, no required-config capture, no deep link into the merchant admin.

### 6. Use
- Embedded iframe launch or "Open full screen." `My Apps` lists installs with a Settings link (only if `app_url` exists) and uninstall.
- **Missing:** App Bridge session handoff in the UI (the `embed-session`/`bridge/fetch` endpoints exist but aren't used), so the embed is a raw iframe rather than an authenticated embedded app.

### 7. Upgrade plan / 8. Cancel plan
- **Missing entirely in the product.** Billing charges + approval exist server-side (`/installations/:id/charges`, `/charges/:id/approve`), but there is **no UI** to view a charge, approve/decline it, change plans, start a trial, or cancel. The detail page only shows a passive "Billing approval required" banner.

### 9. Uninstall
- Best-built stage. `InstalledAppsGrid` → `ConfirmDialog` with an explicit data-loss warning → `DELETE /api/apps/:id/install` → status `uninstalled`, lifecycle outbox, install-count recount. Optimistic UI with error rollback. 

## Friction & missing-step register

| Stage | Issue | Severity |
|---|---|---|
| Permissions | No rationale per scope; no data-handling disclosure | High |
| Install | Bypasses real OAuth; all-or-nothing scopes; no incremental auth | High |
| Install | Billing terms not shown alongside install consent | High |
| Install | Unsafe iframe sandbox combination | High |
| Configure | No post-install setup/onboarding at all | High |
| Use | No App Bridge session; raw iframe only | Medium |
| Upgrade/Cancel | No billing UI (plan change, trial, cancel, refund) | Critical |
| Uninstall | No reason capture / win-back | Low |
| All | No notifications on install/charge/uninstall (events emitted, no inbox) | Medium |

## Recommendations
1. Route install through the real OAuth authorize/consent, with **billing terms + scopes in one approval** and **re-consent when an update widens scopes**.
2. Add a **post-install setup** step and use `embed-session`/App Bridge for authenticated embedding.
3. Build the **billing surface**: plan selection, charge approval, trials, plan changes, cancellation, refunds.
4. Tighten the embed sandbox; serve third-party apps cross-origin.
5. Keep the uninstall flow as the model for the rest of the product.
