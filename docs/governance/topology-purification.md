# Topology Purification Governance

## Purpose

LetBuyy uses one canonical runtime map. Transitional aliases, placeholder app roots, nested runtime trees, debug outputs, and duplicate operator surfaces make ownership ambiguous and are not allowed in active topology.

## Canonical Runtime Authority

Active app runtimes are:

- `apps/commerce/web`
- `apps/merchant/web`
- `apps/platform/identity`
- `apps/frozen/app-store`
- `apps/frozen/developer-portal`
- `apps/frozen/theme-store`
- `apps/marketing/web`
- `apps/internal/console`
- `apps/frozen/operations-portal`
- `apps/merchant/mobile`

Reserved mobile roots are not active app runtimes and must remain manifest-and-AGENTS-only until human-approved activation governance adds real gateway-wired source, tests, and deployment config:

- `apps/reserved/legacy-shopper-mobile`
- `apps/reserved/legacy-operator-mobile`

Active service runtime authority is documented in `docs/governance/runtime-boundaries.md` and enforced by `scripts/validators/runtime-validator.mjs`.

## Forbidden Transitional Roots

The following paths are retired and must not be recreated:

- `apps/admin`
- `apps/auth`
- `apps/checkout`
- `apps/internal`
- `apps/merchant`
- `apps/storefront`
- `apps/analytics`
- `apps/mobile/operator-team-app`
- `apps/commerce/web/consumer-storefront`

References to these paths are valid only inside archived historical documents under `docs/archive/` or in validator forbidden-path lists.

## Runtime Migration Rules

- Rename a runtime only by updating imports, package/workspace manifests, deployment config, CI, validators, governance docs, and generated intelligence in one reviewed change.
- Do not keep alias app roots as compatibility placeholders after migration.
- Do not create an app root that contains only `AGENTS.md` unless the root is listed as a canonical reserved runtime.
- Move reusable source into canonical runtime `src/` trees or packages before deleting transitional folders.
- Preserve archived historical context under `docs/archive/`; do not treat archived paths as active topology.

## Storefront Runtime Policy

`apps/commerce/web` is the sole storefront runtime root. Coming-soon rendering lives under `apps/commerce/web/src/components/coming-soon`. Theme previews, tenant pages, checkout, cart, customer accounts, and policy routes live under the canonical storefront app tree.

Nested `consumer-storefront` trees are forbidden because they create duplicate source authority and confuse import graph ownership.

## Platform Operations Policy

`apps/internal/console` owns privileged super-admin governance. `apps/frozen/operations-portal` owns employee support and operations workflows. `apps/reserved/legacy-operator-mobile` is the only reserved native operator companion root and is not active until activation governance lands.

Employee mobile scaffolds must not be added unless a new canonical runtime is approved and validators are updated before source is committed.

## Debug Artifact Policy

Debug logs, runtime traces, raw validation logs, and local scan maps are not repository memory. Summarize durable findings in `docs/governance/` and delete raw artifacts before handoff.

## Enforcement

- `scripts/validators/runtime-validator.mjs` rejects unexpected app roots and forbidden topology paths.
- `scripts/validators/architecture-validator.mjs` requires this policy and rejects forbidden runtime roots.
- `scripts/validators/import-validator.mjs` rejects imports into deprecated runtime topology.
- `scripts/validators/generated-artifact-validator.mjs` rejects tracked generated, debug, and forbidden topology artifacts.
- `scripts/validators/stale-artifact-validator.mjs` rejects local debug artifacts and forbidden topology paths before completion.
