/**
 * Cloudflare Queues (deep) — Zod schemas and payload types for QueuesAdapter.
 *
 * READ-ONLY: no mutation primitives exist in this file.
 *
 * These schemas validate responses from the Cloudflare Queues REST API
 * (api.cloudflare.com/client/v4). The adapter reads the queue inventory
 * (list + per-queue consumers) and emits normalised LiveFacts.
 *
 * Backlog depth / message count is NOT CONNECTED here: Cloudflare exposes
 * real-time message backlog only via the Analytics Engine API, which requires
 * a GraphQL POST request and separate credentials. We state that honestly
 * in evidence and never fabricate values.
 */
import { z } from 'zod';
import type { LiveFact } from '../shared/contracts';

// ---------------------------------------------------------------------------
// Cloudflare envelope (shared pattern)
// ---------------------------------------------------------------------------

export const CfErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
});

/**
 * Generic Cloudflare API envelope: { success, errors, result }.
 * We tolerate additional top-level fields (passthrough) to stay resilient to
 * API surface changes.
 */
export function cfQueuesEnvelope<T extends z.ZodTypeAny>(resultSchema: T) {
  return z
    .object({
      success: z.boolean(),
      errors: z.array(CfErrorSchema).optional().default([]),
      result: resultSchema.nullable().optional(),
    })
    .passthrough();
}

// ---------------------------------------------------------------------------
// Queue list: GET /accounts/{acct}/queues
// ---------------------------------------------------------------------------

/**
 * A single Cloudflare Queue as returned by the list endpoint.
 * producers/consumers counts are optional — the API may omit them.
 * We use a loose schema (passthrough + optional) to tolerate API drift.
 */
export const QueueItemSchema = z
  .object({
    queue_id: z.string(),
    queue_name: z.string(),
    created_on: z.string().optional(),
    producers_total: z.number().optional(),
    consumers_total: z.number().optional(),
  })
  .passthrough();
export type QueueItem = z.infer<typeof QueueItemSchema>;

export const QueuesListSchema = cfQueuesEnvelope(z.array(QueueItemSchema));
export type QueuesListEnvelope = z.infer<typeof QueuesListSchema>;

// ---------------------------------------------------------------------------
// Consumer: GET /accounts/{acct}/queues/{queue_id}/consumers
// ---------------------------------------------------------------------------

/**
 * A consumer binding registered on a queue.
 * script_name and type are optional — both may be absent on a dead-letter
 * or partially-configured consumer.
 */
export const QueueConsumerSchema = z
  .object({
    script_name: z.string().optional(),
    type: z.string().optional(),
    consumer_id: z.string().optional(),
    queue_name: z.string().optional(),
    created_on: z.string().optional(),
    settings: z
      .object({
        batch_size: z.number().optional(),
        max_retries: z.number().optional(),
        max_wait_time_ms: z.number().optional(),
      })
      .optional(),
  })
  .passthrough();
export type QueueConsumer = z.infer<typeof QueueConsumerSchema>;

export const ConsumersListSchema = cfQueuesEnvelope(z.array(QueueConsumerSchema));
export type ConsumersListEnvelope = z.infer<typeof ConsumersListSchema>;

// ---------------------------------------------------------------------------
// Probe schema: GET /accounts/{acct}/queues (same as list — reused)
// ---------------------------------------------------------------------------

/** For the probe we just check that `success` is present and true. */
export const QueuesProbeSchema = z
  .object({
    success: z.boolean(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Deep-queue shape assembled by the adapter after consumer fetch
// ---------------------------------------------------------------------------

export interface DeepQueue {
  /** Cloudflare queue_id (stable identifier). */
  readonly queue_id: string;
  readonly queue_name: string;
  readonly created_on: string | undefined;
  readonly producers_total: number | undefined;
  readonly consumers_total: number | undefined;
  /** Consumers resolved from the per-queue consumers endpoint. */
  readonly consumers: readonly QueueConsumer[];
  /**
   * True when the consumers endpoint was successfully fetched and parsed.
   * False means the list is empty due to a fetch/parse failure (NOT CONNECTED
   * for this queue's consumers — stated in evidence).
   */
  readonly consumersResolved: boolean;
}

// ---------------------------------------------------------------------------
// Normalised gathered payload
// ---------------------------------------------------------------------------

export interface QueuesPayload {
  /** All queues observed via the list endpoint (page 1 only). */
  readonly queues: readonly DeepQueue[];
  /** Normalised LiveFacts for CorrelationEngine consumption. */
  readonly facts: readonly LiveFact[];
}
