import { replayPayloadChecksum } from './event-envelope-runtime';

export interface ConvergenceInvariant {
  invariantId: string;
  expression: string;
  sourceOfTruth: string;
  derivedState: string;
}

export interface ConvergenceEquilibriumInput {
  invariants: ConvergenceInvariant[];
  observedChecksums: string[];
  expectedChecksum: string;
}

export interface ConvergenceEquilibrium {
  stabilized: boolean;
  fixedPointChecksum: string;
  equilibriumChecksum: string;
}

export function compileConvergenceEquilibrium(input: ConvergenceEquilibriumInput): ConvergenceEquilibrium {
  const invariants = [...input.invariants].sort((left, right) => left.invariantId.localeCompare(right.invariantId));
  const observedChecksums = [...input.observedChecksums].sort();
  const fixedPointChecksum = replayPayloadChecksum({ invariants, observedChecksums });
  return {
    stabilized: fixedPointChecksum === input.expectedChecksum,
    fixedPointChecksum,
    equilibriumChecksum: replayPayloadChecksum({
      fixedPointChecksum,
      expectedChecksum: input.expectedChecksum,
      stabilized: fixedPointChecksum === input.expectedChecksum,
    }),
  };
}

export function assertConvergenceEquilibrium(equilibrium: ConvergenceEquilibrium): void {
  if (!equilibrium.stabilized) {
    throw new Error('Convergence instability exists: deterministic equilibrium validation failed');
  }
  if (!equilibrium.fixedPointChecksum || !equilibrium.equilibriumChecksum) {
    throw new Error('Convergence checksum validation failed');
  }
}
