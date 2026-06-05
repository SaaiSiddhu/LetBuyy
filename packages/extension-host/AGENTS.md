# Extension Host Package Governance

Purpose: Pure host policy and normalization contracts for app extension surfaces, including admin UI, checkout UI, and future sandboxed host mounts.

Boundary: `packages/extension-host`.

Rules:

- No imports from `apps/*`, `services/*`, `legacy/*`, or repository-level `infrastructure/*`.
- Keep this package pure: no runtime fetches, secrets, browser globals, provider SDKs, or database clients.
- UI extension hosts must default to sandboxed rendering and least-privilege bridge capabilities.
- Function execution policy belongs to gateway runtime code; this package may publish typed host metadata only.

Dependency Rules:

- Depend only on shared package contracts or local pure utilities.
- Expose intentional public contracts through `src/index.ts` and package `exports`.

Runtime Authority:

- This package does not deploy independently and owns no routes, worker bindings, environment files, or generated artifacts.
- Apps and services may consume the host policy through public exports only.

Migration Notes:

- Keep admin, checkout, and theme host contracts additive and versioned.
- Promote shared logic here before duplicating sandbox policy in runtime apps.
