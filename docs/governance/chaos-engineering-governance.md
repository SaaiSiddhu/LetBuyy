# Chaos Engineering Governance

Chaos experiments validate recovery mechanisms without expanding blast radius beyond the approved scope.

## Allowed Experiment Classes

- `queue-outage`
- `provider-outage`
- `replay-corruption`
- `cache-failure`
- `regional-outage`
- `workflow-recovery`
- `dlq-flood`
- `telemetry-outage`

## Guardrails

- Production experiments require explicit approval and a rollback command.
- Single-tenant and staging tests are preferred.
- Experiments must write `chaos_experiment_runs` before execution and after completion.
- Failed guardrails abort the experiment and open or link an incident.
