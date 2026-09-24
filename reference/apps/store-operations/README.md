# reference/apps/store-operations

Quick-commerce dark-store operations mobile app. Donor: System B (Agrimore),
no equivalent capability anywhere in System A or System C.

## Readiness status

**NOT production-ready. Never represent as such.** Copied from its donor
system unmodified except for cosmetic de-branding (this README, the
`pubspec.yaml` description). Its backend integration target is **unresolved**
— it currently talks to System B's own Cloudflare Workers + Supabase project
(`workers/api-gateway`, `supabase/`), which is `D0_DEPENDENT` per
`docs/migration/repository_consolidation/07_final_path_mapping.md` and has
not been structurally addressed by this repository-consolidation phase.
Backend work for this app must route through whichever backend D-0 selects as
canonical — never a bespoke store-ops-only backend.

- **Owner:** unassigned — flagged for the founder/CTO to name an owner.
- **Target integrations:** the D-0-selected canonical backend's inventory and
  fulfillment domains; a dark-store staffing/shift flow.
- **Package identity, not renamed:** `applicationId`/`namespace`
  `com.agrimore.store_ops_app` — this is an external, potentially-already-deployed
  identifier and is explicitly out of scope for this phase to rename. If/when
  this app is promoted toward production, renaming the package ID is a
  separate, deliberate decision with its own external-platform cutover.
- **Internal package imports, de-branded (Phase N):** this app now imports
  the shared packages from this repository's `packages/dart/quickcommerce_*`
  (moved and renamed from System B's `packages/agrimore_*` — see
  `docs/migration/repository_consolidation/18_dart_package_recovery_journal.md`
  Stage 4). Internal class names, display strings, and local storage/file
  labels were renamed `Agrimore` → `Quickcommerce` to match; the Android
  `applicationId`/`namespace` above was deliberately left unchanged (see
  above) and is tracked as PENDING EXTERNAL in the journal.

## Provenance

- **Source system:** System B, `Ecommerce/LetBuyy/Agrimore` (`github.com/SiddhuSaai/Agrimore.git`)
- **Source path:** `apps/store_ops_app`
- **Source HEAD at copy time:** `20548b8938e2baa9c85b1e8f4ecc1f701999e331`
- **Full commit history:** preserved in `~/LetBuyy-history-preservation-2026-08-29/system-B-agrimore.bundle` (SHA-256 `2ed6cb3a845f24f719211729e4e94cd9c2cea99b96c4159aaaa22b02ce204b66`)
