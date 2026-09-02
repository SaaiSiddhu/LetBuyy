# apps/phase_2/rider_app

Quick-commerce delivery-rider mobile app. Donor: System B (Agrimore), no
equivalent capability anywhere in System A or System C.

## Readiness status

**NOT production-ready. Never represent as such.** Copied from its donor
system unmodified except for cosmetic de-branding (this README, the
`pubspec.yaml` description). Its backend integration target is **unresolved**
— it currently talks to System B's own Cloudflare Workers + Supabase project
(`workers/api-gateway`, `supabase/`), which is `D0_DEPENDENT` per
`docs/migration/repository_consolidation/07_final_path_mapping.md` and has
not been structurally addressed by this repository-consolidation phase.
Backend work for this app must route through whichever backend D-0 selects as
canonical — never a bespoke rider-app-only backend.

- **Owner:** unassigned — flagged for the founder/CTO to name an owner.
- **Target integrations:** the D-0-selected canonical backend's order/logistics
  domain (not yet built there); a dispatch/assignment flow; real-time location
  updates.
- **Package identity, not renamed:** `applicationId`/`namespace`
  `com.agrimore.rider_app` — this is an external, potentially-already-deployed
  identifier and is explicitly out of scope for this phase to rename. If/when
  this app is promoted toward production, renaming the package ID is a
  separate, deliberate decision with its own external-platform cutover
  (Play Console listing identity, any live Firebase project bound to this ID).
- **Internal `agrimore_*` package imports, not yet de-branded:** this app
  still imports the shared `packages/agrimore_*` Dart packages by their
  current names (not yet moved into this repository's `packages/dart/` — that
  is Stage 5 work). A full internal rebrand sweep is deferred until those
  shared packages have a final home and name.

## Provenance

- **Source system:** System B, `Ecommerce/LetBuyy/Agrimore` (`github.com/SiddhuSaai/Agrimore.git`)
- **Source path:** `apps/rider_app`
- **Source HEAD at copy time:** `20548b8938e2baa9c85b1e8f4ecc1f701999e331`
- **Full commit history:** preserved in `~/LetBuyy-history-preservation-2026-08-29/system-B-agrimore.bundle` (SHA-256 `2ed6cb3a845f24f719211729e4e94cd9c2cea99b96c4159aaaa22b02ce204b66`)
