/**
 * Docker Engine API response types — normalised shapes from the Docker Engine REST API.
 * All fields are read-only and schema-validated with Zod before use.
 * Values observed from source of truth (Docker Engine); none are fabricated by LCIS.
 *
 * READ-ONLY: no mutation primitives exist in this file.
 */
import { z } from 'zod';
import type { LiveFact } from '../shared/contracts';

// ---------------------------------------------------------------------------
// /version schema (probe)
// ---------------------------------------------------------------------------

export const DockerVersionSchema = z
  .object({
    Version: z.string(),
  })
  .passthrough(); // accept any extra fields from the daemon
export type DockerVersion = z.infer<typeof DockerVersionSchema>;

// ---------------------------------------------------------------------------
// /containers/json schema
// ---------------------------------------------------------------------------

export const DockerContainerSchema = z
  .object({
    Id: z.string(),
    Names: z.array(z.string()),
    Image: z.string(),
    State: z.string(),
    Status: z.string(),
  })
  .passthrough();
export type DockerContainer = z.infer<typeof DockerContainerSchema>;

export const DockerContainersResponseSchema = z.array(DockerContainerSchema);
export type DockerContainersResponse = z.infer<typeof DockerContainersResponseSchema>;

// ---------------------------------------------------------------------------
// /images/json schema
// ---------------------------------------------------------------------------

export const DockerImageSchema = z
  .object({
    Id: z.string(),
    RepoTags: z.array(z.string()).nullable().optional(),
    Size: z.number(),
  })
  .passthrough();
export type DockerImage = z.infer<typeof DockerImageSchema>;

export const DockerImagesResponseSchema = z.array(DockerImageSchema);
export type DockerImagesResponse = z.infer<typeof DockerImagesResponseSchema>;

// ---------------------------------------------------------------------------
// /info schema (loose — only fields we care about)
// ---------------------------------------------------------------------------

export const DockerInfoSchema = z
  .object({
    ContainersRunning: z.number().optional(),
    ContainersStopped: z.number().optional(),
  })
  .passthrough();
export type DockerInfo = z.infer<typeof DockerInfoSchema>;

// ---------------------------------------------------------------------------
// Normalised gathered payload
// ---------------------------------------------------------------------------

export interface DockerPayload {
  /** All containers observed from GET /containers/json?all=true */
  readonly containers: readonly DockerContainer[];
  /** All images observed from GET /images/json */
  readonly images: readonly DockerImage[];
  /** Engine-level counters from GET /info (optional fields) */
  readonly info: DockerInfo;
  /** Normalised LiveFacts for CorrelationEngine consumption. */
  readonly facts: readonly LiveFact[];
}
