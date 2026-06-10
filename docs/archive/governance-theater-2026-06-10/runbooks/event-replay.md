# Event Replay Runbook

Owner: `services/event-bus` with platform SRE approval.

1. Run `POST /v1/operations/runtime/event-store/integrity` for the target stream.
2. Schedule a dry-run replay with `POST /v1/operations/runtime/replays`.
3. Review replay impact, checkpoint plan, event count, and rollback plan.
4. Authorize non-dry-run replay with `POST /v1/operations/runtime/replays/:replayId/authorize`.
5. Monitor replay lag, projection snapshots, checkpoint advancement, and failed event counts.
6. Archive old replayable events only with `POST /v1/operations/runtime/event-store/archive` after retention policy approval.
