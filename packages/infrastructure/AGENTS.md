# Infrastructure Adapter Package Governance

Purpose: Provider SDK, external API, storage, queue, cache, analytics, search, and payment adapter boundary.

## Ownership Rules

- Own SDK integrations, external provider APIs, provider normalization, retries, provider contracts, and external API translation.
- Keep business workflow sequencing in `packages/application-services`.
- Keep HTTP route handling, rendering, and deployment bootstrapping inside apps or services.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, generated output, or runtime-local env modules.
- Do not import application routes or UI. Provider adapters may import provider SDKs and pure shared/domain contracts only.

## Runtime Authority

- This package does not deploy independently.
- Apps and services may depend on adapter exports to avoid direct provider SDK coupling.

## Migration Notes

- New provider integration starts here before runtime adoption.
- Adapter functions must accept explicit env/config inputs or well-documented runtime env names and must return provider-neutral results where possible.
