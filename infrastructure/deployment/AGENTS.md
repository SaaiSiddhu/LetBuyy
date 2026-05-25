# Deployment Infrastructure Governance

Purpose: Deployment topology, environment promotion, runtime release rules, build matrices, and provider project mapping.

Boundary: `infrastructure/deployment`.

Rules:

- Deployment docs must name the owning runtime root.
- Preview and production environments must not share secrets.
- Release changes must include validation commands.
