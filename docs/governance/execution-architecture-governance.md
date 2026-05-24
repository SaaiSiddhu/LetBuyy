# Execution Architecture Governance

Status: Phase 2 foundation. This document defines the target execution architecture and the rules validators enforce for new TypeScript work.

## Layer Model

Execution dependencies flow through these governed boundaries:

1. Apps: routing, rendering, presentation, runtime adapters, and thin composition.
2. Runtime composition: read orchestration, projection assembly, cache policy, response shaping.
3. Application services: use cases, workflow sequencing, transaction boundaries, execution policy.
4. Domain packages: schemas, DTOs, state machines, domain contracts, pure rules.
5. Infrastructure adapters: provider SDKs, external APIs, retries, provider normalization.

Services are execution containers. They may own APIs, workers, queue consumers, schedulers, webhooks, and runtime bootstrapping, but durable business sequencing must migrate to application services.

## Required Boundaries

- `packages/application-services` owns use-case contracts and application ports.
- `packages/orchestration` owns event, command, workflow, saga, retry, and async primitives.
- `packages/runtime-composition` owns read/query projection contracts.
- `packages/infrastructure` owns provider SDK and external API adapter code.

## Forbidden Patterns

- Apps or services importing provider SDKs directly.
- App pages or service routes becoming canonical workflow owners.
- Domain packages importing apps, services, or infrastructure adapters.
- Provider API URLs outside `packages/infrastructure`.
- Query aggregation duplicated across pages when a runtime-composition contract exists.

## Migration Rule

When touching existing orchestration in an app or service, first identify the application service and infrastructure adapter boundary that should own it. Keep behavior-preserving moves small and commit by architecture concern.
