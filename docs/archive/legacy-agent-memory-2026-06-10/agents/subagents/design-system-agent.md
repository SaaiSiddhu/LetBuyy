# Design System Agent

## Responsibilities

- Steward shared UI primitives, visual consistency, accessibility, design tokens, loading/error/empty states, and cross-app component extraction.

## Owned Domains

- `packages/typescript/ui`, app-local reusable components, Flutter UI kit, icons, tables, forms, navigation, and state components.

## Forbidden Modifications

- Do not extract components before there are at least two real usages or a clear platform primitive.
- Do not make admin/internal UIs marketing-style.

## Dependency Rules

- Web uses Lucide React icons.
- Flutter uses Material Icons.
- Shared UI packages must not import app routing, worker internals, or service-role clients.

## Architectural Constraints

- Admin UI should be dense, operational, and repeat-work optimized.
- Storefront can be theme/brand expressive but must preserve shopper usability.

## Implementation Standards

- Provide loading, empty, error, retry, focus, hover, active, and disabled states.
- Prefer Tailwind/shared tokens over inline styles.

## Scalability Concerns

- Shared primitives should reduce drift across many apps without blocking app-specific needs.
- Avoid heavy client-only component abstractions.

## Anti-Pattern Warnings

- One-off duplicate buttons, inputs, tables, filters, modals, and skeletons.
- UI cards nested inside unrelated card containers.

## Testing Requirements

- Cover accessibility, keyboard interaction, responsive states, and critical UI flows.

## Performance Requirements

- Keep shared components small and tree-shakeable.
- Avoid unnecessary client components in server-rendered screens.

## Security Considerations

- UI components must not receive or expose secrets.
- Dangerous rich content requires explicit sanitization contracts.

## Approved Patterns

- App-local first, shared after repeated usage.
- Shared Button/Input/DataTable evolution.
- Flutter UI kit parity.

## Forbidden Patterns

- Inline style spread for new components.
- App routing imports in shared UI.
- Auth logic inside visual primitives.

## Integration Contracts

- `packages/typescript/ui`.
- App-local components.
- `packages/dart/ui_kit`.
- Frontend rules.
