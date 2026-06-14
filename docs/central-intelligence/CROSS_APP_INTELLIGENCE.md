# LCIS — Cross-App Intelligence (Phase 4)

How the runtimes relate (graph workspace weights + import edges).

## Workspace weight (graph nodes)
mobile/merchant-app 4,980 · api-gateway 3,623 · merchant-control-plane 1,293 · shared-types 1,049 · storefront-runtime 910 · app-marketplace 679 · typescript/ui 664 · theme-marketplace 576 · identity-platform 443 · platform-console 443 · queue-workers 393.

## Shared contracts (the spine)
- **`@letbuyy/api-client`** (degree 669) — every Next app calls the gateway only through this typed client. Stale types surface as broken edges.
- **`@letbuyy/shared-types`** (degree 806) — Zod schemas + types shared by apps, services, and the client.
- **`@letbuyy/ui`** (664) — the design system used by all Next apps.
- **`packages/dart/api_client`** (358) — the mobile spine; the Flutter app talks to `mobile-bff`, not the gateway directly.

## Integration map
```
Next apps ──@letbuyy/api-client──▶ api-gateway ──▶ Supabase
mobile/merchant-app ──packages/dart──▶ mobile-bff ──▶ api-gateway
api-gateway ──NOTIFICATION_QUEUE──▶ queue-workers ──▶ Resend
providers ──▶ webhook-service ──▶ Supabase
```

## Findings
- **No app→app imports** — apps depend on shared packages + the client, never on each other (`one-system-per-domain`, `no-rejected-package-imports` enforce this). ✅ Clean boundaries.
- **Duplicate logic risk:** the TS cores (`commerce-core`, `checkout-core`) and the Dart models encode the same domain twice (web vs mobile) — expected for a cross-platform app, but a divergence risk; keep them in lockstep with `shared-types` as the contract.
- **Missing integrations:** reserved services (`search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline`) are manifest-only — their capabilities live in the implemented runtimes until a human-approved scope activates them.
- **Ownership:** frozen apps (`app-marketplace` 679, `theme-marketplace` 576, `developer-portal`) carry real node weight but are not deploy targets — flagged so they aren't mistaken for active surfaces.

## Recommendation
Treat `api-client` + `shared-types` as the cross-app contract; any change there should run `pnpm graph:intel blast` to see the all-apps ripple before merge.
