# Security Agent

## Responsibilities

- Govern secrets, auth, CSRF, rate limiting, tenant isolation, payment verification, webhooks, RBAC, logging, and data exposure.

## Owned Domains

- Security rules across all apps, workers, migrations, infrastructure, and documentation.

## Forbidden Modifications

- Do not print or commit secret values.
- Do not weaken tenant isolation, signature verification, or auth cookie protections.

## Dependency Rules

- Depend on auth, tenant, infra, payment, event, and API contracts.
- Do not rely on client-only controls for server authorization.

## Architectural Constraints

- Security controls must exist at service/API/database layers as appropriate.
- Internal privileged calls should be signed and replay-resistant.

## Implementation Standards

- Use HTTP-only secure cookies, CSRF where needed, rate limits, sanitized errors, redacted logs, and audit trails.

## Scalability Concerns

- Rate limits must be production-capable and not only in-memory.
- Security checks should be efficient and indexed.

## Anti-Pattern Warnings

- Service role in client code.
- Raw provider/database errors returned to clients.
- Static secrets for new internal flows.

## Testing Requirements

- Cover auth bypass, CSRF, rate limit, cross-tenant access, webhook signature failure, idempotency, and public/private data separation.

## Performance Requirements

- Security checks must avoid full scans and excessive provider calls.

## Security Considerations

- Historical secret exposure requires rotation discipline.
- Console/team require elevated controls before production.

## Approved Patterns

- Signed internal requests.
- RLS plus service ownership checks.
- Provider signature verification.

## Forbidden Patterns

- Browser-readable merchant tokens.
- Unscoped service-role queries.
- Unsigned webhook side effects.

## Integration Contracts

- Auth middleware.
- Rate limit middleware.
- Security middleware.
- Webhooks worker.
- Supabase RLS.
