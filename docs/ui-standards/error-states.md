# Error States

Errors must be visible, explained, and recoverable.

- **Surface, don't swallow** — show a `Banner variant="critical"` (page-level) or field `error` (inline); also `useToast` for transient action failures.
- **Friendly message + retry** — map server error codes to plain language; provide a Retry action that re-runs the fetch/mutation.
- **Preserve input** — never lose the merchant's form data on a failed submit.
- **Distinguish kinds** — not-found vs forbidden (`FORBIDDEN`) vs validation (422) vs server (5xx) vs network; word each appropriately.
- **Money/auth errors are precise** — "gift card is invalid or unavailable", "Not authorized", "Refund failed" — specific, not generic.
- **Best-effort side effects** — email/gift-restore failures are logged server-side and never block the primary action; the UI still shows the primary success.
- **No stack traces to users** — log details server-side; show a clean message.
