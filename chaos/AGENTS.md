# Chaos Engineering Ownership

## Purpose

`chaos/` is the operator-facing chaos validation surface for LetBuyy. It defines approved failure modes, blast-radius rules, and evidence expectations. It does not certify production by itself.

## Rules

- Execute mode requires explicit chaos approval and operations control-plane credentials.
- Production chaos also requires survivability execution approval.
- All chaos requests must keep bounded blast radius and must record recovery evidence through the operations control plane.
- Generated reports belong under `chaos/reports/` and must remain ignored.

## Forbidden

- Fake failover, rollback, recovery, or MTTR evidence.
- Marking requested chaos as passed.
- Running global production chaos without incident commander approval.
- Treating local simulation as production survivability certification.
