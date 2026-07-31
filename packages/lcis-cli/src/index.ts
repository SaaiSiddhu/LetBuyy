/**
 * @letbuyy/lcis-cli — public re-exports for testing.
 * The CLI entry point is src/cli.ts; this module exposes testable internals.
 */

export { run } from './cli';
export type { IO } from './cli';

export {
  toJson,
  toYaml,
  toTable,
  toCsv,
  toMarkdown,
  render,
  renderEnvelope,
  resolveMode,
  exportToFile,
  evidenceLines,
} from './format';

export type { OutputMode, BlastSummary } from './format';
