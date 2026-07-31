/**
 * Hand-rolled serializers for LCIS CLI output.
 * NO external deps (no js-yaml). Deterministic, no floats-in-strings issues.
 */
import { writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import type { LcisEnvelope } from '@letbuyy/lcis-core';

// ---------------------------------------------------------------------------
// Output mode resolution
// ---------------------------------------------------------------------------

export type OutputMode = 'json' | 'yaml' | 'table' | 'csv' | 'markdown';

export function resolveMode(
  modeFlag: string | undefined,
  formatFlag: string | undefined,
): OutputMode {
  const raw = (modeFlag ?? formatFlag ?? 'table').toLowerCase();
  if (raw === 'json') return 'json';
  if (raw === 'yaml') return 'yaml';
  if (raw === 'csv') return 'csv';
  if (raw === 'markdown') return 'markdown';
  return 'table';
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

export function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

// ---------------------------------------------------------------------------
// YAML — simple, deterministic. Handles nested objects/arrays/primitives.
// No anchors, no block scalars for long strings (uses flow strings).
// ---------------------------------------------------------------------------

function yamlScalar(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  // Quote if contains special chars or is empty
  if (
    s === '' ||
    s.includes('\n') ||
    s.includes(':') ||
    s.includes('#') ||
    s.startsWith('-') ||
    s.startsWith('{') ||
    s.startsWith('[') ||
    s === 'true' ||
    s === 'false' ||
    s === 'null' ||
    /^\d/.test(s)
  ) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  }
  return s;
}

function yamlValue(v: unknown, indent: number): string {
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    const pad = ' '.repeat(indent + 2);
    return '\n' + v.map((item) => `${pad}- ${yamlValue(item, indent + 2).trimStart()}`).join('\n');
  }
  if (v !== null && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const pad = ' '.repeat(indent + 2);
    return (
      '\n' +
      entries
        .map(([k, val]) => {
          const rendered = yamlValue(val, indent + 2);
          if (rendered.startsWith('\n')) return `${pad}${k}:${rendered}`;
          return `${pad}${k}: ${rendered}`;
        })
        .join('\n')
    );
  }
  return yamlScalar(v);
}

export function toYaml(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const rendered = yamlValue(item, 0);
        return rendered.startsWith('\n') ? `-${rendered}` : `- ${rendered}`;
      })
      .join('\n');
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        const rendered = yamlValue(v, 0);
        if (rendered.startsWith('\n')) return `${k}:${rendered}`;
        return `${k}: ${rendered}`;
      })
      .join('\n');
  }
  return yamlScalar(value);
}

// ---------------------------------------------------------------------------
// Table — aligned columns from an array of flat objects (or a single object).
// ---------------------------------------------------------------------------

function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      out[key] = v.join(', ');
    } else if (v !== null && typeof v === 'object') {
      Object.assign(out, flatten(v as Record<string, unknown>, key));
    } else {
      out[key] = v == null ? '' : String(v);
    }
  }
  return out;
}

