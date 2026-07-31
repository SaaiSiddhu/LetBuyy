# LCIS CLI Guide

Package: `@letbuyy/lcis-cli` | Binary: `lcis` | Framework: Commander 12

---

## Quick Start

```bash
# via pnpm workspace script
pnpm lcis blast getSupabaseAdmin --json

# or run the binary directly after build
./packages/lcis-cli/dist/cli.js blast getSupabaseAdmin --json
```

Proven live output for the above:
```
197 nodes / 115 files / layers [169,26,2] / criticality: critical
```

---

## Global Flags

| Flag | Values | Effect |
|------|--------|--------|
| `--json` | boolean | Emit raw JSON (shorthand for `--format json`) |
| `--yaml` | boolean | Emit YAML |
| `--table` | boolean | Emit ASCII table (default for most commands) |
| `--format` | `json\|yaml\|csv\|markdown` | Explicit format override |
| `--export <path>` | file path | Write output to file (in addition to stdout) |
| `--evidence` | boolean | Include evidence array in output |
| `--depth <n>` | integer | Traverse depth for blast/graph commands |
| `--domain <key>` | string | Filter results to one domain |

---

## Commands

### `blast <symbol>`

Compute the blast radius (impact fan-out) of a named symbol.

```bash
pnpm lcis blast getSupabaseAdmin
pnpm lcis blast create_checkout_order --json --evidence
pnpm lcis blast "@letbuyy/shared-types" --depth 3
```

Output fields:

| Field | Type | Description |
|-------|------|-------------|
| `symbol` | string | Resolved symbol name |
| `nodeCount` | number | Total nodes in blast radius |
| `fileCount` | number | Distinct files affected |
| `layers` | number[] | Nodes per graph depth layer |
| `criticality` | `critical\|high\|medium\|low` | Derived from node count + layer shape |
| `evidence` | string[] | File paths, RPCs, tables in radius |

### `explain <entity>`

Plain-language explanation of a domain, service, table, or runtime component.

```bash
pnpm lcis explain payments
pnpm lcis explain orders --format markdown
pnpm lcis explain storefront-runtime --table
```

The entity is matched against the 22 domain keys, service names, and architecture narrative map. Returns: purpose, owner, criticality, dependencies, consumers, failure impact.

### `verify <entity>`

Structural verification of a system's readiness or correctness posture.

```bash
pnpm lcis verify architecture
pnpm lcis verify production-readiness
pnpm lcis verify runtime
pnpm lcis verify security
```

Verification statuses: `VERIFIED | PARTIAL | UNVERIFIED | REFUTED`

Note: `verify runtime` always returns `PARTIAL` because 13 live signal sources are NOT CONNECTED — this is honest, not a bug.

### `memory <query>`

BM25 full-text recall over the governance corpus (decisions, runbooks, incidents, architecture notes, security findings).

```bash
pnpm lcis memory "why is RLS enforced on tenant tables"
pnpm lcis memory "Razorpay signature verification" --format markdown
```

Output fields: `hits[]` (each with `id`, `score`, `excerpt`, `collection`), `confidence`, `staleness`.

Confidence thresholds: high > 8, medium 4–8, low < 4 (BM25 score).

### `decision <subject>`

Ranked operational decisions: risk prioritization, fix ordering, launch verdict, scale blockers.

```bash
pnpm lcis decision risks
pnpm lcis decision fixes
pnpm lcis decision launch
pnpm lcis decision scale
pnpm lcis decision <id>    # trace a specific decision
```

Subjects:

| Subject | Returns |
|---------|---------|
| `risks` | Ranked risk list with evidence + severity |
| `fixes` | Ranked fix list ordered by impact vs effort |
| `launch` | GO / NO-GO / CONDITIONAL-GO verdict with blockers |
| `scale` | Scale tier blockers (100 merchants / 10k / 100k users) |
| `<id>` | Trace a specific fix or decision by ID |

### `health`

Engine health check: graph stats, cache state, artifact staleness.

```bash
pnpm lcis health
pnpm lcis health --json
```

Returns: `nodeCount`, `edgeCount`, `commit`, `cacheEntries`, `artifactAge`, `version`.

### `graph stats`

Raw graph statistics without engine logic overhead.

```bash
pnpm lcis graph stats
pnpm lcis graph stats --json
```

Returns: `nodeCount`, `edgeCount`, `commit`.

---

## Output Modes

| Mode | Flag | Use case |
|------|------|----------|
| Table | `--table` | Terminal / human review (default for most commands) |
| JSON | `--json` | Scripting, CI, piping |
| YAML | `--yaml` | Config-adjacent workflows |
| CSV | `--format csv` | Spreadsheet export |
| Markdown | `--format markdown` | Docs, PR comments |

### Exporting to File

```bash
pnpm lcis blast create_checkout_order --json --export blast-report.json
pnpm lcis decision launch --format markdown --export launch-verdict.md
```

The `--export` flag writes the output to the given file path AND prints to stdout. This is the only write path in the CLI package.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Command error (bad arguments, schema validation failure) |
| `2` | Engine error (artifact missing, graph load failure) |

---

## Programmatic Use

The CLI exports a `run(argv, io)` function and all format utilities for use in scripts and tests:

```ts
import { run } from '@letbuyy/lcis-cli';

const result = await run(['blast', 'getSupabaseAdmin', '--json'], {
  stdout: process.stdout,
  stderr: process.stderr,
});
```

Format utilities are also exported: `toJson`, `toYaml`, `toTable`, `toCsv`, `toMarkdown`, `render`, `renderEnvelope`, `resolveMode`, `exportToFile`, `evidenceLines`.
