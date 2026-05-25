# Workflow Recovery Governance

LetBuyy workflow recovery is an execution concern owned by `packages/application-services` and `packages/orchestration`.

## Authority

- Application services define workflow state, checkpoints, compensation, and recovery decisions for business workflows.
- `packages/orchestration` owns provider-neutral checkpoint, retry, dead-letter, and recovery runtime contracts.
- `packages/orchestration/src/workflow-continuation-runtime.ts` owns workflow heartbeats, crash-safe continuation plans, timeout recovery decisions, and replay-safe compensation planning.
- Apps do not own workflow recovery. They may only surface retry or failure UI from service responses.
- Services do not own recovery policy. They may only persist checkpoints, schedule retries, and execute recovery adapters declared by application-service workflows.

## Checkpoints

- Durable workflows require an execution id, workflow name, workflow version, current step, attempt count, correlation context, and state snapshot.
- Checkpoints must be tenant scoped when the workflow mutates tenant data.
- Checkpoints must be replay-safe and must not include provider secrets or unredacted payment payloads.

## Recovery Lifecycle

- Recovery starts from the latest checkpoint and resolves to one terminal plan: resume, retry current step, compensate, dead-letter, or ignore.
- Continuation starts from the lifecycle record and heartbeat state. Expired heartbeats must plan resume, retry, compensation, or dead-letter before a service worker continues execution.
- Compensation is allowed only when the application-service workflow declares a compensating step.
- Retry exhaustion must move to dead-letter or compensation. Silent retry loops are forbidden.
- Recovery decisions must propagate request id, correlation id, causation id, actor id, and site id where available.

## Enforcement

- Runtime manifests must declare `workflowRecoveryOwnership` and `recoveryOwnership`.
- Validators hard fail if apps or services define workflow authority outside application-services or orchestration packages.
- New service recovery code must be runtime glue only: claim checkpoint, invoke package contract, persist result.
