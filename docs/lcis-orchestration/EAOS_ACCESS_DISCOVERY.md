# EAOS Access Discovery

**Purpose:** Exact extension points for adding `@letbuyy/lcis-orchestration` (EAOS — the next LCIS layer) across the four LCIS access surfaces: CLI, MCP, API, and PR-Check. Every signature and count below is quoted directly from the source files; nothing is invented.

---

## 1. CLI — `packages/lcis-cli/src/cli.ts`

### Entry point

```ts
export async function run(argv: string[], io: IO = defaultIO): Promise<number>
```

`run` is the only public export. Tests call it as `run(['engineering', 'my feature'])`. Exit codes: `0` = success, `1` = any error.

### IO interface (lines 33–36)

```ts
export interface IO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}
```

### Shared option helpers (lines 54–85)

```ts
type CommonOpts = {
  json?: boolean;
  yaml?: boolean;
  table?: boolean;
  format?: string;
  export?: string;
  evidence?: boolean;
};

function addCommonOptions(cmd: Command): Command  // adds --json, --yaml, --table, --format, --export, --evidence

function writeOut(text: string, exportPath: string | undefined, io: IO): void
// calls io.stdout(text) then exportToFile(exportPath, text + '\n') when exportPath is set

function pickMode(opts: CommonOpts): OutputMode
// returns 'json' | 'yaml' | 'table' based on opts flags; delegates to resolveMode()
```

### Output envelope helper (shared across all phases)

Every command calls:

```ts
const env = envelope({ data, source: 'some/source', executionTime: t.ms(), evidence: ev });
const out = renderEnvelope(env, mode, Boolean(opts.evidence));
writeOut(out, opts.export, io);
```

`envelope` is imported from `@letbuyy/lcis-core`. The `LcisEnvelope` shape (as seen emitted) contains at minimum: `data`, `source`, `executionTime`, `evidence`, `confidence`, `timestamp`.

### Phase-7 EINS command group — how it is wired (lines 1544–1764)

There is **no `registerEngineering()` helper function**. Each EINS command is registered directly on the top-level `program` (not a sub-command group). The pattern for each command is identical:

```ts
import { getEngineeringEngine } from '@letbuyy/lcis-engineering';
import type { FeatureRequest } from '@letbuyy/lcis-engineering';

// Per-command FeatureRequest builder
function buildFeatureRequest(
  words: string[],
  opts: { domain?: string | string[]; seedTable?: string | string[]; symbol?: string | string[] },
): FeatureRequest {
  const text = words.join(' ').trim() || '(unspecified)';
  const toArray = (v: string | string[] | undefined): string[] =>
    v === undefined ? [] : Array.isArray(v) ? v : [v];
  return { text, domains: toArray(opts.domain), tables: toArray(opts.seedTable), symbols: toArray(opts.symbol) };
}

type EinsOpts = CommonOpts & {
  domain?: string | string[];
  seedTable?: string | string[];
  symbol?: string | string[];
};

function addEinsOptions(cmd: Command): Command {
  cmd
    .option('--domain <d...>', 'Seed domains (repeatable)')
    .option('--seed-table <t...>', 'Seed tables (repeatable)')
    .option('--symbol <s...>', 'Seed symbols (repeatable)');
  return addCommonOptions(cmd);
}

function emitEins(
  artifactData: { evidence?: readonly unknown[]; confidence?: number } & Record<string, unknown>,
  source: string,
  executionTimeMs: number,
  opts: CommonOpts,
  ioTarget: IO,
): void {
  const evidence = (artifactData.evidence ?? []) as Evidence[];
  const env = envelope({ data: artifactData, source, executionTime: executionTimeMs, evidence });
  const mode = pickMode(opts);
  const out = renderEnvelope(env, mode, Boolean(opts.evidence));
  writeOut(out, opts.export, ioTarget);
}
```

### Current EINS commands registered (all on `program`, not a sub-group)

| CLI command | EINS method | async? | source string |
|---|---|---|---|
| `lcis engineering <text...>` | `eins.generateFullEngineeringPackage(req)` | yes | `'engineering/package'` |
| `lcis blueprint <text...>` | `eins.generateBlueprint(req)` | yes | `'engineering/blueprint'` |
| `lcis tasks <text...>` | `eins.generateTasks(req)` | no | `'engineering/tasks'` |
| `lcis rollout <text...>` | `eins.generateLaunchPlan(req)` | yes | `'engineering/rollout'` |
| `lcis rollback <text...>` | `eins.generateRollbackPlan(req)` | no | `'engineering/rollback'` |
| `lcis eng-verify <text...>` | `eins.generateVerificationPlan(req)` | no | `'engineering/verification'` |
| `lcis agent-plan <text...>` | `eins.generateAgentPlan(req)` | no | `'engineering/agent-plan'` |

