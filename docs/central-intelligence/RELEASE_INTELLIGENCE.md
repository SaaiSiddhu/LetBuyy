# LCIS v2 — Release Intelligence (Phase 8)

A release analyzer: for a changed symbol/file, compute the impact across code, data, tenant, payment, and security before merge.

## The analysis (run per changed symbol)
```bash
pnpm graph:intel blast "<symbol>"     # code blast radius (impacted nodes/files)
pnpm graph:intel consumers "<symbol>" # direct dependents
pnpm graph:intel owner "<symbol>"     # who must review (CODEOWNERS)
pnpm graph:intel table "<table>"      # if a migration: RPCs + routes + policies affected
pnpm graph:intel rpc "<rpc>"          # if an RPC: tables touched + callers
```

## Impact dimensions
| Dimension | Source | Signal |
|-----------|--------|--------|
| **Code impact** | `blast` | impacted nodes / files (e.g. `getSupabaseAdmin` → 197/115) |
| **Dependency impact** | `consumers` | direct callers |
| **Data impact** | `table`/`rpc` | tables + policies + routes touched |
| **Tenant impact** | `tenant` + table.tenant flag | does it touch tenant tables? RLS present? |
| **Payment impact** | `payment` + table.money flag | does it touch money tables / a money RPC? |
| **Security impact** | the 5 deterministic validators | must stay green |
| **Ownership** | `owner` | required reviewer |

## Change-control hotspots (always run `blast` before merge)
| Symbol | Blast |
|--------|------:|
| `getSupabaseAdmin` | 197 nodes / 115 files |
| `@letbuyy/shared-types` index | degree 806 |
| `@letbuyy/api-client` index | degree 669 |
| `create_checkout_order` | 19 tables |

## Release gate (repository truth)
`production-deploy.yml` runs `migrate-production` (gated `db push --include-all`) **before** the worker + Vercel deploys; 19 secrets required. Pre-merge: gate 107/107 + 5 app `next build` + launch suite (see `docs/implementation/`).

## Use it
A PR touching the money path or a high-blast symbol → run the analysis above, attach the impact, require the CODEOWNERS reviewer. No full-repo scan needed to know what a change affects.
