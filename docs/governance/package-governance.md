# Package Governance

## Ownership Requirements

Every package must define:

- Package purpose.
- Owning actor or domain.
- Allowed inbound dependencies.
- Allowed outbound dependencies.
- Public exports.
- Forbidden imports.
- Tenant and security constraints when applicable.

## Manifest Requirements

TypeScript packages require:

- `package.json`
- `src/index.ts`
- `AGENTS.md`
- `typecheck` script when TypeScript is present

Dart packages require:

- `pubspec.yaml`
- `lib/`
- `AGENTS.md`
- analyzer configuration through the root Flutter workspace

## Stability Levels

- Stable: package may be imported by multiple runtimes.
- Incubating: package exists to receive extracted logic; imports require review.
- Compatibility: package preserves existing import names or transition paths.
- Deprecated: package must not receive new behavior and must be moved under `legacy/` if runtime-owned.

## Domain Extraction

Apps may contain UI composition, app-boundary proxy logic, and route-level protocol adaptation. Reusable business behavior must be extracted into the domain package that owns the decision.

