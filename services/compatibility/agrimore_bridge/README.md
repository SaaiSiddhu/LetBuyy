# services/compatibility/agrimore_bridge

System B's (Agrimore) three Cloudflare Workers (`api-gateway`, `media-gateway`,
`realtime-gateway`) and their own Supabase-backed quick-commerce schema,
relocated here as a **bounded compatibility service**, structurally, per
Stage 5's D-0 boundary.

## Status: NOT wired into any live path — explicitly not a production route

**This is the exact case Stage 5 forbids activating.** Nothing in this
directory is imported by, deployed alongside, routed to, or otherwise
connected to `services/api-gateway` or any of the 8 canonical ACTIVE
runtimes. Per the brief's standing decision, **Agrimore is a quick-commerce
and operational feature DONOR, never a canonical backend** — this bridge
exists only so the donor backend code has a structurally-consistent location
(`services/`) instead of sitting scattered under the old `Ecommerce/LetBuyy/Agrimore/`
project root, while the underlying question of which capabilities get ported
into the canonical backend (and how) remains completely open and undecided.

## What's here

`api-gateway/`, `media-gateway/`, `realtime-gateway/` — System B's own
Cloudflare Worker source (50 files, excluding `node_modules/` and
`.wrangler/`, both gitignored/generated).

**Not copied:** System B's own `supabase/` directory (its Postgres schema) —
recorded in `07_final_path_mapping.md` as its own `D0_DEPENDENT` row, not
duplicated under this bridge in this pass; moving a full second Postgres
schema alongside its Workers was judged out of scope for "structural only"
given the risk of implying schema-level canonicity it does not have.

## Provenance

- **Source system:** System B, `Ecommerce/LetBuyy/Agrimore` (`github.com/SiddhuSaai/Agrimore.git`)
- **Source path:** `workers/`
- **Source HEAD at copy time:** `20548b8938e2baa9c85b1e8f4ecc1f701999e331`
- **Full commit history:** preserved in `~/LetBuyy-history-preservation-2026-08-29/system-B-agrimore.bundle`
