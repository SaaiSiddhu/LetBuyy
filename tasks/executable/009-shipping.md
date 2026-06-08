# Task 009 - Shipping
Status: done
DependsOn: [001]
Covers: shipping and carrier
Conforms-to: V1 section 3, Appendix C row 009

## Goal

Implement zones/profiles/rates, pincode/COD serviceability, Shiprocket-shaped carrier label/AWB/track adapter.

## Scope

In: mock-by-default carrier adapter. Out: new media/shipping service.

## Reuse

`shipping-tax.ts`, `shipping-labels.ts`, migration `118`, logistics adapter.

## Database

Migration `145_executable_shipping_serviceability.sql` adds `shipping_profiles`, tenant-scoped pincode/COD serviceability rules, shipment provider/AWB/tracking fields, and RLS+FORCE+GUC policies on the shipping tables. Rollback: `database/supabase/rollback/145_executable_shipping_serviceability.rollback.sql`.

## APIs

`POST /shipping/rates`, `GET /shipping/serviceability/:pincode`, `GET /shipping/track/:trackingNumber`, with existing label/manifest endpoints kept in the shipping-labels route.

## Events

`shipment.created.v1`, `shipment.out_for_delivery.v1`, `shipment.delivered.v1`, `shipment.rto.v1`.

## Acceptance

Serviceability and COD eligibility are resolved from tenant-owned rules with mock fallback; tracking reads go through the logistics adapter. Live carrier mode is guarded behind `HR-CARRIER-LIVE`.

## Tests

PASS: checkout-core serviceability unit test; gateway shipping route/static tests; real local Postgres migration/RLS/rollback proof; gateway typecheck; gateway unit suite; governance and architecture validation.

## Rollback

Return to existing shipping-label route and rollback additions.

## [HUMAN-REQUIRED]

`HR-CARRIER-LIVE`.
