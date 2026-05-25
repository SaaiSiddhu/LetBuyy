import { replayPayloadChecksum } from './event-envelope-runtime';
import type { DurableExecutionWal, ExecutionWalEntry } from './durable-execution-runtime';

export interface WalLifecycleSegment {
  segmentId: string;
  startSequence: number;
  endSequence: number;
  entryChecksums: string[];
  previousSegmentChecksum: string | null;
  segmentChecksum: string;
}

export interface WalReplayCursor {
  executionId: string;
  orchestrationId: string;
  segmentId: string;
  nextSequence: number;
  cursorChecksum: string;
}

export interface WalLifecyclePlan {
  executionId: string;
  orchestrationId: string;
  segments: WalLifecycleSegment[];
  replayCursor: WalReplayCursor;
  ancestryChecksum: string;
  compactionChecksum: string;
  archivalChecksum: string;
}

export function segmentExecutionWal(wal: DurableExecutionWal, segmentSize: number): WalLifecycleSegment[] {
  if (segmentSize < 1) {
    throw new Error('WAL segment rotation requires positive segment size');
  }
  const segments: WalLifecycleSegment[] = [];
  let previousSegmentChecksum: string | null = null;
  for (let index = 0; index < wal.entries.length; index += segmentSize) {
    const entries = wal.entries.slice(index, index + segmentSize);
    const startSequence = entries[0]?.executionSequence;
    const endSequence = entries.at(-1)?.executionSequence;
    if (!startSequence || !endSequence) {
      throw new Error('WAL corruption undetectable: empty segment');
    }
    const entryChecksums = entries.map((entry) => entry.executionChecksum);
    const segmentChecksum = replayPayloadChecksum({
      executionId: wal.executionId,
      orchestrationId: wal.orchestrationId,
      startSequence,
      endSequence,
      entryChecksums,
      previousSegmentChecksum,
    });
    segments.push({
      segmentId: `${wal.executionId}:segment:${segments.length + 1}`,
      startSequence,
      endSequence,
      entryChecksums,
      previousSegmentChecksum,
      segmentChecksum,
    });
    previousSegmentChecksum = segmentChecksum;
  }
  return segments;
}

export function compileWalLifecyclePlan(input: {
  wal: DurableExecutionWal;
  segmentSize: number;
  snapshotSequence: number;
  archivalTier: 'hot' | 'cold';
}): WalLifecyclePlan {
  const segments = segmentExecutionWal(input.wal, input.segmentSize);
  const cursorSegment = segments.find((segment) => input.snapshotSequence >= segment.startSequence && input.snapshotSequence <= segment.endSequence)
    || segments.at(-1);
  if (!cursorSegment) {
    throw new Error('replay cursor restoration impossible');
  }
  const replayCursor = {
    executionId: input.wal.executionId,
    orchestrationId: input.wal.orchestrationId,
    segmentId: cursorSegment.segmentId,
    nextSequence: input.snapshotSequence + 1,
    cursorChecksum: replayPayloadChecksum({
      executionId: input.wal.executionId,
      orchestrationId: input.wal.orchestrationId,
      segmentId: cursorSegment.segmentId,
      nextSequence: input.snapshotSequence + 1,
    }),
  };
  const ancestryChecksum = replayPayloadChecksum(segments.map((segment) => segment.segmentChecksum));
  return {
    executionId: input.wal.executionId,
    orchestrationId: input.wal.orchestrationId,
    segments,
    replayCursor,
    ancestryChecksum,
    compactionChecksum: replayPayloadChecksum({
      executionId: input.wal.executionId,
      retainedFromSequence: replayCursor.nextSequence,
      snapshotSequence: input.snapshotSequence,
      replaySafeWalCompaction: true,
    }),
    archivalChecksum: replayPayloadChecksum({
      executionId: input.wal.executionId,
      archivalTier: input.archivalTier,
      ancestryChecksum,
    }),
  };
}

export function restoreWalEntriesFromCursor(wal: DurableExecutionWal, cursor: WalReplayCursor): ExecutionWalEntry[] {
  return wal.entries
    .filter((entry) => entry.executionSequence >= cursor.nextSequence)
    .sort((left, right) => left.executionSequence - right.executionSequence);
}

export function assertWalLifecycleDeterministic(plan: WalLifecyclePlan): void {
  if (plan.segments.length === 0) {
    throw new Error('WAL lineage incomplete');
  }
  let previousSegmentChecksum: string | null = null;
  let previousEndSequence = 0;
  for (const segment of plan.segments) {
    if (segment.previousSegmentChecksum !== previousSegmentChecksum) {
      throw new Error(`WAL corruption undetectable for segment ${segment.segmentId}`);
    }
    if (segment.startSequence !== previousEndSequence + 1 || segment.endSequence < segment.startSequence) {
      throw new Error(`WAL replay nondeterministic for segment ${segment.segmentId}`);
    }
    previousSegmentChecksum = segment.segmentChecksum;
    previousEndSequence = segment.endSequence;
  }
  if (!plan.replayCursor.cursorChecksum) {
    throw new Error('replay cursor restoration impossible');
  }
  if (!plan.archivalChecksum || !plan.compactionChecksum) {
    throw new Error('WAL archival unsafe');
  }
}
