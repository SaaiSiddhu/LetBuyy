# Implementation Constraints

## General Constraints

- Do not implement features before reading the owning source, root `AGENTS.md`, `memory/lessons.md`, `tasks/todo.md`, and relevant domain docs.
- Keep changes scoped to the user request.
- Do not mass rewrite or modernize unrelated files.
- Do not create parallel architecture when an existing service, schema, or route can be extended safely.

## API Constraints

- New worker payloads need Zod schemas.
- New list endpoints need pagination.
- New mutations with repeatable side effects need idempotency.
- Known errors should use `AppError` and sanitized responses.
- Unexpected errors should be logged internally and never expose raw database/provider details to clients.

## Frontend Constraints

- Default to Next Server Components.
- Use client components only for browser APIs, state, events, context, and interactive UI.
- Do not store merchant auth tokens in `localStorage`.
- Use Tailwind/shared tokens instead of new inline styles.
- Web icons must use Lucide React.

## Backend Constraints

- Business logic belongs in services, not large handlers.
- Service role clients stay in server/worker code.
- Store ownership and tenant context must be verified before merchant data access.
- Payment totals and inventory effects are server-side concerns.

## Documentation Constraints

- If behavior changes routes, migrations, auth, infra, package boundaries, theme contracts, or event flows, update `docs/agents` and generated architecture docs as appropriate.
