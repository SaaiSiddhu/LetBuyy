# Theme Installation Journey Audit (Phase 9)

Simulated end-to-end as coded in `apps/theme-marketplace`. Each step lists what works, what's missing, and what assumption breaks.

## Step 1 — Browse → 2 — Preview

- **Browse:** `/themes` renders cards (real) → card links to `/themes/[slug]`.
- **Preview:** **broken/disabled.** The detail page's primary preview, "Preview in your store," is a hard-`disabled` button with the note "Store-scoped preview sessions … are not exposed by the theme marketplace API yet" (`[slug]/page.tsx:470-477,510-512`). The theme card's "Preview theme" is a non-interactive `<span>` (`theme-card.tsx:46-49`). A `demo_url` link appears only if the theme provides one (`[slug]:488-507`).
- **Broken assumption:** the journey assumes a merchant can evaluate a theme before committing. They cannot — the single most important pre-decision action is disabled, even though `previewSession` exists in the gateway client (`api-client:1490`).

## Step 3 — Acquire (free → install / paid → checkout)

- Free theme → `/install?theme=slug` ("Add to library"); paid → `/checkout?theme=slug` ("Buy and add") (`[slug]:271-273`).
- **Checkout:** Razorpay/INR only; Stripe disabled; coupon fake; on success → `/checkout/success` which **leaks `[SKIP - NEEDS BACKEND]`** and shows License "Issued after provider confirmation" (`checkout/success/page.tsx:58-65`).
- **Broken assumption:** that a paid acquisition ends with a receipt + license. It ends with a placeholder.

## Step 4 — Install

- `/install` loads the theme + the user's stores (`install/page.tsx:57-60`).
- If **no stores** → empty state → "Open Admin" to create a store first (`:108-117`). The marketplace cannot create a store; the journey hops to another app.
- If stores exist → pick one → server action `installThemeAction` → `api.themes.install(slug, store_id, config_overrides={})` (`:31-51`; `theme-service.ts:132-142`).
- Errors map to `purchase_required` / `missing_store` / `install_failed` (`:42-48`).
- Success → `/dashboard/installations?installed=slug` with a success toast.
- **Destructive + no safety net:** the form warns "Your current storefront styling will be replaced for the selected store." (`:145-147`). There is **no preview, no draft, no backup, no confirm-diff, and no rollback** offered in this flow — even though `releases`/`rollbackRelease` exist in the gateway (`api-client:1492-1495`).

## Step 5 — Publish

- Not a marketplace step here. Publishing (draft → publish → make-store-live) lives in `merchant-control-plane` (`api-client:1488`; `PublishThemeSchema` in `theme-engine:896-902`). The marketplace's install effectively applies styling directly; there is no marketplace-side "publish/preview then go live" gate.

## Step 6 — Update

- The installations list **computes** an "Update Available" badge when `version_installed !== theme.version` (`installations/page.tsx:11-14,54-56`) — but renders **no update button or action**. The merchant is told an update exists and given no way to apply it.

## Step 7 — Rollback

- **Absent from the marketplace.** No uninstall, no revert, no release picker. `rollbackRelease` exists in the gateway but is not surfaced here.

## Journey scorecard

| Step | Works? | Gap |
|---|---|---|
| Browse | ✅ | catalog empty |
| Preview | ❌ | disabled; API exists |
| Checkout | ⚠️ | INR-only; success leaks placeholder |
| Install | ✅ (functionally) | destructive; no preview/backup |
| Publish | n/a here | lives in merchant app |
| Update | ❌ | badge only, no action |
| Rollback | ❌ | not surfaced |

## Friction & missing steps (ranked)
1. No working preview before purchase/install.
2. Paid path ends in a placeholder, not a receipt/license.
3. Install is destructive with no preview/backup/rollback.
4. "Update Available" with no way to update.
5. Store-creation dependency forces a jump to Admin mid-journey.
6. No post-install "next steps → customize" deep-link into the real editor (the success page's "Customize" and dashboard "Customize" both point at marketing/detail pages, not the editor — `installations:133-139`).

## Fastest fixes
- Wire `previewSession` for a real "try before you buy/install."
- Make install non-destructive: create a draft/preview release, let the merchant compare, then publish; expose `rollbackRelease`.
- Replace the success-page placeholder with a real receipt + license; add an "Apply update" action backed by `publish`/`releases`.
- Deep-link "Customize" to `merchant-control-plane` `/[store]/online-store/themes/[themeId]/editor`.