export function toTable(value: unknown): string {
  const rows = Array.isArray(value)
    ? value
    : value !== null && typeof value === 'object'
      ? [value]
      : [{ value: String(value) }];

  const flatRows = (rows as unknown[]).map((r) =>
    r !== null && typeof r === 'object'
      ? flatten(r as Record<string, unknown>)
      : { value: String(r) },
  );
  if (flatRows.length === 0) return '(empty)';

  const allKeys = Array.from(new Set(flatRows.flatMap((r) => Object.keys(r))));
  // Column widths = max(header length, max cell length)
  const widths = allKeys.map((k) =>
    Math.max(k.length, ...flatRows.map((r) => (r[k] ?? '').length)),
  );

  const sep = widths.map((w) => '-'.repeat(w)).join(' | ');
  const header = allKeys.map((k, i) => k.padEnd(widths[i]!)).join(' | ');
  const dataRows = flatRows.map((r) =>
    allKeys.map((k, i) => (r[k] ?? '').padEnd(widths[i]!)).join(' | '),
  );

  return [header, sep, ...dataRows].join('\n');
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function csvCell(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function toCsv(value: unknown): string {
  const rows = Array.isArray(value)
    ? value
    : value !== null && typeof value === 'object'
      ? [value]
      : [{ value: String(value) }];

  const flatRows = (rows as unknown[]).map((r) =>
    r !== null && typeof r === 'object'
      ? flatten(r as Record<string, unknown>)
      : { value: String(r) },
  );
  if (flatRows.length === 0) return '';

  const allKeys = Array.from(new Set(flatRows.flatMap((r) => Object.keys(r))));
  const header = allKeys.map(csvCell).join(',');
  const dataRows = flatRows.map((r) => allKeys.map((k) => csvCell(r[k] ?? '')).join(','));
  return [header, ...dataRows].join('\n');
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

export function toMarkdown(value: unknown): string {
  const rows = Array.isArray(value)
    ? value
    : value !== null && typeof value === 'object'
      ? [value]
      : [{ value: String(value) }];

  const flatRows = (rows as unknown[]).map((r) =>
    r !== null && typeof r === 'object'
      ? flatten(r as Record<string, unknown>)
      : { value: String(r) },
  );
  if (flatRows.length === 0) return '_empty_';

  const allKeys = Array.from(new Set(flatRows.flatMap((r) => Object.keys(r))));
  const header = `| ${allKeys.join(' | ')} |`;
  const sep = `| ${allKeys.map(() => '---').join(' | ')} |`;
  const dataRows = flatRows.map((r) => `| ${allKeys.map((k) => r[k] ?? '').join(' | ')} |`);
  return [header, sep, ...dataRows].join('\n');
}

// ---------------------------------------------------------------------------
// Render dispatcher
// ---------------------------------------------------------------------------

export function render(mode: OutputMode, value: unknown): string {
  switch (mode) {
    case 'json':
      return toJson(value);
    case 'yaml':
      return toYaml(value);
    case 'csv':
      return toCsv(value);
    case 'markdown':
      return toMarkdown(value);
    default:
      return toTable(value);
  }
}

// ---------------------------------------------------------------------------
// Export to file (only permitted write in the CLI)
// ---------------------------------------------------------------------------

/**
 * Resolve a user-supplied output path against a root (cwd), refusing any path that escapes the
 * root (traversal or absolute-outside-root), is empty, or contains a null byte. This is the ONLY
 * guard on the single permitted file write (`--export`) in the otherwise read-only CLI — argv can
 * derive from untrusted CI/PR metadata, so the path is treated as untrusted.
 * (Intentionally duplicated in lcis-pr-check to keep the engine core, lcis-core, IO-free.)
 */
export function safeOutputPath(p: string, root: string = process.cwd()): string {
  if (typeof p !== 'string' || p.length === 0) throw new Error('refusing to write: output path is empty');
  if (p.includes('\0')) throw new Error('refusing to write: output path contains a null byte');
  const resolved = resolve(root, p);
  const rel = relative(root, resolved);
  if (rel === '') throw new Error(`refusing to write to the working directory itself: ${p}`);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`refusing to write outside the working directory: ${p}`);
  }
  return resolved;
}

export function exportToFile(path: string, content: string): void {
  writeFileSync(safeOutputPath(path), content, 'utf-8');
}

// ---------------------------------------------------------------------------
// Evidence rendering helpers
// ---------------------------------------------------------------------------

export function evidenceLines(
  evidence: ReadonlyArray<{ kind?: string; ref?: string; detail?: string; source?: string } | string>,
): string[] {
  return evidence.map((e, i) => {
    if (typeof e === 'string') return `  [${i + 1}] ${e}`;
    const parts: string[] = [];
    if (e.kind) parts.push(e.kind);
    if (e.ref) parts.push(e.ref);
    if (e.detail) parts.push(`— ${e.detail}`);
    return `  [${i + 1}] ${parts.join(' ')}`;
  });
}

// ---------------------------------------------------------------------------
// Blast-specific structured output
// ---------------------------------------------------------------------------

export interface BlastSummary {
  symbol: string;
  resolvedId: string;
  file: string;
  degree: number;
  impactedNodes: number;
  impactedFiles: number;
  layers: string;
  criticality: string;
  affectedDomains: string[];
  affectedServices: string[];
  topAffectedFiles: string[];
  risk: string;
  evidence: string[];
}

// ---------------------------------------------------------------------------
// Envelope rendering for human-readable modes
// ---------------------------------------------------------------------------

export function renderEnvelope<T>(
  env: LcisEnvelope<T>,
  mode: OutputMode,
  includeEvidence: boolean,
): string {
  if (mode === 'json') return toJson(env);
  if (mode === 'yaml') return toYaml(env);

  // For table/csv/markdown: render the data payload, then append envelope meta
  const dataStr = render(mode, env.data);
  const meta = [
    `source: ${env.source}`,
    `confidence: ${(env.confidence * 100).toFixed(0)}%`,
    `executionTime: ${env.executionTime}ms`,
    `version: ${env.version}`,
    `timestamp: ${env.timestamp}`,
  ].join('  |  ');

  const evidencePart =
    includeEvidence && env.evidence.length > 0
      ? '\n\nEvidence:\n' +
        evidenceLines(
          env.evidence as ReadonlyArray<
            { kind?: string; ref?: string; detail?: string; source?: string } | string
          >,
        ).join('\n')
      : '';

  return `${dataStr}\n\n${meta}${evidencePart}`;
}
