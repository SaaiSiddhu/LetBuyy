# Chaos Certification Governance

Chaos certification is owned by `chaos_experiment_runs` and `infrastructure/scripts/chaos/run-chaos-experiment.mjs`.

Rules:

- Chaos execution requires explicit environment, blast radius, guardrails, and recovery result metadata.
- Plan mode must enumerate safe experiments without provider mutation.
- Execute mode must record approved experiments through the operations API.
- Queue outage, provider outage, replay corruption, cache failure, regional outage, workflow recovery, DLQ flood, and telemetry outage are required categories.
- Chaos results must feed incident, failover, and SRE readiness scoring.
