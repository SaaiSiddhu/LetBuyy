# Production Certification

LetBuyy production certification is credential-gated. The repository must always support plan mode, and it may only claim live-certified status after execute mode successfully records evidence through the operations control plane.

## Modes

- Plan mode: validates topology, manifests, Cloudflare bindings, Supabase verification SQL, observability config, security gates, Worker dry-run deployment, incident contracts, dashboard contracts, and operations API contracts without mutating providers.
- Execute mode: requires Cloudflare, Supabase, observability, Vercel, operations API, Terraform, psql, and secret-rotation inputs. It deploys, verifies, rotates secrets, records dashboard/incident/control-plane evidence, and writes certification evidence.
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
- `operational_dashboard_snapshots`
- `security_enforcement_events`
- `runtime_control_commands`
- `operational_certification_reports`

## Central Report

Generate a central certification report:

```bash
node infrastructure/scripts/operations/generate-certification-report.mjs --environment=production --mode=plan
```

Credentialed execute mode records the report through `/v1/operations/runtime/certification-reports`:

```bash
node infrastructure/scripts/operations/generate-certification-report.mjs --environment=production --mode=execute --record
```

Reports expire after the configured evidence window in `config/runtime/live-production-certification.json`.

## Certification State

Current repository state is `credential-gated-plan-ready`. This means the executable workflows and evidence contracts exist, but this checkout has not provided live provider credentials. Do not mark `config/runtime/live-production-certification.json` as `live-certified` until every required category contains a concrete `lastVerifiedAt` and `evidenceId`.

Retired failover, chaos, event-store, replay, and multi-region categories are not active certification requirements for the one-region topology.
