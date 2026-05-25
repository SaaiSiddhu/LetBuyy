import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Resumable execution validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const resumable = manifest?.resumableExecution || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Resumable execution must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Resumable execution must fail closed");
reporter.assert(resumable.engineSource === "packages/distributed-runtime/src/resumable-dag-execution-runtime.ts", "Resumable execution engine must live in distributed-runtime");
reporter.assert(resumable.cursorFunction === "compileResumableDagCursor", "Resumable execution must name cursor compiler");
reporter.assert(resumable.restoreFunction === "restoreExecutionContinuation", "Resumable execution must name continuation restore function");
reporter.assert(resumable.assertionFunction === "assertResumableDagExecution", "Resumable execution must name assertion function");
reporter.assert(resumable.cursorPolicy === "persisted-orchestration-cursor-per-checkpoint", "Resumable execution must persist cursors per checkpoint");
reporter.assert(resumable.continuationPolicy === "dependencies-completed-before-next-node", "Resumable execution must enforce dependency completion");
reporter.assert(resumable.branchPolicy === "execution-branch-continuation-checksum-required", "Resumable branch continuation must be checksummed");
for (const survivalCase of ["restart", "interruption", "partial-compensation", "replay-continuation"]) {
  reporter.assert((resumable.survives || []).includes(survivalCase), `Resumable execution survival case missing: ${survivalCase}`);
}

const source = readFile(resumable.engineSource || "");
for (const fragment of [
  "compileResumableDagCursor",
  "restoreExecutionContinuation",
  "assertResumableDagExecution",
  "DAG continuation ambiguous",
  "checkpoint restoration unstable",
  "continuation nondeterministic",
]) {
  reporter.assert(source.includes(fragment), `Resumable execution source missing fragment: ${fragment}`);
}

reporter.finish("resumable DAG cursor, checkpoint restoration, and continuation governance checked");
