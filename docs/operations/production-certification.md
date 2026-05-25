# Production Certification

LetBuyy production certification is credential-gated. The repository must always support plan mode, and it may only claim live-certified status after execute mode successfully records evidence through the operations control-plane.

## Modes

- Plan mode: validates topology, manifests, Cloudflare bindings, Supabase verification SQL, observability config, security gates, load/chaos/drill contracts, Worker dry-run deployment, and dashboard API contracts without mutating providers.
- Execute mode: requires Cloudflare, Supabase, observability, Vercel, operations API, k6, Terraform, psql, and secret-rotation inputs. It deploys, verifies, rotates secrets, runs live drills, and records evidence.
- Auto mode: runs execute mode only when every required credential group and local tool is present; otherwise it runs plan mode.

## Command

```bash
node infrastructure/scripts/operations/phase4-live-certify.mjs --environment=production --mode=auto
```

Forced live execution:

```bash
node infrastructure/scripts/operations/phase4-live-certify.mjs --environment=production --mode=execute
```

## Evidence Authority

Live evidence is operational data, not markdown. Evidence is recorded through `/v1/operations/runtime` into Supabase-backed operational projection tables:

- `production_readiness_gate_runs`
- `deployment_health_gate_results`
- `production_incidents`
- `production_incident_events`
- `failover_drill_runs`
- `chaos_experiment_runs`
- `load_test_runs`
- `operational_dashboard_snapshots`
- `sre_error_budget_snapshots`
- `security_enforcement_events`
- `event_store_integrity_checks`
- `regional_routing_overrides`
- `runtime_control_commands`

## Certification State

Current repository state is `credential-gated-plan-ready`. This means the executable workflows and evidence contracts exist, but this checkout has not provided live provider credentials. Do not mark `config/runtime/live-production-certification.json` as `live-certified` until every evidence category contains a concrete `lastVerifiedAt` and `evidenceId`.
