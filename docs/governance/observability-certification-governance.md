# Observability Certification Governance

Observability certification is owned by OpenTelemetry, Prometheus, Loki, Tempo, Grafana, and runtime telemetry projections.

Rules:

- Plan mode validates collector, dashboard, alert configuration, and runtime producer wiring.
- Execute mode must verify Prometheus readiness, Prometheus rules, OpenTelemetry collector health, and Grafana health.
- Dashboard certification must validate live Workers Analytics Engine or operations API data, not mock data.
- Queue, workflow, deployment, incident, security, and runtime-health telemetry must remain represented in dashboards or alerts.
- Telemetry endpoint failures block live certification.
