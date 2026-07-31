# EAOS Artifact Discovery

**Phase 8 — DISCOVERY ONLY. No code produced.**
Date: 2026-06-21

---

## 1. EngineeringLayer → Planned Artifact Path Pattern

Source: `packages/lcis-engineering/src/shared/types.ts` + `src/task/TaskIntelligenceService.ts`
(CONNECTED — structural, read from source files)

| Layer | Build Priority | Agent | Expected Artifact Path Pattern |
|---|---|---|---|
| `migration` | 10 | database | `supabase/migrations/*.sql` |
| `rpc` | 20 | database | `graphify-out/db-intel.json` → `.functions[]` |
| `gateway` | 30 | backend | `apps/*/src/app/api/**/*.ts` (route files) |
| `proxy` | 40 | backend | `apps/*/src/app/api/**/*.ts` (proxy handlers) |
| `ui` | 50 | frontend | `apps/*/src/components/**/*.tsx`, `apps/*/src/app/**/*.tsx` |
| `worker` | 60 | backend | `services/*/src/*.ts` (Cloudflare Workers) |
| `queue` | 65 | backend | `services/queue-workers/src/*.ts` |
| `event` | 70 | backend | `services/event-bus/**` (reserved — NOT IMPLEMENTED) |
| `test` | 80 | testing | `tests/launch/lb*.test.mjs`, `packages/*/test/**/*.ts` |
| `docs` | 90 | documentation | `docs/**/*.md`, `graphify-out/runbooks.json` |
| `verification` | 100 | verification | `scripts/validate-governance.mjs`, `scripts/validators/*.mjs` |
| `launch` | 110 | devops | `graphify-out/production-readiness-v2.json` |

---

## 2. Layer Gate → Validator Mapping

Source: `LAYER_GATE` constant in `packages/lcis-engineering/src/task/TaskIntelligenceService.ts`
(CONNECTED — structural)

| Layer | Gate Name | Validator File Exists? |
|---|---|---|
| `migration` | `rollback-integrity-validator` | YES — `scripts/validators/rollback-integrity-validator.mjs` |
| `rpc` | `canonical-ledger-only-validator` | YES — `scripts/validators/canonical-ledger-only-validator.mjs` |
| `gateway` | `route-ownership lockstep` | YES (close match) — `scripts/validators/route-ownership-validator.mjs` |
| `proxy` | `route-ownership lockstep` | YES (same file) |
| `ui` | `design-system ratchet` | YES (indirect) — `scripts/validate-design-system.mjs` + `design-system-baseline.json` |
| `worker` | `worker-runbook-gate` | **NO** — no `worker-runbook-gate*.mjs` in `scripts/validators/` |
| `queue` | `worker-runbook-gate` | **NO** (same missing gate) |
| `event` | `worker-runbook-gate` | **NO** (same; layer not implemented) |
| `test` | `107+ validator gate` | Conceptual — no single named file; gate = `pnpm validate` |
| `docs` | `governance-memory-validator` | **NO** — no `governance-memory-validator.mjs` |
| `verification` | `107+ validator gate` | Same as test |
| `launch` | `production-readiness-v2` | YES (close match) — `scripts/validators/production-readiness-validator.mjs` |

---

## 3. Real Artifact Corpus (Structural Catalog)

All counts below are CONNECTED — derived from on-disk file counts and `graphify-out/` JSON at
graph build time (2026-06-15T10:40:05Z). **Actual on-disk presence at plan execution time is
NOT_CONNECTED** — must be verified by `git status` / `fs.existsSync` / CI artifact scan at runtime.

| Artifact Type | Count | Canonical Path | Data Source |
|---|---|---|---|
| Validators | **112** | `scripts/validators/*.mjs` | `find scripts/validators -name '*.mjs'` |
| Active migration files (canonical path) | **0** | `supabase/migrations/*.sql` | `ls supabase/migrations/` |
| Migrations tracked by db-intel | **111** | `graphify-out/db-intel.json → .migrationFiles` | `db-intel.json` (graph build) |
| Archived migrations | **72** | `docs/archive/migrations-history/*.sql` | `find docs/archive -name '*.sql'` |
| Total .sql files (all locations) | **2,587** | repo-wide (excl. node_modules) | `find . -name '*.sql'` |
| DB tables | **417** | `graphify-out/db-intel.json → .tables` | `db-intel.json` |
| DB functions / RPCs | **164** | `graphify-out/db-intel.json → .functions` | `db-intel.json` |
| RLS policies | **658** | `graphify-out/db-intel.json → .policies` | `db-intel.json` |
| Triggers | **398** | `graphify-out/db-intel.json → .triggers` | `db-intel.json` |
| Indexes | **834** | `graphify-out/db-intel.json → .indexes` | `db-intel.json` |
| Domains | **22** | `graphify-out/domain-intel.json → .domains` | `domain-intel.json` |
| Gateway routes | **84** | `graphify-out/domain-intel.json → .routes` | `domain-intel.json` |
| Workers | **49** | `graphify-out/domain-intel.json → .workers` | `domain-intel.json` |
| Queues | **30** | `graphify-out/domain-intel.json → .queues` | `domain-intel.json` |
| Runbooks | **22** | `graphify-out/runbooks.json` | `runbooks.json` (one per domain) |
| db-intel.json size | 288 KB | `graphify-out/db-intel.json` | file stat |
| domain-intel.json size | 44 KB | `graphify-out/domain-intel.json` | file stat |

