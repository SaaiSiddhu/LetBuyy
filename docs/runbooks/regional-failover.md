# Regional Failover Runbook

Owner: platform SRE and infrastructure lead.

1. Confirm primary-region degradation from runtime health, database snapshot, queue lag, and provider health telemetry.
2. Record a failover drill or active failover with `POST /v1/operations/runtime/failover-drills`.
3. Submit a regional control command with `POST /v1/operations/runtime/control-commands` using `failover-region`.
4. Record tenant or runtime-specific override with `POST /v1/operations/runtime/regional-routing-overrides`.
5. Verify queue consumers, API worker, webhook worker, cache, and telemetry are healthy in the target region.
6. Restore with `restore-region` only after primary telemetry has been stable for two observation windows.
