# 10 — RBAC Finalization

**Coverage: 30 guarded commerce write handlers across 7 route files** (incl. smart-collections writes, Phase 5.9). Dry-run-safe throughout.

## Coverage
products (4) · orders (4) · coupons (3) · customers (2) · shipping-tax (3) · inventory (12) · smart-collections (2) = **30** write handlers via `assertStaffPermission` (`products:write`/`orders:write`/`marketing:write`/`customers:write`/`shipping:write`). Pure decision logic 9/9 unit-tested.

## This wave
- The new **commerce-analytics** endpoints are **reads** → no write guard needed (correct).
- **Audit + automation RPC writes** (`reconcile_count_session`, automation action dispatch) will get `assertStaffPermission` guards when those engines are built (post-migration) — specced in `01`/`03`.

## Safety (unchanged, proven)
Owner-bypass (authoritative `verifySiteOwnership`) + dry-run default (`MERCHANT_STAFF_RBAC_MODE`; logs `staff_rbac_decision`; never blocks) + fail-open on error. Behavior-neutral until an operator flips to `enforce`.

## Remaining (documented; live-verification-gated)
- **notifications** `PUT /preferences` + **payment** toggle write (`PATCH /stores/:id`) → `settings:write` (the store-update route is broad — wants careful live validation).
- **The `enforce` flip** — set `MERCHANT_STAFF_RBAC_MODE=enforce` after dry-run-log verification on staging (assert viewer-blocked / manager-allowed / owner-passes), per `11-live-stack-prep.md`.
- Invite-acceptance page (the staff onboarding landing).

**Verdict:** RBAC spans effectively the entire commerce write surface (30 handlers), lockout-proof in dry-run; the enforce flip + notifications/payment guards are the small, live-verification-gated closing items.
