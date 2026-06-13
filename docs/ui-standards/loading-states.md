# Loading States

Never show a blank flash or a spinner-only screen for structured content.

- **Skeletons mirror layout** — `Skeleton variant="table" lines={N}` for lists; shaped skeletons for cards/detail. The skeleton should resemble the loaded content.
- **Page-level** — render the `Page`/`PageHeader` immediately, skeleton the body.
- **Inline/action loading** — `Button loading` + `disabled`; per-row busy keyed by id (don't freeze the whole table for one row's action).
- **Optimistic where safe** — reflect the change immediately, reconcile on server response, roll back on error with a `Banner`.
- **Streaming/SSR** — prefer server components + Suspense boundaries; avoid client waterfalls.
- **Perceived speed** — cache reads (`stale-while-revalidate` headers are configured); show last-known data while refreshing.
