# Feature Flag Rollback Runbook

## Purpose

Disable a risky feature without redeploying code.

## Procedure

1. Set `killSwitch` to true for the affected flag.
2. Record an `operational_feature_flag_audit_events` entry with action `kill-switch`.
3. Confirm exposure telemetry shows disabled evaluations.
4. Watch error rate, latency, queue lag, and SLO burn rate.
5. If symptoms continue, execute the deployment rollback runbook.

## Certification Boundary

A feature flag rollback is operational evidence only when the audit event, exposure telemetry, and dashboard snapshot are recorded in the target environment.
