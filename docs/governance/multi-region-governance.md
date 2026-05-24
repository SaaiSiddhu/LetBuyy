# Multi-Region Governance

Status: Phase 3 global execution preparation.

## Authority

- Region descriptors, tenant region affinity, global execution routing, replication contracts, and failover metadata live in `packages/distributed-runtime/src/global-execution-runtime.ts`.
- Cloudflare and deployment config own physical placement. Runtime code consumes region metadata but must not hardcode infrastructure topology.

## Rules

- Tenant-owned writes route to the tenant primary region when healthy.
- Reads may route to healthy replicas only when the query consistency contract allows it.
- Replay and projection rebuilds must declare source region, target regions, max lag, and whether failover requires replay.
- Regional failover must be explicit and auditable.
