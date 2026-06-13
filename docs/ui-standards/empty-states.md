# Empty States

Every list/collection must render a deliberate empty state — never a blank area or an error for "no data yet".

Use `EmptyState` with: an `icon` (lucide, e.g. `CreditCard` for gift cards), a `title`, a `body` that explains the value, and a `primaryAction` that starts the next step.

- **First-run vs filtered-empty** — distinguish "you have none yet, create one" from "no results for this filter, clear it".
- **Teach the value** — e.g. gift cards: "Gift cards drive sales and give shoppers a balance to redeem at checkout."
- **Actionable** — the primary action is the obvious next move (Issue gift card, Add product).
- **Not an error** — a missing optional table/feature degrades to an empty state, not a 500 (the gateway returns `success([])` for missing-but-optional resources).

Example: the merchant gift-cards page shows an `EmptyState` with "Issue gift card" when none exist.
