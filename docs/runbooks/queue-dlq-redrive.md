# Queue DLQ Redrive Runbook

Owner: `services/queue-workers`.

1. Inspect the queue with `GET /v1/operations/runtime/queues/:queueName`.
2. Confirm provider outage, schema drift, or poison message cause before redrive.
3. Recover expired leases with `POST /v1/operations/runtime/queues/:queueName/recover-leases`.
4. Redrive selected messages with `POST /v1/operations/runtime/queues/:queueName/redrive-dead-letters`.
5. Watch `cloudflare.queue.delivery.lag`, dead-letter growth, and `queue_operation_snapshots`.
6. Escalate to SEV1 if dead-letter growth continues after one retry-delay window.
