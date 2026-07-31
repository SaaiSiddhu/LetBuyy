# 10 — Store Settings

**Readiness: ~84% avg** across sub-pages. LB-9 appearance bridge confirmed present.

## Real (sub-pages, ~85–95%)
General (store info/address/locale/SEO), Business (legal/GSTIN/KYC/commission), Billing, Taxes/GST, Users & permissions, Plan, Security (TOTP 2FA), Checkout, Policies, Appearance/Branding (LB-9 bridge → `:root` tokens, tested), Payments, Apps. Notifications (partial, ~70%).

## Fixed this phase (verified)
- **AISidebar 404 link:** the "Customize your site theme" todo linked to `/${store}/settings/appearance` (no such page) → fixed to `/${store}/appearance` (the real page). Contract-tested.

## Gaps (documented)
- **No `/settings/email` page** (sender name/reply-to/template config). P1.
- **Payments online/COD toggles are display-only** (read-only fields, no enable/disable control). P1.
- **Policies storage inconsistency:** the page saves to the `site_settings` blob, but a separate `/policies` proxy reads a `policies` table → potential content divergence. Confirm the storefront reads `site_settings.*_policy`. P1 (data-model).
- **Custom-data (metafields): full STUB** (`BackendNeededPane`). P2.
- Logo/favicon + KYC are URL-input only (no media library/file upload). P2.

**Verdict:** the settings surface is broadly real + functional; the email page, the payment toggles, and the policies storage path are the notable pre-launch items.
