# 02 — Order System

**Orders: ~62% → ~72%.** A real order detail page + status/notes workflow + `orders:write` RBAC landed this phase.

## Done (verified)
- **Order detail page** `[store]/orders/[orderId]/page.tsx` (NEW, ~699 lines) — order summary (number/status/payment/fulfillment/dates/totals), line items, customer context (links to the customer detail page), shipping/billing addresses, payment + refund summary. Real API consumption (no mock/fake/placeholder markers), `@letbuyy/ui` + `--lb-*` tokens, loading/error/empty states. Orders list rows now clickable → detail.
- **Detail + workflow proxy** `api/stores/[store]/orders/[orderId]/route.ts` (NEW) — GET → `orders.get`; **PATCH** → `orders.update` (status / tracking / carrier / cancellation reason / notes), ownership-checked. This covers Agent-04 "status updates + order notes" at the API layer.
- **RBAC** — `orders:write` guard on PATCH /:id (status), POST /:id/fulfill, POST /:id/refund, POST /:id/refund/complete (see `07-rbac.md`). The money-sensitive paths are access-controlled.

## Remaining (UI / needs running stack or backend)
- **Timeline / events** — the detail page shows an honest empty state; there is no dedicated order-events read endpoint wired (not fabricated). Building a real timeline needs an events/audit read endpoint.
- **Returns UI** — a returns workflow surface beyond refund is unbuilt.
- **Risk context + tags** — no confirmed risk/tags backend for orders; not built (would be fake).
- Order create/draft UI from the admin (drafts API exists).

## Verification
Compile-verified (merchant-control-plane `tsc` EXIT 0 — integrated check in `13-certification.md`); the order proxy + RBAC are contract-tested. Visual/flow verification of the detail page + the status-update round-trip needs a running authenticated stack.

**Verdict:** order daily-ops gained a real detail + status/notes surface and full write access-control; timeline/returns/risk remain (real backend or live-stack gated), not faked.
