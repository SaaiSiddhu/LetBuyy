# 04 — Orders

**Readiness (merchant UI): ~62%.** Daily-operation core is production-quality; ~38% of gateway capability is unexposed.

## Real
List (sortable, 7 columns), status filter (8 states) + payment filter + search + filter chips, inline detail expand (lazy + cached), full status state machine (confirm/process/ship/deliver/cancel), bulk actions, cancel with ConfirmDialog, **refund with StepUpDialog (step-up auth) → `complete_order_refund`**, basic fulfillment (tracking number), loading/empty/error states, INR + en-IN formatting.

## Gaps (documented — UI; gateway data already available)
- **No dedicated `/orders/[orderId]` page** (inline expand only). HIGH.
- **No timeline/activity log** (events in `outbox_events`/`audit_activity_events`, never read). HIGH.
- **No returns UI** (gateway `returns.ts` fully implemented). HIGH.
- No GST invoice display, billing address, COD/risk/fulfillment-status display. MEDIUM.
- Standalone notes/tags, date-range filter, pagination, line-item partial refund, full `/fulfill` + packing slip. MEDIUM/LOW.

**Verdict:** the V1 daily order workflow works; the detail page + timeline + returns surface are the top remaining items (data already in the API).