---

## 4. CONNECTED vs NOT_CONNECTED Tracking Table

| Artifact Dimension | Status | Source / Verification Method |
|---|---|---|
| EngineeringLayer → artifact path mapping | **CONNECTED** | `packages/lcis-engineering/src/shared/types.ts` + `TaskIntelligenceService.ts` |
| LAYER_GATE names | **CONNECTED** | `LAYER_GATE` constant in `TaskIntelligenceService.ts` |
| Validator file list (112) | **CONNECTED** | `find scripts/validators -name '*.mjs'` |
| db-intel counts (tables/functions/policies/triggers/indexes) | **CONNECTED** | `graphify-out/db-intel.json` (graph build 2026-06-15) |
| domain-intel counts (routes/workers/queues/domains) | **CONNECTED** | `graphify-out/domain-intel.json` (same build) |
| Runbook count (22) | **CONNECTED** | `graphify-out/runbooks.json` |
| Whether a PLANNED artifact actually exists on disk at plan time | **NOT_CONNECTED** | Source: `fs.existsSync(path)` / `git status` / CI artifact scan — must be called at EAOS execution time |
| Whether a PLANNED migration was actually applied to the DB | **NOT_CONNECTED** | Source: Supabase `schema_migrations` table — requires live DB probe |
| Whether a PLANNED test actually passed in CI | **NOT_CONNECTED** | Source: GitHub Actions run log / `gh run view` |
| Whether a PLANNED UI component was accepted (design review) | **NOT_CONNECTED** | Source: PR review status / Figma handoff sign-off |
| Whether a PLANNED runbook was exercised in a real incident | **NOT_CONNECTED** | Source: PagerDuty / incident log / `graphify-out/incident-timeline.json` |
| Worker deployment status (49 declared vs deployed) | **NOT_CONNECTED** | Source: `wrangler deployments list` / Cloudflare dashboard API |
| Route coverage (84 declared vs implemented) | **NOT_CONNECTED** | Source: `find apps/*/src/app/api -name 'route.ts' | wc -l` at execution time |

---

## 5. Honest Gaps (Structural)

1. **`supabase/migrations/` is empty** — the canonical `migration` layer artifact path (`supabase/migrations/*.sql`)
   yields 0 files at scan time. 111 migrations tracked in `db-intel.json` live in scattered locations
   (archive: 72 in `docs/archive/migrations-history/`, remaining 2,515 .sql files spread repo-wide).
   `artifactCoverage()` for `migration` layer will show 0/111 unless the path pattern is updated to match
   the real active migration root.

2. **`worker-runbook-gate` validator missing** — the `worker`, `queue`, and `event` layers reference this
   gate name in `LAYER_GATE`, but no `worker-runbook-gate*.mjs` exists in `scripts/validators/`. Gate is
   effectively unenforced for those 3 layers (49 workers, 30 queues declared).

3. **`governance-memory-validator` missing** — `docs` layer gate name has no corresponding `.mjs`. 90
   documentation artifacts planned across 22 domains have no structural gate.

4. **`event` layer has no artifact path** — `services/event-bus/` is reserved/not implemented (per CLAUDE.md).
   Any EINS task tagged `event` layer produces a planned artifact with no real target directory. EAOS should
   mark all `event` layer artifacts as `BLOCKED_RESERVED` until the event bus is scoped.

5. **Route logical names ≠ file paths** — `domain-intel.json` routes are logical identifiers (e.g.,
   `'app-store/app-lifecycle-routes'`), not file paths. The `gateway`/`proxy` layer `artifactCoverage()`
   cannot do a direct name match; it needs a glob scan (`apps/*/src/app/api/**/*.ts`) at execution time
   — which is NOT_CONNECTED.

---

## 6. `artifactCoverage()` / `missingArtifacts()` Model

```
artifactCoverage(layer, tasks):
  planned  = tasks.filter(t => t.layer === layer).flatMap(t => t.plannedArtifacts)
             // CONNECTED — derived from EngineeringTask at plan time

  existing = fs.glob(LAYER_PATH_PATTERN[layer])
             // NOT_CONNECTED — source: fs scan at EAOS execution time
             //                 or CI artifact manifest if available

  return { covered: intersect(planned, existing), missing: diff(planned, existing) }

missingArtifacts(layer):
  // returns planned - existing
  // honesty: diff is only meaningful when existing is freshly scanned (NOT_CONNECTED source)
  // stale existing = stale diff = misleading coverage signal
```

The EAOS model is honest by construction: `planned` is always CONNECTED (structural, from the task graph);
`existing` is always NOT_CONNECTED at plan time and must be injected at execution time from the real source
listed in the table above.

---

*DISCOVERY ONLY. No files modified. No code produced. Run `pnpm graph:update && pnpm graph:omega` to refresh
`db-intel.json` and `domain-intel.json` before comparing planned-vs-existing.*
