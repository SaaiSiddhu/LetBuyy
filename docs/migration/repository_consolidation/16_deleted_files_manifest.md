# 16 — Deleted Files Manifest

Stage 9 deleted exactly two literal, absolute paths — no variable expansion, no wildcard. Both are fully recoverable; see `14_recovery_and_rollback.md`.

| Deleted path | Size | What it was | Recovery |
|---|---|---|---|
| `/Users/saai_siddharth/Projects/Start_Up/LetBuyy/Ecommerce/LetBuyy` | 4.0 GB | System A — the Firebase-era LetBuyy marketplace repository (`github.com/SiddhuSaai/letbuyy.git`), including its nested nested `Agrimore` directory (below) | `~/LetBuyy-history-preservation-2026-08-29/system-A-letbuyy.bundle` (full history) + `system-A-unstaged.patch` (uncommitted tracked-file diff) + `system-A-gitignored-signing-files/` (2 gitignored `key.properties` files, content-blind backup) |
| `/Users/saai_siddharth/Projects/Start_Up/LetBuyy/Ecommerce/LetBuyy/Agrimore` (deleted as part of the path above, listed separately since it was a distinct git repository) | 1.7 GB (included in the 4.0 GB above) | System B — the Agrimore quick-commerce donor repository (`github.com/SiddhuSaai/Agrimore.git`) | `~/LetBuyy-history-preservation-2026-08-29/system-B-agrimore.bundle` (full history, 14 refs) + `system-B-unstaged.patch` + `system-B-untracked/` (242/242 untracked files, proven byte-identical) |
| `/Users/saai_siddharth/Projects/Start_Up/LetBuyy/Ecommerce` (parent, empty after the above) | ~6 KB (`.DS_Store` only) | Migration staging parent directory | Not meaningfully recoverable content (a macOS metadata file); not needed |

## What was NOT deleted

Every unique file/capability identified in `07_final_path_mapping.md` that had not yet been physically copied into this repository (System A's `packages/{core,models,services,ui_kit}`; System B's 11 `packages/agrimore_*`; the donor apps listed in `docs/architecture/APPLICATION_OWNERSHIP.md`; `legacy_archive_v2`; `ais/`, `docs/`, `reports/`, `tasks/`, `tooling/`, `chatgpt_cto_context/`; `graphify/`; the Firebase/Supabase/Terraform backend config not already copied into `services/compatibility/`) is **not separately preserved as extracted files in this repository** — it exists only inside the two bundles above. This is the single most important fact for whoever next works on this backlog: **the bundle is now the only copy of anything not explicitly listed as "moved" in Stage 3–5's journal entries.** See `17_remaining_migration_backlog.md` for the full list of what that includes.

## Byte-accounting note

The 4.0 GB / 1.7 GB figures are `du -sh` measurements taken immediately before deletion (see the journal's S9 entry for the exact command). No independent post-deletion disk-space verification was performed (not needed for this document's purpose — the recovery guarantee comes from the bundle's own `git bundle verify`, not from disk-space arithmetic).
