# Tenant Scalability Governance

Status: Phase 3 multi-tenant scalability foundation.

## Authority

- Tenant quotas, workload isolation, rate governance, noisy-neighbor protection, queue partitioning metadata, tenant runtime metrics, and scaling decisions live in `packages/distributed-runtime/src/tenant-scalability-runtime.ts`.
- Service runtimes enforce tenant workload decisions at API, queue, replay, and workflow boundaries.

## Rules

- Merchant-owned execution requires `site_id` or explicit ownership checks.
- Tenant queue partition keys must include tenant scope for merchant-owned work.
- Quotas must govern concurrent executions, queue depth, requests per minute, and burst behavior.
- Noisy-neighbor controls may isolate, throttle, or shed low-priority work.

## Persistence

`tenant_execution_quotas` stores tenant execution quota metadata. Runtime metrics are exposed through operations metrics and dashboard contracts.
