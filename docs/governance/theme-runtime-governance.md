# Theme Runtime Governance

The storefront runtime currently contains the active theme presentation authority. This is a governed transitional architecture, not permission to create nested runtime roots.

## Current Source Authority

- Storefront runtime: `apps/commerce/web`
- Theme contracts and schema registry: `packages/theme-engine`
- Live theme engine modules: `apps/commerce/web/src/lib/theme-engine`
- Section renderer components: `apps/commerce/web/src/components/sections`
- Theme marketplace: `apps/frozen/theme-store`

## Separation of Concerns

- Storefront runtime owns request handling, tenant resolution, customer-facing rendering, cart, checkout, and public policy/customer account surfaces.
- Theme engine owns template resolution, section composition, renderer registry, data binding, and content/product route adaptation.
- Section renderer owns presentational section components.
- CMS data owns merchant-authored content and site configuration, not runtime control flow.
- Merchant config owns theme selection and settings, not renderer implementation.
- Theme marketplace owns discovery and acquisition, not live storefront rendering.

## Forbidden Patterns

- Recreating `apps/commerce/web/consumer-storefront`.
- Importing theme marketplace code into the storefront runtime as live render authority.
- Treating generated theme preview output as source.
- Moving business logic into section components.
- Binding theme rendering directly to provider secrets or app-local env values.

## Migration Direction

Contract extraction has begun in `packages/theme-engine`. Runtime rendering migration is still explicit future work. Until then:

- keep live rendering inside `apps/commerce/web`
- keep contracts, schemas, templates, releases, and hydration contracts in `packages/theme-engine`
- keep marketplace acquisition inside `apps/frozen/theme-store`
- keep shared contracts typed before reuse
- document new renderer contracts before extracting package code

## Enforcement

- `runtime-validator` and `generated-artifact-validator` forbid nested `consumer-storefront` topology.
- `import-validator` blocks runtime leakage through deprecated paths.
- `dependency-graph-validator` prevents app-to-app theme coupling.
- `domain-boundary-validator` prevents `@letbuyy/api-types` and storefront app type files from duplicating theme-engine authority.
