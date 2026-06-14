# LCIS — Current State Audit (Phase 0)

Repository-truth audit of the intelligence layer as it stands.

## What exists (verified)
| Asset | State |
|-------|-------|
| Graphify install | ✅ `graphifyy` 0.8.39 (isolated via uv) |
| Code graph | ✅ `graphify-out/graph.json` — 52,246 nodes / 66,761 edges / 3,279 communities / 3,677 files (gitignored) |
| Graph UI | ✅ `pnpm graph:ui` → :3333 (Atlas, Data Layer, 12 domain dashboards, search, path, blast) |
| **DB intelligence** | ✅ **new** — `db-intel.mjs` → 414 tables, 156 functions, 651 policies, 395 triggers, 826 indexes |
| Intelligence engine | ✅ **new** — `intelligence.mjs` (deps/consumers/blast/critical/payment/tenant/flow) |
| Graph commands | ✅ `.claude/commands/graph-*.md` (6) + per-domain audits |
| Intelligence docs | ✅ `docs/graph/*`, `docs/architecture/*`, `docs/central-intelligence/*` |
| Security workflows | ✅ `.github/workflows/security-review.yml`, `full-security-audit.yml` |

## Maturity
| Dimension | Before LCIS | After LCIS |
|-----------|-------------|-----------|
| Code coverage | High (tree-sitter, 52k nodes) | High |
| **Database coverage** | **~2% (SQL bodies unindexed)** | **High — 414 tables / 156 RPCs / 651 policies parsed** |
| Impact analysis | manual | `blast` (e.g. `getSupabaseAdmin` → 197 nodes / 115 files) |
| Flow tracing | manual | route → rpc → table chains |
| Claude access | via HTTP API + commands | same + DB intel + intel CLI |

## Blind spots that remain (honest)
1. **SQL symbols are not graph nodes** — Graphify indexes code; individual RPCs aren't in `graph.json`. The DB layer (`db-intel.json`) is the source of truth for the data model; blast-radius works on **code** symbols.
2. **Runtime/dynamic edges** — DI, event-bus, and string-keyed dispatch aren't statically captured.
3. **Community names** are derived (dominant workspace), not LLM-labeled (no API key set).
4. **Mobile (Dart)** is indexed structurally but flows aren't traced.

## Risk areas surfaced
- 103 SECURITY-DEFINER functions not invoked via gateway `db.rpc` (mostly triggers/internal — review candidates).
- 20 tenant tables without a regex-detected RLS enable (validator passes — verify, likely service-role/ledger).

## Improvement opportunities (delivered in this build)
DB extraction · route→rpc→table flow · blast radius · critical-systems ranking · autonomous discovery · production intelligence · per-domain audit agents.
