/**
 * Kubernetes API response types — normalised shapes from the Kubernetes REST API.
 * All fields are read-only and schema-validated with Zod before use.
 * Values observed from source of truth; none are fabricated by LCIS.
 *
 * READ-ONLY: no mutation primitives exist in this file.
 */
import { z } from 'zod';
import type { LiveFact } from '../shared/contracts';

// ---------------------------------------------------------------------------
// Probe schema — /version
// ---------------------------------------------------------------------------

export const KubeVersionResponseSchema = z.object({
  gitVersion: z.string(),
}).passthrough();
export type KubeVersionResponse = z.infer<typeof KubeVersionResponseSchema>;

// ---------------------------------------------------------------------------
// Namespace schema — /api/v1/namespaces
// ---------------------------------------------------------------------------

export const KubeNamespaceSchema = z.object({
  metadata: z.object({
    name: z.string(),
    uid: z.string().optional(),
    creationTimestamp: z.string().optional(),
  }).passthrough(),
}).passthrough();
export type KubeNamespace = z.infer<typeof KubeNamespaceSchema>;

export const KubeNamespaceListSchema = z.object({
  items: z.array(KubeNamespaceSchema),
}).passthrough();
export type KubeNamespaceList = z.infer<typeof KubeNamespaceListSchema>;

// ---------------------------------------------------------------------------
// Pod schema — /api/v1/pods
// ---------------------------------------------------------------------------

export const KubePodPhaseSchema = z.enum([
  'Pending',
  'Running',
  'Succeeded',
  'Failed',
  'Unknown',
]);
export type KubePodPhase = z.infer<typeof KubePodPhaseSchema>;

export const KubePodSchema = z.object({
  metadata: z.object({
    name: z.string(),
    namespace: z.string().optional(),
    uid: z.string().optional(),
    creationTimestamp: z.string().optional(),
  }).passthrough(),
  status: z.object({
    phase: KubePodPhaseSchema.optional(),
    startTime: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();
export type KubePod = z.infer<typeof KubePodSchema>;

export const KubePodListSchema = z.object({
  items: z.array(KubePodSchema),
  metadata: z.object({
    continue: z.string().optional(),
    remainingItemCount: z.number().optional(),
  }).passthrough().optional(),
}).passthrough();
export type KubePodList = z.infer<typeof KubePodListSchema>;

// ---------------------------------------------------------------------------
// Deployment schema — /apis/apps/v1/deployments
// ---------------------------------------------------------------------------

export const KubeDeploymentSchema = z.object({
  metadata: z.object({
    name: z.string(),
    namespace: z.string().optional(),
    uid: z.string().optional(),
    creationTimestamp: z.string().optional(),
  }).passthrough(),
  status: z.object({
    replicas: z.number().optional(),
    readyReplicas: z.number().optional(),
    availableReplicas: z.number().optional(),
    unavailableReplicas: z.number().optional(),
  }).passthrough().optional(),
}).passthrough();
export type KubeDeployment = z.infer<typeof KubeDeploymentSchema>;

export const KubeDeploymentListSchema = z.object({
  items: z.array(KubeDeploymentSchema),
  metadata: z.object({
    continue: z.string().optional(),
    remainingItemCount: z.number().optional(),
  }).passthrough().optional(),
}).passthrough();
export type KubeDeploymentList = z.infer<typeof KubeDeploymentListSchema>;

// ---------------------------------------------------------------------------
// Normalised gathered payload
// ---------------------------------------------------------------------------

export interface KubernetesPayload {
  /** Server version string (from /version). */
  readonly gitVersion: string;
  /** Observed namespace names (from /api/v1/namespaces). */
  readonly namespaces: readonly string[];
  /** Observed pods (page 1 only; see page-1 honesty note in adapter). */
  readonly pods: readonly KubePod[];
  /** Observed deployments (page 1 only). */
  readonly deployments: readonly KubeDeployment[];
  /** Normalised LiveFacts for CorrelationEngine consumption. */
  readonly facts: readonly LiveFact[];
}
