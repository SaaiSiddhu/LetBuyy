# F6.1 marketplace revision-bound approval — 4 October 2026

## Change

Migration 275 binds each marketplace submission and approval to a SHA-256
fingerprint of the buyer-facing and compliance-relevant revision. The canonical
payload includes product copy, identity/URL, prices, images, taxonomy/tags, SEO,
origin/importer/customs disclosures, tax/physical-shipping details, canonical
`product_variants`, canonical `product_options`, and marketplace category,
pricing policy and compliance flags. It deliberately excludes stock,
`inventory_qty`, activation/deletion controls, internal SKU/barcode/cost data and
the legacy `products.variants` cache.

Submission stores the reviewed fingerprint. Approval compares the current
fingerprint with the submitted one and stores the approved fingerprint; a stale
submission is refused. Direct inserts cannot create an already-approved listing,
and review fingerprints cannot be changed without a valid status transition.
Changes to material product, variant, option or marketplace listing fields
atomically return an approved, paused or pending marketplace listing to draft and
write an append-only moderation event with `actor_realm = 'system'`, no human
actor, and a clear resubmission reason. A merchant must then submit the new
revision. Stock, variant inventory, and activation toggles leave the approval
revision intact; the existing public sellability fences continue to decide
whether a listing is currently served.

Because pre-migration approved listings have no historical fingerprint,
migration 275 conservatively moves them to draft with an audit event instead of
claiming the current state was reviewed. Pending submissions bind to their
current state. Rollback also returns in-flight and approved marketplace listings
to draft before removing fingerprint enforcement. It retains the `system` audit
realm so append-only invalidation history remains truthful.

## Verification

- New owned disposable Postgres suite: **5/5 passed** on `postgres:16-alpine`.
  It proves legacy-approval withdrawal, submission/approval binding, stock and
  activation stability, product/variant/option/category/pricing/compliance
  invalidation, stale-approval refusal, direct-approved-insert refusal and the
  fail-closed rollback.
- Affected owned Postgres regressions: sponsored feed **7/7**, marketplace detail
  **5/5**, historical migration-realm **4/4**. Existing fixtures now use the
  merchant submission and operator approval RPCs rather than inserting approved
  marketplace rows directly.
- `pnpm run validate:migrations`, executable JavaScript syntax checks and
  `git diff --check`: passed.
- All database suites used the repository runner's isolated, owned Postgres
  resources. No restored/shared/hosted database or live listing was changed.

## Remaining acceptance

This verifies database behavior and migration rollback locally; it is not Phase 6
closure. Operator review UI/assignment/evidence/reason workflow, concurrency and
appeals, all discovery/deep-link caches, purchase-time eligibility, complaints
and takedown propagation, workload rehearsal, and broader role/security evidence
remain open. Next package: F6.2 operator review workbench, building on the
existing canonical listing and transition RPCs.
