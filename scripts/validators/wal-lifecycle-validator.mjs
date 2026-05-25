import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("WAL lifecycle validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const wal = manifest?.walLifecycle || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "WAL lifecycle must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "WAL lifecycle must fail closed");
reporter.assert(wal.engineSource === "packages/distributed-runtime/src/wal-lifecycle-runtime.ts", "WAL lifecycle engine must live in distributed-runtime");
reporter.assert(wal.segmentFunction === "segmentExecutionWal", "WAL lifecycle must name segment function");
reporter.assert(wal.planFunction === "compileWalLifecyclePlan", "WAL lifecycle must name plan compiler");
reporter.assert(wal.restorationFunction === "restoreWalEntriesFromCursor", "WAL lifecycle must name cursor restoration function");
reporter.assert(wal.assertionFunction === "assertWalLifecycleDeterministic", "WAL lifecycle must name deterministic assertion");
reporter.assert(wal.rotationPolicy === "deterministic-sequence-window-rotation", "WAL rotation must be deterministic");
reporter.assert(wal.compactionPolicy === "replay-safe-snapshot-before-compaction", "WAL compaction must be replay-safe");
reporter.assert(wal.corruptionPolicy === "checksum-lineage-hard-fail", "WAL corruption detection must hard fail");
reporter.assert(wal.cursorPolicy === "replay-cursor-restored-from-segment-boundary", "WAL cursor restoration must be governed");
reporter.assert(wal.archivalPolicy === "wal-ancestry-required-before-cold-archive", "WAL archival must require ancestry");

const source = readFile(wal.engineSource || "");
for (const fragment of [
  "segmentExecutionWal",
  "compileWalLifecyclePlan",
  "restoreWalEntriesFromCursor",
  "assertWalLifecycleDeterministic",
  "WAL corruption undetectable",
  "replay cursor restoration impossible",
  "WAL archival unsafe",
  "replaySafeWalCompaction",
]) {
  reporter.assert(source.includes(fragment), `WAL lifecycle source missing fragment: ${fragment}`);
}

reporter.finish("WAL rotation, compaction, cursor restoration, lineage, and archival governance checked");
