# Chaos Governance

Chaos engineering is allowed only when blast radius, guardrails, rollback, telemetry, and incident ownership are defined before execution.

## Required Experiment Classes

- Queue outage.
- Replay corruption.
- Provider outage.
- Regional outage.
- Cache failure.
- Telemetry outage.
- Workflow recovery.
- DLQ flood.
- Latency and throttling simulation.

## Evidence

Plan mode validates experiment definitions. Execute mode must record `chaos_experiment_runs`, recovery timing, guardrail status, and operational dashboard evidence before the drill can count toward certification.
