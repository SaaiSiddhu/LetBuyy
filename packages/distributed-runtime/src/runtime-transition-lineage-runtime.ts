import { replayPayloadChecksum, type RuntimeCorrelationContext } from './event-envelope-runtime';
import type { RuntimeStateMachine } from './runtime-state-machine-runtime';
import { transitionRuntimeState } from './runtime-state-machine-runtime';

export interface RuntimeTransitionJournalEntry {
  journalId: string;
  kind: RuntimeStateMachine['kind'];
  from: string;
  to: string;
  command: string;
  requiredGates: string[];
  causationId: string;
  correlation: RuntimeCorrelationContext;
  previousChecksum: string | null;
  checkpointChecksum: string;
}

export interface RuntimeTransitionRecovery {
  status: 'valid' | 'invalid-transition' | 'orphan-state';
  currentState: string;
  recoveryCommand?: string;
  reason: string;
}

export function appendRuntimeTransitionJournal(
  machine: RuntimeStateMachine,
  existing: RuntimeTransitionJournalEntry[],
  input: {
    journalId: string;
    currentState: string;
    command: string;
    causationId: string;
    correlation: RuntimeCorrelationContext;
  },
): RuntimeTransitionJournalEntry {
  if (!input.causationId) {
    throw new Error(`Runtime transition ${input.command} requires causation lineage`);
  }
  const result = transitionRuntimeState(machine, input.currentState, input.command);
  if (!result.allowed) {
    throw new Error(result.reason);
  }
  const previous = existing[existing.length - 1] || null;
  const unsigned = {
    journalId: input.journalId,
    kind: machine.kind,
    from: input.currentState,
    to: result.nextState,
    command: input.command,
    requiredGates: result.requiredGates,
    causationId: input.causationId,
    correlation: input.correlation,
    previousChecksum: previous?.checkpointChecksum || null,
  };

  return {
    ...unsigned,
    checkpointChecksum: replayPayloadChecksum(unsigned),
  };
}

export function recoverRuntimeTransition(machine: RuntimeStateMachine, currentState: string): RuntimeTransitionRecovery {
  const knownStates = new Set<string>([machine.initialState, ...machine.terminalStates]);
  for (const transition of machine.transitions) {
    knownStates.add(transition.from);
    knownStates.add(transition.to);
  }
  if (!knownStates.has(currentState)) {
    return {
      status: 'orphan-state',
      currentState,
      recoveryCommand: 'block',
      reason: `Runtime lifecycle state is not declared: ${currentState}`,
    };
  }
  if (machine.terminalStates.includes(currentState)) {
    return {
      status: 'valid',
      currentState,
      reason: 'Runtime lifecycle is terminal and recoverable from journal',
    };
  }
  const recovery = machine.transitions.find((transition) => transition.from === currentState && transition.to.includes('blocked'));
  return recovery
    ? { status: 'invalid-transition', currentState, recoveryCommand: recovery.command, reason: 'Runtime lifecycle can fail closed through declared transition' }
    : { status: 'valid', currentState, reason: 'Runtime lifecycle state has declared outbound transitions' };
}

export function assertRuntimeTransitionJournal(journal: RuntimeTransitionJournalEntry[]): void {
  let previousChecksum: string | null = null;
  for (const entry of journal) {
    if (entry.previousChecksum !== previousChecksum) {
      throw new Error(`Runtime transition journal checksum chain broken at ${entry.journalId}`);
    }
    if (!entry.causationId || entry.requiredGates.length === 0) {
      throw new Error(`Runtime transition journal lacks causality or gates: ${entry.journalId}`);
    }
    previousChecksum = entry.checkpointChecksum;
  }
}
