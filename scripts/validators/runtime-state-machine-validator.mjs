import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Runtime state machine validator");

const manifest = readJson("config/runtime/runtime-orchestration-manifest.json");
const machines = manifest?.stateMachines || [];

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Runtime state machines must not claim live evidence");

const source = readFile("packages/distributed-runtime/src/runtime-state-machine-runtime.ts");
for (const fragment of [
  "assertRuntimeStateMachine",
  "transitionRuntimeState",
  "reachableRuntimeStates",
  "terminal state has outbound transitions",
  "No ${machine.kind} transition",
]) {
  reporter.assert(source.includes(fragment), `Runtime state machine engine missing fragment: ${fragment}`);
}

const requiredKinds = ["runtime", "deployment", "rollback", "replay", "projection", "queue"];
const machineByKind = new Map(machines.map((machine) => [machine.kind, machine]));
for (const kind of requiredKinds) {
  const machine = machineByKind.get(kind);
  reporter.assert(Boolean(machine), `Missing runtime state machine: ${kind}`);
  reporter.assert(Boolean(machine?.initialState), `Runtime state machine missing initial state: ${kind}`);
  reporter.assert((machine?.terminalStates || []).length > 0, `Runtime state machine missing terminal states: ${kind}`);
  reporter.assert((machine?.transitions || []).length >= 3, `Runtime state machine needs explicit transitions: ${kind}`);

  const states = new Set([machine?.initialState, ...(machine?.terminalStates || [])].filter(Boolean));
  for (const transition of machine?.transitions || []) {
    reporter.assert(Boolean(transition.from && transition.to && transition.command), `Runtime state transition incomplete: ${kind}`);
    reporter.assert((transition.requires || []).length > 0, `Runtime state transition missing gates: ${kind}/${transition.command}`);
    states.add(transition.from);
    states.add(transition.to);
  }

  for (const terminalState of machine?.terminalStates || []) {
    const outbound = (machine?.transitions || []).filter((transition) => transition.from === terminalState);
    reporter.assert(outbound.length === 0, `Runtime state terminal state must not have outbound transitions: ${kind}/${terminalState}`);
  }

  const reachable = new Set([machine?.initialState]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const transition of machine?.transitions || []) {
      if (reachable.has(transition.from) && !reachable.has(transition.to)) {
        reachable.add(transition.to);
        changed = true;
      }
    }
  }
  for (const state of states) {
    reporter.assert(reachable.has(state), `Runtime state is unreachable: ${kind}/${state}`);
  }
}

reporter.finish(`${machines.length} runtime state machines checked`);
