# Backend Rules

## Worker Gateway

- The Cloudflare Hono worker under `backend/workers/api` is the canonical `/v1` business API gateway.
- New route handlers should be small and delegate business logic to services.
- Protected routes must use auth middleware and tenant/store context where merchant-owned data is involved.

## Validation And Errors

- Add or extend Zod schemas in `backend/workers/api/src/schemas` before accepting new payloads.
- Known failures should use `AppError` or domain-specific subclasses.
- Responses must be sanitized and should not expose raw database/provider errors.
- List endpoints require pagination.

## Commerce Rules

- Recalculate prices server-side.
- Reserve and release inventory through service/RPC workflows.
- Require idempotency for order/payment mutations that can duplicate side effects.
- Payment provider verification must use provider signatures and trusted server amounts.

## Data Access Rules

- Use service role clients only in server/worker contexts.
- Always filter tenant-owned data by `site_id` or verified parent ownership path.
- Treat public storefront reads as scoped published-state reads, not as general tenant data access.

## Observability

- Preserve request IDs.
- Log internally with redaction.
- Emit audit/outbox events for workflows that affect security, commerce, payments, fulfillment, webhooks, or operations.