### How to add EAOS commands

Add new top-level commands directly on `program` inside `run()`, following the exact EINS pattern above. Import the engine from `@letbuyy/lcis-orchestration`:

```ts
import { getOrchestrationEngine } from '@letbuyy/lcis-orchestration';
import type { OrchestrationRequest } from '@letbuyy/lcis-orchestration';
```

Then wire a command:

```ts
addEinsOptions(                          // reuse addEinsOptions — shares the same option set
  program
    .command('orchestrate <text...>')
    .description('EAOS: orchestrate …')
    .action(async (words: string[], opts: EinsOpts) => {
      const t = new Timer();
      try {
        const eaos = getOrchestrationEngine();
        const req = buildFeatureRequest(words, opts);   // buildFeatureRequest is already defined above
        const result = await eaos.orchestrate(req);
        emitEins(result as unknown as Record<string, unknown>, 'orchestration/…', t.ms(), opts, io);
      } catch (err: unknown) {
        userError(err instanceof Error ? err.message : String(err), io);
        exitCode = 1;
      }
    }),
);
```

No registration helper is needed. The command goes into the same `run()` body, before the `version` command near line 1769.

---

## 2. MCP — `packages/lcis-mcp/src/tools.ts`

### `ToolDef` interface (lines 28–33)

```ts
export interface ToolDef<TShape extends z.ZodRawShape | Record<string, never>> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: TShape;
  handler(input: z.infer<z.ZodObject<TShape>>, engine: LcisEngine): Promise<ToolResult>;
}
```

Fields:
- `name` — the MCP tool name string (e.g. `'lcis_engineering_blueprint'`)
- `description` — ≥ 10-char string, shown to model
- `inputSchema` — a Zod raw shape object (keys → Zod schemas), or `{}` for no-arg tools
- `handler` — async function receiving validated input + the `LcisEngine`; returns `ToolResult`

### `ToolResult` type (line 26)

```ts
export type ToolResult = { content: [{ type: 'text'; text: string }] };
```

All handlers return `ok(JSON.stringify(env, null, 2))` where `env` is built via `toText(data, source, ms)` (lines 41–54).

### Registry array (lines 1176–1223)

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TOOLS: readonly ToolDef<any>[] = [
  // … 42 entries …
] as const;
```

Name: `TOOLS`. Exported from `packages/lcis-mcp/src/tools.ts`, re-exported from `packages/lcis-mcp/src/index.ts` as `{ TOOLS, createServer }`.

### Helper functions used inside handlers

```ts
function ok(text: string): ToolResult
// returns { content: [{ type: 'text', text }] }

function toText(data: unknown, source: string, executionTime: number): ToolResult
// wraps data in envelope(), returns ok(JSON.stringify(env, null, 2))

function notFound(subject: string, source: string, ms: number): ToolResult
// returns toText({ found: false, subject, note: '…run pnpm graph:omega…' }, source, ms)
```

### Current EINS tools registered (7, at lines 1215–1222)

```ts
engineeringBlueprintTool,     // lcis_engineering_blueprint
engineeringTasksTool,         // lcis_engineering_tasks
engineeringRolloutTool,       // lcis_engineering_rollout
engineeringVerificationTool,  // lcis_engineering_verification
engineeringRollbackTool,      // lcis_engineering_rollback
engineeringAgentPlanTool,     // lcis_engineering_agent_plan
engineeringPackageTool,       // lcis_engineering_package
```

### Current tool count and test assertion

**Current total: 42 tools.**

The test file at `packages/lcis-mcp/test/tools.test.ts` (line 71) asserts:

```ts
test('TOOLS registry contains exactly 42 tools (7 core + 5 live + 7 plan + 7 governance + 9 operations + 7 engineering)', () => {
  assert.equal(TOOLS.length, 42);
});
```

And at line 454:

```ts
test('All 42 tool names are unique', () => {
  const names = TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, 42);
});
```

**When EAOS tools are added**, update both count assertions from `42` to the new total (e.g. `49` for 7 new tools). Both test strings also contain the breakdown comment — update that too.

### How to add EAOS tools

Define a typed const before the `// ── Registry ──` comment (line 1173), following the EINS pattern:

