import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Runtime transition validator");

const intelligence = readJson("config/runtime/runtime-survivability-intelligence.json");
const transitions = intelligence?.runtimeTransitions || {};
const orchestration = readJson("config/runtime/runtime-orchestration-manifest.json");

reporter.assert(intelligence?.mode === "governance-contract-not-live-evidence", "Runtime transition intelligence must not claim live evidence");
reporter.assert(transitions.engineSource === "packages/distributed-runtime/src/runtime-transition-lineage-runtime.ts", "Runtime transition engine must live in distributed-runtime");
reporter.assert(transitions.stateMachineSource === "packages/distributed-runtime/src/runtime-state-machine-runtime.ts", "Runtime transition engine must use state machine source");
reporter.assert(transitions.journalFunction === "appendRuntimeTransitionJournal", "Runtime transition manifest must name journaling function");
reporter.assert(transitions.recoveryFunction === "recoverRuntimeTransition", "Runtime transition manifest must name recovery function");
reporter.assert(transitions.auditChain === "previousChecksum-to-checkpointChecksum", "Runtime transition audit chain must link checksums");
reporter.assert(transitions.causalityRequired === true, "Runtime transition causality must be required");

const source = readFile(transitions.engineSource || "");
for (const fragment of [
  "appendRuntimeTransitionJournal",
  "recoverRuntimeTransition",
  "assertRuntimeTransitionJournal",
  "causation lineage",
  "previousChecksum",
  "checkpointChecksum",
  "orphan-state",
]) {
  reporter.assert(source.includes(fragment), `Runtime transition engine missing fragment: ${fragment}`);
}

for (const machine of orchestration?.stateMachines || []) {
  reporter.assert(machine.initialState, `State machine missing initial state: ${machine.kind}`);
  reporter.assert((machine.terminalStates || []).length > 0, `State machine missing terminal states: ${machine.kind}`);
  for (const transition of machine.transitions || []) {
    reporter.assert((transition.requires || []).length > 0, `Transition missing gate lineage: ${machine.kind}/${transition.command}`);
  }
}

reporter.finish(`${orchestration?.stateMachines?.length || 0} state machines checked for transition lineage`);
