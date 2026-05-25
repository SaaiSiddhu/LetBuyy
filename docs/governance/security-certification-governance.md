# Security Certification Governance

Security certification is owned by `infrastructure/security/production-security-controls.yaml`, security gates, secret rotation, and operations evidence.

Rules:

- Execute mode requires secret-rotation payloads for every governed Worker secret.
- Webhook signature enforcement, CSRF enforcement, auth rate limiting, RBAC, audit events, SBOM generation, and dependency scanning are certification gates.
- Security evidence must be recorded in `security_enforcement_events`.
- Secret values must never appear in repository docs, logs, or validator output.
- Validators must hard fail missing security certification topology.
