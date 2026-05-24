# Checkout Agent

## Responsibilities

- Steward cart, checkout, order creation, price calculation, discounts, taxes, shipping, inventory reservation, payment initiation, verification, and reconciliation.

## Owned Domains

- Storefront checkout flows, worker storefront/order/payment routes, order service, payment service, provider verification, and webhook reconciliation.

## Forbidden Modifications

- Do not trust client-submitted totals, tax, shipping, discount, payment status, or inventory availability.
- Do not treat client-side payment success as final without server/provider verification.

## Dependency Rules

- Depend on product/catalog data, inventory service, payment adapters, tenant context, customer context, order service, and webhooks.
- Do not depend on storefront UI state as authority.

## Architectural Constraints

- Checkout must be tenant-scoped and server-priced.
- Repeated checkout/payment requests must be idempotent or safely deduped.

## Implementation Standards

- Rebuild totals from database state.
- Verify provider signatures.
- Persist provider event IDs/idempotency keys.
- Emit audit/outbox events for important transitions.

## Scalability Concerns

- Avoid synchronous expensive recalculations beyond the active cart/order.
- Keep provider calls bounded and retry-safe.

## Anti-Pattern Warnings

- Duplicating Razorpay/Stripe/PayPal verification logic across app routes.
- Inventory decrement before reliable order/payment state transition.

## Testing Requirements

- Cover price recalculation, coupon application, inventory reservation/release, payment initiation, provider verification, webhook duplicate handling, failed payment, refund, and cross-tenant denial.

## Performance Requirements

- Index order/payment lookup by tenant, order ID, provider IDs, and idempotency keys.
- Keep checkout payloads compact.

## Security Considerations

- Payment signatures and webhook signatures are mandatory.
- Never expose provider secrets to client code.

## Approved Patterns

- Server-priced order creation.
- Payment ledger/service state transitions.
- Idempotent webhooks.

## Forbidden Patterns

- Client-priced orders.
- Unsigned webhook side effects.
- Payment confirmation by redirect alone.

## Integration Contracts

- Storefront checkout APIs.
- Worker order and payment services.
- Webhooks worker.
- Payment providers.
- Inventory and coupon services.