```ts
// shared input shape for all EAOS tools (mirror einsInputShape)
const eaosInputShape = {
  request: z.string().min(1).describe('Natural-language description …'),
  domains: z.array(z.string()).optional().describe('…'),
  tables: z.array(z.string()).optional().describe('…'),
  symbols: z.array(z.string()).optional().describe('…'),
};

function buildEaosRequest(input: { request: string; domains?: string[]; tables?: string[]; symbols?: string[] }) {
  return { text: input.request, domains: input.domains, tables: input.tables, symbols: input.symbols };
}

const orchestrateTool: ToolDef<typeof eaosInputShape> = {
  name: 'lcis_orchestrate',
  description: 'EAOS orchestration: …',
  inputSchema: eaosInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eaos = getOrchestrationEngine();
    const result = await eaos.orchestrate(buildEaosRequest(input));
    const ms = t.ms();
    return toText(result, 'orchestration', ms);
  },
};
```

Then append to `TOOLS`:

```ts
export const TOOLS: readonly ToolDef<any>[] = [
  // … existing 42 …
  // Phase 8: EAOS orchestration tools
  orchestrateTool,
  // …
] as const;
```

Import at the top:

```ts
import { getOrchestrationEngine } from '@letbuyy/lcis-orchestration';
```

---

## 3. API — `services/lcis-api/src/app.ts`

### `envelope(...)` usage pattern

`envelope` is imported from `@letbuyy/lcis-core` and called identically on every route:

```ts
return c.json(
  envelope({
    data: result,
    source: 'engineering-blueprint',  // snake-case string
    executionTime: t.ms(),
    evidence: [...result.evidence],   // spread to avoid readonly array type errors
    requestId: reqId,                 // from requestId(c) helper
  }),
)
```

`requestId(c)` helper (lines 79–81):

```ts
function requestId(c: { get(k: 'requestId'): string | undefined }): string {
  return (c.get('requestId') as string | undefined) ?? newRequestId()
}
```

### `validateBody` pattern (from `./middleware`)

Routes that require a body use the middleware:

```ts
app.post('/engineering/blueprint', validateBody(EngineeringSchema), async (c) => {
  const body = getValidatedBody<z.infer<typeof EngineeringSchema>>(c)
  // body is now typed and validated
})
```

Routes that accept an optional or empty body (Phase 5 GDIS + Phase 6 LCOS pattern) skip `validateBody()` entirely and simply ignore the body:

```ts
app.post('/runtime', async (c) => {
  // no validateBody — body is optional / irrelevant
  const ops = getOperationsEngine()
  const result = ops.runtime()
  return c.json(envelope({ … }))
})
```

### Phase-7 EINS route group (lines 1034–1170)

All EINS routes use a shared `EngineeringSchema` (alias for `PlanSchema`) and `buildFeatureRequest`:

```ts
const EngineeringSchema = PlanSchema  // { text: z.string().min(1), domains?, tables?, symbols? }

function buildFeatureRequest(body: z.infer<typeof EngineeringSchema>) {
  return { text: body.text, domains: body.domains, tables: body.tables, symbols: body.symbols }
}
```

Registered routes:

| Method + Path | EINS method | async? | source string |
|---|---|---|---|
| `POST /engineering/blueprint` | `eins.generateBlueprint(…)` | yes | `'engineering-blueprint'` |
| `POST /engineering/tasks` | `eins.generateTasks(…)` | no | `'engineering-tasks'` |
| `POST /engineering/verification` | `eins.generateVerificationPlan(…)` | no | `'engineering-verification'` |
| `POST /engineering/rollback` | `eins.generateRollbackPlan(…)` | no | `'engineering-rollback'` |
| `POST /engineering/rollout` | `eins.generateLaunchPlan(…)` | yes | `'engineering-rollout'` |
| `POST /engineering/agent-plan` | `eins.generateAgentPlan(…)` | no | `'engineering-agent-plan'` |
| `POST /engineering/package` | `eins.generateFullEngineeringPackage(…)` | yes | `'engineering-package'` |

### No `routes/` directory

`services/lcis-api/src/` contains only: `app.ts`, `index.ts`, `middleware.ts`, `server.ts`. There is no `routes/` subdirectory. All routes live inline in `app.ts` inside `createApp()`.

### How to add EAOS routes

Add a new schema and route group inside `createApp()` in `app.ts`, after the `// ── Phase 7` block (after line 1170) and before the `// ── 404 catch-all` block (line 1172):

