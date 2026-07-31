# 04 — Feature Flag & Migration Registry

## Temporary feature flags (Phase-4.x)
| Flag | Values | Default | Behavior | Documented |
|---|---|---|---|---|
| `MERCHANT_STAFF_RBAC_MODE` | `off` · `dryrun` · `enforce` | **`dryrun`** | Staff-permission guard: `dryrun` logs `staff_rbac_decision` but never blocks; `enforce` returns 403 for ungranted staff (owners always bypass); `off` disables. Fail-open on error. | ✅ phase-4-5/06, phase-4-75/06,07,13 |

This is the **only** temporary flag introduced in Phase 4.x. It is intentionally `dryrun` by default so enforcement is behavior-neutral until validated against a live auth stack, then flipped to `enforce`. **No undocumented temporary flags remain.** (`.wrangler/tmp/*` references are build artifacts, not source.)

## Migrations
**Phase-4 merchant work introduced ZERO migrations.** `migration-safety-validator` **PASS** → no unfinished/unsafe migration exists.

The working tree contains pending migrations from **parallel V1 workstreams** (not Phase-4 merchant scope), all complete files (not partial):
- Added: `175_fix_session_rpc_search_path`, `176_v1_founding_program_schema`, `177_v1_founding_program_rpcs`, `178_v1_pricing_plans_seed`, `181_urban_kicks_settings_schema_complete`, `182_v1_sites_timezone` (+ others in the lane).
- Modified: `100_app_discovery_foundation`, `109_orders_money_width`, `111_customer_credentials_source_of_truth`, `142_executable_payment_sessions`.

These are tracked under the broader V1 / two-lane remediation effort and are **out of Phase-4 merchant lock scope**; migration-safety confirms none is unfinished/destructive. They (plus the deploy-gated H-seam migrations) are Phase-5/launch baseline items.

**Locked:** one documented flag (dry-run), zero Phase-4 migrations, no unfinished migration.
