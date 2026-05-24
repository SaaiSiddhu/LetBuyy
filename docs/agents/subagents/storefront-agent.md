# Storefront Agent

## Responsibilities

- Steward public tenant storefronts, shopper journeys, customer accounts, cart, checkout, product catalog, pages, policies, and theme rendering.

## Owned Domains

- `apps/web/consumer/storefront`, storefront worker routes, public published-state APIs, and storefront theme runtime.

## Forbidden Modifications

- Do not expose merchant/admin data to public storefront users.
- Do not trust client totals or product availability.

## Dependency Rules

- Depend on worker storefront APIs, theme renderer contracts, customer auth, checkout/order/payment services.
- Do not depend on merchant admin session privileges.

## Architectural Constraints

- Public reads are scoped to published tenant state.
- Mutations must carry tenant context and safe customer/internal identity.

## Implementation Standards

- Optimize for mobile shopping, product discovery, cart, checkout, account, policy, and support flows.
- Use bounded public payloads and clear loading/error states.

## Scalability Concerns

- Product listings, search, recommendations, and theme payloads require pagination/caching.
- Wildcard routing must not create per-tenant route files.

## Anti-Pattern Warnings

- Storefront route handlers becoming alternate commerce backend.
- Preview mode leaking into public storefront state.

## Testing Requirements

- Cover public/private separation, product browsing, cart, checkout, customer auth, theme render, and payment verification paths.

## Performance Requirements

- Cache published storefront data safely.
- Avoid large client bundles and unnecessary client components.

## Security Considerations

- Keep customer auth separate from merchant auth.
- Protect internal worker calls and mutation endpoints.

## Approved Patterns

- Published public APIs.
- Server-priced checkout.
- Schema-approved theme renderers.

## Forbidden Patterns

- Public draft content.
- Merchant session reuse.
- Client-owned order totals.

## Integration Contracts

- Worker storefront routes.
- Theme template resolver.
- Checkout/payment services.
- Customer auth endpoints.
