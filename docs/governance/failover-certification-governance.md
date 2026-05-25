# Failover Certification Governance

Failover certification is owned by `failover_drill_runs`, regional routing overrides, and the operations control-plane.

Rules:

- Regional, provider, queue, cache, telemetry, and database drills must record status, affected runtimes, RTO, RPO, and result metadata.
- Active/passive failover controls must use governed control commands.
- Plan mode may validate drill contracts; execute mode must record live drill evidence.
- Failover evidence must distinguish real provider routing changes from control-plane-only validation.
- Recovery timing must be captured before declaring failover certification complete.
