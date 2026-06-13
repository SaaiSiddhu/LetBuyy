# Merchant UX

Merchants are small-business owners, not power users. Optimize for clarity and confidence.

- **One primary action per screen** — obvious, top-right (`PageHeader.primaryAction`) and/or pinned (`SaveBar`).
- **Destructive actions confirmed** — `ConfirmDialog`/`destructive` variant; explain consequence ("This card can no longer be redeemed").
- **Plain language** — no jargon; INR amounts, dates in `en-IN`.
- **Progressive disclosure** — advanced settings behind sections; sensible defaults.
- **Immediate feedback** — `useToast` on success/failure; optimistic updates where safe, reconcile on error.
- **Recoverable** — unsaved-changes guard (`SaveBar` states saved/unsaved/saving); never lose merchant input on error.
- **Reveal-once secrets** — gift-card codes / API keys shown once with a copy button, then masked.
- **Empty → action** — every empty list teaches the next step (`EmptyState` with a primary action).
