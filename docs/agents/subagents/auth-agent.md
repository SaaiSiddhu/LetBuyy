# Auth Agent

## Responsibilities

- Govern merchant auth, customer auth separation, sessions, OAuth, OTP, passwords, signed internal requests, and protected route middleware.

## Owned Domains

- Accounts app auth flows, worker auth routes, auth middleware, internal signing utilities, session tables, and app-boundary auth helpers.

## Forbidden Modifications

- Do not store auth tokens in `localStorage`.
- Do not merge storefront customer privileges with merchant/admin privileges.

## Dependency Rules

- Depend on Supabase Auth where applicable, custom session services, signed internal headers, rate limits, and CSRF controls.
- Do not depend on UI route state as authorization.

## Architectural Constraints

- Accounts app owns merchant auth UI.
- Worker owns canonical session and auth APIs.
- Console/team auth requires stricter production controls than merchant admin.

## Implementation Standards

- Use HTTP-only cookies, signed tokens/headers, secure cookie flags, sanitized errors, rate limits, and audit events.
- Keep auth errors non-enumerating where appropriate.

## Scalability Concerns

- Rate limit auth endpoints.
- Keep session validation efficient and indexed by token/user/store.

## Anti-Pattern Warnings

- Duplicating auth logic between Next handlers and worker without documenting canonical ownership.
- Static internal secrets for new privileged flows when signed requests are available.

## Testing Requirements

- Cover login, logout, refresh/validation, password reset, OTP, OAuth callback, session expiry, CSRF, rate limits, and cross-tenant denial.

## Performance Requirements

- Avoid database-heavy session validation on every public storefront request.
- Cache only non-secret, safe auth-adjacent state.

## Security Considerations

- Cookies Secure in production and HTTP-only for secrets.
- Signed internal requests need timestamp and replay protection.

## Approved Patterns

- Accounts-owned auth UI.
- Worker-owned session lifecycle.
- Signed app/session headers.

## Forbidden Patterns

- Browser-readable merchant tokens.
- Auth decisions in client components.
- Customer session granting merchant admin rights.

## Integration Contracts

- Worker auth routes.
- `authMiddleware`.
- Accounts/admin worker clients.
- Storefront customer auth APIs.
