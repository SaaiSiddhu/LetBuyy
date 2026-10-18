# F3.7 marketplace category order-line snapshot — 5 October 2026

## Result

Migration 296 adds `order_items.marketplace_category_id`. During the existing
canonical marketplace checkout, a `BEFORE UPDATE` guard captures the category
from the seller-owned marketplace listing in the same transaction that binds
the approved listing ID and fingerprint. The category is derived from the
locked listing row; the client cannot provide it. Later category changes are
rejected. Storefront order lines retain a null marketplace category.

Pre-migration lines that have a listing reference but no recoverable category
remain explicitly unsnapshotted; the migration does not infer history from the
listing's current category. Rollback is allowed only before any category
snapshot has been committed. It raises and preserves the column/evidence after
the first non-null snapshot.

The category snapshot supports future item-level payout attribution. It does
not select a commission rate, fee/tax basis, or rounding rule and does not
resolve the F3.1 governance conflict.

## Verification

- Real Gateway marketplace cart/checkout journey against runner-owned
  PostgreSQL/PostgREST 16: **12/12** passed, zero failures, skips, TODOs or
  cancellations (`22cdc47bd42e`). It checks the approved category is saved on
  the purchased item, direct post-checkout category mutation is rejected,
  existing marketplace listing identity remains immutable, and category data
  can be safely rolled back/reapplied before any snapshot exists.
- The same suite covers mixed-seller denial, marketplace origin binding,
  existing order ownership, delivery, COD confirmation and replay behavior.
- Runner-owned disposable database resources were cleaned. No provider, hosted
  database, payment or payout was used.

## Remaining

F3.7 still needs a source-to-ledger census across all order/payment/settlement,
refund, and COD paths. Phase 9 still lacks per-item marketplace category fee
allocation, weekly eligibility, holds/refunds/COD, payout failure recovery,
reversal and provider reconciliation. First reconcile F3.1's permanent global
zero-commission doctrine with the accepted storefront-zero/marketplace-category
direction, then establish canonical effective-dated configuration and resolve
D07 rates, fee/tax bases and rounding. Do not charge using the legacy site-wide
commission schedule as a substitute for that work.

