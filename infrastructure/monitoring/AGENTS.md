# Monitoring Infrastructure Governance

Purpose: External checks, uptime probes, SLOs, alerts, incident routing, and synthetic workflow monitoring.

Boundary: `infrastructure/monitoring`.

Rules:

- Monitors must cover auth, storefront, checkout, API gateway, and webhook health before production readiness claims.
- Alert definitions must name owner and expected response path.