```ts
import { getOrchestrationEngine } from '@letbuyy/lcis-orchestration'

// ── Phase 8: EAOS orchestration endpoints ──────────────────────────────────

const OrchestrationSchema = z.object({
  text: z.string().min(1),
  domains: z.array(z.string()).optional(),
  tables: z.array(z.string()).optional(),
  symbols: z.array(z.string()).optional(),
})

// POST /orchestration/…
app.post('/orchestration/run', validateBody(OrchestrationSchema), async (c) => {
  const t = new Timer()
  const reqId = requestId(c)
  const body = getValidatedBody<z.infer<typeof OrchestrationSchema>>(c)
  const eaos = getOrchestrationEngine()
  const result = await eaos.orchestrate({ text: body.text, domains: body.domains, tables: body.tables, symbols: body.symbols })
  return c.json(
    envelope({
      data: result,
      source: 'orchestration-run',
      executionTime: t.ms(),
      evidence: [...result.evidence],
      requestId: reqId,
    }),
  )
})
```

---

## 4. PR-Check — `packages/lcis-pr-check/src/`

### V2→V5 progression (exported functions from `index.ts` line 6)

```ts
export { analyzePr, analyzeWithVerdicts, analyzeWithGovernance, analyzeWithOperations, analyzeWithEngineering } from './analyze';
```

Each function is additive — it calls the previous layer's logic plus its own:

| Function | Added fields on `PrReport` | Engines needed |
|---|---|---|
| `analyzePr` (V1) | `verdicts: []`, `governanceVerdicts: []`, `operationalVerdict: null`, `engineeringVerdicts: []` | core only |
| `analyzeWithVerdicts` (V2) | `verdicts: ReviewVerdict[]` (6) | + EIS |
| `analyzeWithGovernance` (V3) | + `governanceVerdicts: GovernanceVerdict[]` (6) | + GDIS |
| `analyzeWithOperations` (V4) | + `operationalVerdict: OperationalVerdict \| null` (1) | + LCOS |
| `analyzeWithEngineering` (V5) | + `engineeringVerdicts: EngineeringVerdict[]` (6) | + EINS |

### `analyzeWithEngineering` signature (lines 1591–1615 of `analyze.ts`)

```ts
export async function analyzeWithEngineering(
  rawInput: unknown,
  engineOverride?: LcisEngine,
  eisOverride?: EisEngine,
  govOverride?: GovernanceEngine,
  opsOverride?: OperationsEngine,
  einsOverride?: EngineeringEngine,
): Promise<PrReport>
```

Internally runs:

```ts
const [verdicts, governanceVerdicts, engineeringVerdicts] = await Promise.all([
  buildVerdicts(eis, report, changedFiles),
  buildGovernanceVerdicts(gov, report),
  buildEngineeringVerdicts(eins, report, changedFiles),
]);
const operationalVerdict = buildOperationalVerdict(ops, changedFiles, affectedDomainKeys);
return { ...report, verdicts, governanceVerdicts, operationalVerdict, engineeringVerdicts };
```

### `EngineeringVerdict` type (imported from `@letbuyy/lcis-engineering`)

Used in `types.ts` line 10 and re-exported at line 16:

```ts
import type { EngineeringVerdict } from '@letbuyy/lcis-engineering';
export type { EngineeringVerdict };
```

The six dimensions built by `buildEngineeringVerdicts()` (lines 1344–1540):

```
'engineering-readiness'     → pkg.decision.verdict (GO/CONDITIONAL_GO/NO_GO)
'engineering-complexity'    → blueprint.impact.complexity.band (trivial/low/moderate/high/severe)
'engineering-risk'          → blueprint.impact.risk.level (low/medium/high/critical)
'engineering-coverage'      → blueprint.gates where category === 'gap'
'engineering-rollback'      → blueprint.rollback.readiness (READY/CONDITIONAL/NOT_READY)
'engineering-verification'  → blueprint.gates where category === 'gate' | 'blocker'
```

Each verdict shape matches `ReviewVerdict`:

```ts
{
  dimension: 'engineering-readiness' | 'engineering-complexity' | …;
  verdict: 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN';
  summary: string;
  findings: string[];
  evidence: Evidence[];
}
```

### `engineeringVerdicts` in `PrReport` (types.ts lines 128–136)

```ts
/**
 * Six EINS (Engineering Intelligence System) verdicts: engineering-readiness /
 * engineering-complexity / engineering-risk / engineering-coverage /
 * engineering-rollback / engineering-verification.
 * Empty array in the synchronous analyzePr() path (back-compat). Populated by
 * analyzeWithEngineering(). Never fabricated — UNKNOWN when a signal cannot be
 * determined.
 */
engineeringVerdicts: EngineeringVerdict[];
```

