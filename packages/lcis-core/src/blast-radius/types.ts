/**
 * BlastRadiusService result types + zod schemas.
 * Every NodeView carries `provenance` (the graph node id); every result carries
 * `artifact` (the source artifact) — provenance is the evidence.
 */
import { z } from 'zod';

export const NodeViewSchema = z.object({
  id: z.string(),
  label: z.string(),
  file: z.string(),
  loc: z.string(),
  degree: z.number().int().nonnegative(),
  community: z.number().int(),
  provenance: z.string(),
});
export type NodeView = z.infer<typeof NodeViewSchema>;

export const NodeViewRelSchema = NodeViewSchema.extend({ rel: z.string() });
export type NodeViewRel = z.infer<typeof NodeViewRelSchema>;

export const BlastResultSchema = z.object({
  node: NodeViewSchema,
  impactedNodes: z.number().int().nonnegative(),
  impactedFiles: z.number().int().nonnegative(),
  layers: z.array(z.number().int().nonnegative()),
  topImpacted: z.array(NodeViewSchema).max(12),
  artifact: z.literal('graphify-out/graph.json'),
});
export type BlastResult = z.infer<typeof BlastResultSchema>;

export const DependencyResultSchema = z.object({
  node: NodeViewSchema,
  dependsOn: z.array(NodeViewRelSchema),
  artifact: z.literal('graphify-out/graph.json'),
});
export type DependencyResult = z.infer<typeof DependencyResultSchema>;

export const ConsumerResultSchema = z.object({
  node: NodeViewSchema,
  consumedBy: z.array(NodeViewRelSchema),
  artifact: z.literal('graphify-out/graph.json'),
});
export type ConsumerResult = z.infer<typeof ConsumerResultSchema>;

export const PathResultSchema = z.object({
  from: NodeViewSchema,
  to: NodeViewSchema,
  path: z.array(NodeViewSchema),
  hops: z.number().int(),
  artifact: z.literal('graphify-out/graph.json'),
});
export type PathResult = z.infer<typeof PathResultSchema>;

export const CrossDomainResultSchema = z.object({
  domain: z.string(),
  label: z.string(),
  directConsumers: z.array(z.object({ domain: z.string(), strength: z.number() })),
  blastRadius: z.object({
    domains: z.number().int(),
    layers: z.array(z.number().int()),
    affected: z.array(z.string()),
  }),
  owners: z.array(z.string()),
  services: z.object({ apps: z.array(z.string()), workers: z.array(z.string()) }),
  routes: z.array(z.string()),
  rpcs: z.array(z.string()),
  tables: z.array(z.string()),
  artifact: z.literal('graphify-out/domain-intel.json'),
});
export type CrossDomainResult = z.infer<typeof CrossDomainResultSchema>;

export const ImpactResultSchema = z.object({
  domain: z.string(),
  label: z.string(),
  breaks: z.object({
    domains: z.object({
      count: z.number().int(),
      list: z.array(z.string()),
      layers: z.array(z.number().int()),
    }),
    routes: z.array(z.string()),
    rpcs: z.array(z.string()),
    tables: z.array(z.string()),
    workers: z.array(z.string()),
    queues: z.array(z.string()),
    deployments: z.object({
      workers: z.array(z.string()),
      apps: z.array(z.string()),
      gate: z.string(),
    }),
    merchants: z.string(),
    owners: z.array(z.string()),
  }),
  risk: z.object({ money: z.boolean(), tenant: z.boolean(), note: z.string() }),
  artifacts: z.array(z.string()),
});
export type ImpactResult = z.infer<typeof ImpactResultSchema>;

export const CriticalResultSchema = z.object({
  nodes: z.array(NodeViewSchema),
  artifact: z.literal('graphify-out/graph.json'),
});
export type CriticalResult = z.infer<typeof CriticalResultSchema>;

export const RelationshipResultSchema = z.object({
  table: z.string(),
  references: z.array(z.string()),
  referencedBy: z.array(z.string()),
  fanIn: z.number().int().nonnegative(),
  fanOut: z.number().int().nonnegative(),
  artifact: z.literal('graphify-out/relationship-intel.json'),
});
export type RelationshipResult = z.infer<typeof RelationshipResultSchema>;

export interface DomainError {
  readonly error: string;
}
