# Runtime Manifest Governance

Runtime manifests are the machine-readable authority for active LetBuyy runtime ownership.

## Required Manifest

Every canonical app and service runtime must contain `runtime.manifest.json`.

Required fields:

- `runtimeName`
- `runtimeRoot`
- `actorType`
- `runtimeCategory`
- `runtimeClassification`
- `ownership`
- `allowedDependencies`
- `forbiddenDependencies`
- `deploymentAuthority`
- `environmentAuthority`
- `observabilityAuthority`

## Canonical Runtime Authority

- Apps under `apps/` own user-facing workflow adaptation.
- Mobile apps under `apps/mobile/` own native actor surfaces.
- Services under `services/` own backend enforcement and provider integration.
- Runtime manifests do not create runtime source authority by themselves; they describe and constrain existing canonical roots.

## Enforcement

`scripts/validators/runtime-manifest-validator.mjs` fails governance when:

- a canonical runtime root is missing a manifest
- a manifest root does not match its directory
- actor classification is missing
- environment schema ownership is invalid
- governance docs referenced by the manifest do not exist
- platform console and platform operations portal actor boundaries blur

## Change Process

1. Update the source tree only after the canonical runtime decision is documented.
2. Add or update the runtime manifest.
3. Update `docs/governance/runtime-boundaries.md` and related governance docs.
4. Update validators if the canonical root set changes.
5. Run `node scripts/validate-governance.mjs`.