### `## LCIS ENGINEERING` comment section format in `comment.ts` (lines 168–197)

```ts
function renderEngineeringVerdicts(verdicts: EngineeringVerdict[]): string {
  if (verdicts.length === 0) return '';
  const lines: string[] = [];
  lines.push('## LCIS ENGINEERING');
  lines.push('');
  for (const v of verdicts) {
    const emoji = ENG_VERDICT_EMOJI[v.verdict];
    lines.push(`### ${v.dimension.toUpperCase()}: ${emoji} ${v.verdict} — ${v.summary}`);
    if (v.findings.length > 0) {
      for (const f of v.findings) {
        lines.push(`- ${f}`);
      }
    }
    if (v.evidence.length > 0) {
      const refs = v.evidence.map((e) => `\`${e.ref}\``).slice(0, 3).join(', ');
      lines.push(`_Evidence: ${refs}_`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
```

Emitted in `renderComment()` (line 317) as:

```ts
if (report.engineeringVerdicts && report.engineeringVerdicts.length > 0) {
  lines.push(renderEngineeringVerdicts(report.engineeringVerdicts));
}
```

And in `renderSummary()` (lines 387–393) as:

```ts
if (report.engineeringVerdicts && report.engineeringVerdicts.length > 0) {
  lines.push('');
  const engLine = report.engineeringVerdicts
    .map((v) => `${ENG_VERDICT_EMOJI[v.verdict]} ${v.dimension}`)
    .join(' · ');
  lines.push(`**Engineering:** ${engLine}`);
}
```

### V6 extension point: `## LCIS EXECUTION`

V6 adds an EAOS execution layer following the exact V5 pattern. All changes are additive:

**Step 1 — `types.ts`:** Add `ExecutionVerdict` import and field:

```ts
import type { ExecutionVerdict } from '@letbuyy/lcis-orchestration';
export type { ExecutionVerdict };

// In PrReport interface — add after engineeringVerdicts:
/**
 * EAOS execution verdicts. Empty array in all prior paths (back-compat).
 * Populated by analyzeWithExecution(). Never fabricated — UNKNOWN when indeterminate.
 */
executionVerdicts: ExecutionVerdict[];
```

Also add `executionVerdicts: []` to the initial `report` object in `_coreAnalyze()` (line 1237 area).

**Step 2 — `analyze.ts`:** Add `buildExecutionVerdicts()` function and `analyzeWithExecution()` entry point following the V5 template exactly:

```ts
import { createOrchestrationEngine } from '@letbuyy/lcis-orchestration';
import type { OrchestrationEngine, ExecutionVerdict } from '@letbuyy/lcis-orchestration';

async function buildExecutionVerdicts(
  eaos: OrchestrationEngine,
  report: PrReport,
  changedFiles: string[],
): Promise<ExecutionVerdict[]> { … }

export async function analyzeWithExecution(
  rawInput: unknown,
  engineOverride?: LcisEngine,
  eisOverride?: EisEngine,
  govOverride?: GovernanceEngine,
  opsOverride?: OperationsEngine,
  einsOverride?: EngineeringEngine,
  eaosOverride?: OrchestrationEngine,
): Promise<PrReport> {
  // … call all prior builders + buildExecutionVerdicts …
  return { ...report, verdicts, governanceVerdicts, operationalVerdict, engineeringVerdicts, executionVerdicts };
}
```

**Step 3 — `comment.ts`:** Add emoji map and render function:

```ts
const EXEC_VERDICT_EMOJI: Record<ExecutionVerdict['verdict'], string> = {
  PASS: '✅', WARN: '⚠️', FAIL: '❌', UNKNOWN: '❓',
};

function renderExecutionVerdicts(verdicts: ExecutionVerdict[]): string {
  if (verdicts.length === 0) return '';
  const lines: string[] = [];
  lines.push('## LCIS EXECUTION');       // ← the new section header
  lines.push('');
  for (const v of verdicts) {
    const emoji = EXEC_VERDICT_EMOJI[v.verdict];
    lines.push(`### ${v.dimension.toUpperCase()}: ${emoji} ${v.verdict} — ${v.summary}`);
    if (v.findings.length > 0) {
      for (const f of v.findings) lines.push(`- ${f}`);
    }
    if (v.evidence.length > 0) {
      const refs = v.evidence.map((e) => `\`${e.ref}\``).slice(0, 3).join(', ');
      lines.push(`_Evidence: ${refs}_`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
```

Emit in `renderComment()` immediately after the `## LCIS ENGINEERING` block (after line 319), before `**Recommendation:**`:

```ts
// LCIS Execution (V6 section — only when executionVerdicts is non-empty)
if (report.executionVerdicts && report.executionVerdicts.length > 0) {
  lines.push(renderExecutionVerdicts(report.executionVerdicts));
}
```

Add compact line to `renderSummary()` after the Engineering block (after line 393):

```ts
if (report.executionVerdicts && report.executionVerdicts.length > 0) {
  lines.push('');
  const execLine = report.executionVerdicts
    .map((v) => `${EXEC_VERDICT_EMOJI[v.verdict]} ${v.dimension}`)
    .join(' · ');
  lines.push(`**Execution:** ${execLine}`);
}
```

**Step 4 — `index.ts`:** Export the new function and type:

```ts
export { analyzePr, analyzeWithVerdicts, analyzeWithGovernance, analyzeWithOperations, analyzeWithEngineering, analyzeWithExecution } from './analyze';
export type { …, ExecutionVerdict } from './types';
```

---

## 5. Package wiring for `@letbuyy/lcis-orchestration`

### tsconfig paths

Each consuming package has a `tsconfig.json` with `paths` or relies on the workspace `tsconfig.base.json`. The existing pattern (from `@letbuyy/lcis-engineering`) is:

```json
{
  "compilerOptions": {
    "paths": {
      "@letbuyy/lcis-orchestration": ["../../packages/lcis-orchestration/src/index.ts"]
    }
  }
}
```

Add this to the `tsconfig.json` of each consuming package:
- `packages/lcis-cli/tsconfig.json`
- `packages/lcis-mcp/tsconfig.json`
- `services/lcis-api/tsconfig.json`
- `packages/lcis-pr-check/tsconfig.json`

### `package.json` peer/workspace deps

Add to each consumer's `package.json`:

```json
{
  "dependencies": {
    "@letbuyy/lcis-orchestration": "workspace:*"
  }
}
```

### New package skeleton

The new package lives at `packages/lcis-orchestration/` and must export at minimum:

```ts
// packages/lcis-orchestration/src/index.ts
export { getOrchestrationEngine, createOrchestrationEngine } from './engine';
export type { OrchestrationEngine, OrchestrationRequest, ExecutionVerdict } from './types';
```

This mirrors the export shape of `@letbuyy/lcis-engineering`:

```ts
// packages/lcis-engineering/src/index.ts (reference)
export { getEngineeringEngine, createEngineeringEngine } from './engine';
export type { EngineeringEngine, FeatureRequest, EngineeringVerdict } from './types';
```

### Governance validation

After adding a new package or wiring topology changes, run:

```
node scripts/validate-governance.mjs
```

This is the required gate per `CLAUDE.md §Required Validation`.

---

## Quick-reference checklist for implementing EAOS

| Surface | File to edit | What to do |
|---|---|---|
| CLI | `packages/lcis-cli/src/cli.ts` | Add commands on `program` inside `run()`, before `version` command (~line 1769), using `addEinsOptions` + `emitEins` helpers already defined |
| MCP tools | `packages/lcis-mcp/src/tools.ts` | Define `ToolDef<typeof eaosInputShape>` consts; append to `TOOLS` array |
| MCP tests | `packages/lcis-mcp/test/tools.test.ts` | Update count from `42` → new total in lines 71, 76, 454 |
| API routes | `services/lcis-api/src/app.ts` | Add route group after Phase-7 block (~line 1170), before 404 catch-all |
| PR-Check types | `packages/lcis-pr-check/src/types.ts` | Add `ExecutionVerdict` import + `executionVerdicts` field on `PrReport` |
| PR-Check analyze | `packages/lcis-pr-check/src/analyze.ts` | Add `buildExecutionVerdicts()` + `analyzeWithExecution()` + `executionVerdicts: []` default |
| PR-Check comment | `packages/lcis-pr-check/src/comment.ts` | Add `EXEC_VERDICT_EMOJI` map + `renderExecutionVerdicts()` + emit calls in `renderComment` and `renderSummary` |
| PR-Check index | `packages/lcis-pr-check/src/index.ts` | Export `analyzeWithExecution` and `ExecutionVerdict` |
| Governance | — | Run `node scripts/validate-governance.mjs` |
