# Theme Runtime Governance

The storefront runtime currently contains the active theme presentation authority. This is a governed transitional architecture, not permission to create nested runtime roots.

## Current Source Authority

- Storefront runtime: `apps/storefront-runtime`
- Theme engine modules: `apps/storefront-runtime/src/lib/theme-engine`
- Section renderer components: `apps/storefront-runtime/src/components/sections`
- Theme marketplace: `apps/theme-marketplace`

## Separation of Concerns

- Storefront runtime owns request handling, tenant resolution, customer-facing rendering, cart, checkout, and public policy/customer account surfaces.
- Theme engine owns template resolution, section composition, renderer registry, data binding, and content/product route adaptation.
- Section renderer owns presentational section components.
- CMS data owns merchant-authored content and site configuration, not runtime control flow.
- Merchant config owns theme selection and settings, not renderer implementation.
- Theme marketplace owns discovery and acquisition, not live storefront rendering.

## Forbidden Patterns

- Recreating `apps/storefront-runtime/consumer-storefront`.
- Importing theme marketplace code into the storefront runtime as live render authority.
- Treating generated theme preview output as source.
- Moving business logic into section components.
- Binding theme rendering directly to provider secrets or app-local env values.

## Migration Direction

Future extraction may move reusable theme engine logic into `packages/theme-engine` after contracts stabilize. Until then:

- keep live rendering inside `apps/storefront-runtime`
- keep marketplace acquisition inside `apps/theme-marketplace`
- keep shared contracts typed before reuse
- document new renderer contracts before extracting package code

## Enforcement

- `runtime-validator` and `generated-artifact-validator` forbid nested `consumer-storefront` topology.
- `import-validator` blocks runtime leakage through deprecated paths.
- `dependency-graph-validator` prevents app-to-app theme coupling.
