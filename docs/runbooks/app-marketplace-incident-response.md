# App Marketplace Incident Response Runbook

> Frozen seam runbook. The public app marketplace is not an active production surface; use this only for first-party/private sandbox incident evidence until an ARB-approved marketplace reopen trigger exists.

Owner: App Marketplace on-call with API gateway, queue worker, and finance escalation paths.

1. Classify the incident: catalog/discovery outage, install/OAuth failure, billing or payout issue, webhook delivery backlog, media upload failure, review abuse, or data-handling concern.
2. Capture request IDs, affected `site_id`, `app_id`, installation IDs, charge IDs, webhook delivery IDs, and queue job IDs before mutation.
3. For install or OAuth incidents, check app OAuth rate limits, token exchange errors, installation state, revoked scopes, and bridge fetch status.
4. For billing incidents, stop live settlement, inspect charge provider proof, spend controls, usage events, and payout ledger state before retrying.
5. For webhook incidents, inspect `webhook_deliveries`, retry counts, dead-letter status, and the queue worker runbook before redrive.
6. For catalog or media incidents, disable only the affected placement, app, collection, or media URL; avoid broad catalog takedowns unless merchant safety requires it.
7. Communicate merchant-facing impact in plain product terms. Do not expose internal flags, approval states, queue names, or human-approval labels to end users.
8. Close the incident only after the relevant workspace tests, app-marketplace build, and governance validator have been run or a precise external blocker has been logged.
