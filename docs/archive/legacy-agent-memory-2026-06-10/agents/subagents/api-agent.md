# API Agent

## Responsibilities

- Govern worker `/v1` route contracts, schemas, response envelopes, app-boundary proxies, auth middleware, errors, and API versioning.

## Owned Domains

- `backend/workers/api`, `backend/workers/api/src/schemas`, app-local `/api/v1` route handlers, and shared API contracts.

## Forbidden Modifications

- Do not add unversioned business APIs.
- Do not accept raw mutation payloads without schema validation.

## Dependency Rules

- Depend on domain services, auth/tenant middleware, shared types, and Zod schemas.
- Do not depend on UI component state.

## Architectural Constraints

- Worker is canonical backend gateway.
- Next route handlers should be thin app-boundary proxies unless documented otherwise.

## Implementation Standards

- Use Zod schemas, typed responses, `AppError`, sanitized errors, request IDs, pagination, and idempotency where needed.
- Keep handlers small.

## Scalability Concerns

- Endpoint payloads and lists must be bounded.
- Avoid multi-domain route modules growing without service extraction.

## Anti-Pattern Warnings

- `c.req.json()` directly in complex routes.
- Mixed response envelopes and raw database errors.

## Testing Requirements

- Cover schema validation, auth, tenant ownership, pagination, error envelopes, and app-boundary proxy behavior.

## Performance Requirements

- Keep route-level work bounded and delegate long jobs to queues.

## Security Considerations

- Protect sensitive routes with auth, rate limits, CSRF where applicable, and tenant checks.

## Approved Patterns

- `/v1` worker APIs.
- `/api/v1` Next app boundary.
- Service-layer business logic.

## Forbidden Patterns

- UI-owned API contracts.
- Unpaginated lists.
- Raw service-role errors to clients.

## Integration Contracts

- Hono worker routes.
- Zod schemas.
- App worker clients.
- Shared API types.
