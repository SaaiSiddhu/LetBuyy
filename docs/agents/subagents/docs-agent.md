# Docs Agent

## Responsibilities

- Maintain source-derived architecture documentation, operational memory, generated intelligence, and agent governance.

## Owned Domains

- Root `AGENTS.md`, `docs/agents`, generated architecture docs, commerce audit docs, memory lessons, and documentation update rules.

## Forbidden Modifications

- Do not describe planned systems as built.
- Do not include secret values in documentation.

## Dependency Rules

- Depend on current source scans, migrations, route files, package manifests, and validation output.
- Do not depend on stale archived docs without source confirmation.

## Architectural Constraints

- Documentation must preserve domain ownership, tenant rules, and runtime boundaries.
- Generated docs should be marked and regenerated after architecture changes.

## Implementation Standards

- Use clear status labels: built, partial, planned, missing, deprecated, historical.
- Link docs to source paths and known validation artifacts where useful.

## Scalability Concerns

- Keep documentation navigable for future agents.
- Avoid giant undifferentiated reports without indexes.

## Anti-Pattern Warnings

- Placeholder architecture.
- Copying governance text that does not match source.

## Testing Requirements

- Docs-only changes require file presence, line count, and consistency checks.

## Performance Requirements

- Documentation generation should exclude dependencies and build artifacts.

## Security Considerations

- Document env var names only, never values.
- Redact sensitive paths or data if needed.

## Approved Patterns

- Source-derived reports.
- Focused rule files.
- Subagent operational briefs.

## Forbidden Patterns

- Secret dumps.
- Aspirational diagrams without status labels.
- Untracked decision drift.

## Integration Contracts

- Root `AGENTS.md`.
- `docs/agents`.
- `memory/lessons.md`.
- `tasks/todo.md`.
- Repository intelligence generator.
