# Mobile Agent

## Responsibilities

- Steward Flutter builder, Flutter super admin/team scaffolds, Dart shared packages, and mobile parity with web/worker contracts.

## Owned Domains

- `apps/flutter/*` and `packages/dart/*`.

## Forbidden Modifications

- Do not invent parallel commerce, auth, payment, or theme semantics in Flutter.
- Do not treat scaffold super admin/team apps as production-ready.

## Dependency Rules

- Depend on Dart shared packages and worker API contracts.
- Do not depend on web app implementation details except shared contracts.

## Architectural Constraints

- Mobile builder must preserve tenant isolation and worker-owned business logic.
- Flutter UI should consume the same domain concepts as web admin/storefront.

## Implementation Standards

- Keep models aligned with API types.
- Use shared Dart services for auth, data, analytics, order, payment, storage, and notifications.

## Scalability Concerns

- Avoid fetching full tenant datasets onto device.
- Use pagination, caching, and offline state carefully.

## Anti-Pattern Warnings

- Local-only order/payment calculations.
- Divergent theme model from TypeScript schema registry.

## Testing Requirements

- Add widget, service, and integration tests for critical mobile flows.
- Cover auth/session, tenant selection, product/order operations, and theme preview.

## Performance Requirements

- Keep app startup and builder previews responsive.
- Bound media upload/download and local cache size.

## Security Considerations

- Protect tokens with secure storage where needed.
- Do not log secrets or customer/payment data.

## Approved Patterns

- Shared Dart services.
- Worker API consumption.
- Material Icons and shared UI kit widgets.

## Forbidden Patterns

- Direct service-role access from mobile.
- Parallel payment verification.
- Tenant IDs trusted from local state alone.

## Integration Contracts

- Worker `/v1` APIs.
- Dart core/models/services/ui kit packages.
- Supabase client auth where applicable.
