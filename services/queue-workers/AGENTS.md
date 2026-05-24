# Queue Workers Governance

Purpose: Reserved background job runtime for outbox dispatch, retries, event fanout, reconciliation, and asynchronous commerce workflows.

Runtime boundary: `services/queue-workers`.

Status: Incubating. New queue consumers require explicit retry, dead-letter, tenant, and observability policies before activation.
