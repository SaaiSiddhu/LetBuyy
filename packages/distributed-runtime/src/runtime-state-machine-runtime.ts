export type RuntimeLifecycleKind = 'runtime' | 'deployment' | 'rollback' | 'replay' | 'projection' | 'queue';

export interface RuntimeStateTransition {
  kind: RuntimeLifecycleKind;
  from: string;
  to: string;
  command: string;
  requires: string[];
  terminal?: boolean;
}

export interface RuntimeStateMachine {
  kind: RuntimeLifecycleKind;
  initialState: string;
  terminalStates: string[];
  transitions: RuntimeStateTransition[];
}

export interface RuntimeStateTransitionResult {
  allowed: boolean;
  nextState: string;
  requiredGates: string[];
  reason: string;
}

export function assertRuntimeStateMachine(machine: RuntimeStateMachine): void {
  if (!machine.initialState) {
    throw new Error(`Runtime state machine ${machine.kind} requires an initial state`);
  }

  if (machine.terminalStates.length === 0) {
    throw new Error(`Runtime state machine ${machine.kind} requires terminal states`);
  }

  const states = new Set<string>([machine.initialState, ...machine.terminalStates]);
  for (const transition of machine.transitions) {
    if (transition.kind !== machine.kind) {
      throw new Error(`Runtime state machine ${machine.kind} contains transition for ${transition.kind}`);
    }
    if (!transition.from || !transition.to || !transition.command) {
      throw new Error(`Runtime state machine ${machine.kind} has an incomplete transition`);
    }
    states.add(transition.from);
    states.add(transition.to);
  }

  for (const terminalState of machine.terminalStates) {
    const outbound = machine.transitions.filter((transition) => transition.from === terminalState);
    if (outbound.length > 0) {
      throw new Error(`Runtime state machine ${machine.kind} terminal state has outbound transitions: ${terminalState}`);
    }
  }
}

export function transitionRuntimeState(
  machine: RuntimeStateMachine,
  currentState: string,
  command: string,
): RuntimeStateTransitionResult {
  assertRuntimeStateMachine(machine);
  const transition = machine.transitions.find((candidate) => candidate.from === currentState && candidate.command === command);

  if (!transition) {
    return {
      allowed: false,
      nextState: currentState,
      requiredGates: [],
      reason: `No ${machine.kind} transition from ${currentState} with command ${command}`,
    };
  }

  return {
    allowed: true,
    nextState: transition.to,
    requiredGates: [...transition.requires].sort(),
    reason: `${machine.kind} transition ${currentState} -> ${transition.to}`,
  };
}

export function reachableRuntimeStates(machine: RuntimeStateMachine): string[] {
  assertRuntimeStateMachine(machine);
  const reachable = new Set<string>([machine.initialState]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const transition of machine.transitions) {
      if (reachable.has(transition.from) && !reachable.has(transition.to)) {
        reachable.add(transition.to);
        changed = true;
      }
    }
  }

  return [...reachable].sort();
}
