# 09 — Settings

**~84% — NOT changed in Phase 4.75.** Carries Phase-4 status. Honestly disclosed.

## Real (prior phases)
General (store info/address/locale/SEO), Business (legal/GSTIN/KYC), Billing, Taxes/GST, Users & permissions, Plan, Security (2FA), Checkout, Policies, Appearance/Branding (LB-9 bridge), Payments view, Apps. Broadly real + functional.

## Not built this phase (and why)
- **Email settings page** (`/settings/email` — sender name/reply-to/template config) — needs a confirmed backend field/endpoint for per-store sender identity; not built (would risk a UI with no real persistence). The campaign-send + transactional-email backend exists (Resend), but a *settings* surface for sender identity is a distinct, unconfirmed backend.
- **Notification settings** — same: needs a confirmed preferences backend.
- **Payment online/COD toggles** — currently display-only; making them functional needs a confirmed write path (enable/disable per method) — not just a UI toggle. Not built (a dead toggle is forbidden).
- **Policies storage path** — Phase-4 flagged a possible divergence (`site_settings` blob vs a `policies` table); a data-model confirmation, not a quick UI add.

## Path
Confirm each backend (sender identity, notification prefs, payment-method enable/disable write, policy storage) → build the matching settings UI with visual verification → wire `settings:write` RBAC (same one-line guard).

**Verdict:** the settings surface is broadly real; the email page + functional payment toggles need confirmed backends first — not faked this phase.
