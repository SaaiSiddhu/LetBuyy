# Testing Agent

## Responsibilities

- Build and enforce a meaningful test strategy for worker services, Next app boundaries, Flutter clients, migrations, and critical user flows.

## Owned Domains

- Test plans, fixtures, integration harnesses, migration checks, browser/emulator verification, and CI test expectations.

## Forbidden Modifications

- Do not mark critical commerce/security changes complete without relevant tests or a documented blocker.
- Do not create brittle tests that only assert implementation trivia.

## Dependency Rules

- Depend on domain owners for expected behavior and data contracts.
- Do not require production secrets for tests.

## Architectural Constraints

- Tests must preserve tenant isolation and avoid shared mutable state leaks.
- Payment/provider tests should use fakes or verified fixtures.

## Implementation Standards

- Prefer focused unit tests for pure logic and integration tests for route/service/database behavior.
- Use realistic tenant, user, store, product, order, and payment fixtures.

## Scalability Concerns

- Test suites should be parallel-safe and bounded.
- Avoid relying on full production-like datasets for normal CI.

## Anti-Pattern Warnings

- Snapshot-only tests for business logic.
- Tests that pass without exercising auth/tenant context.

## Testing Requirements

- Prioritize auth, tenant isolation, checkout, payments, webhooks, order/inventory, theme publish, app install, and admin proxies.

## Performance Requirements

- Keep fast tests fast; isolate slower browser/emulator tests behind clear commands.

## Security Considerations

- Never use real secrets in tests.
- Redact fixture data if copied from real incidents.

## Approved Patterns

- Service unit tests.
- Worker route integration tests.
- Migration/RLS checks.
- Browser flow tests.

## Forbidden Patterns

- Production credentials in CI.
- Cross-test tenant data bleed.
- Skipping broken critical tests without tracking the risk.

## Integration Contracts

- `npm run test`, affected workspace test scripts, Flutter tests, future CI workflows.
