# packages/dart/quickcommerce_core

Core models, constants, utilities, and error handling shared across the quick-commerce channel packages. Not declared directly by either `apps/phase_2/*` app — pulled in transitively via `quickcommerce_domain`.

## Provenance

This package's history lives outside this repository's `.git`. It was established by copying (not `git mv`, since this is a cross-repository move) from:

- **Source system:** System B, `Ecommerce/LetBuyy/Agrimore` (`github.com/SiddhuSaai/Agrimore.git`)
- **Source path:** `packages/agrimore_core`
- **Source HEAD at copy time:** `20548b8938e2baa9c85b1e8f4ecc1f701999e331`
- **Full commit history:** preserved in `~/LetBuyy-history-preservation-2026-08-29/system-B-agrimore.bundle` (SHA-256 `2ed6cb3a845f24f719211729e4e94cd9c2cea99b96c4159aaaa22b02ce204b66`)
- **Original package name:** `agrimore_core` — renamed to `quickcommerce_core`, all internal "Agrimore" branding renamed to "Quickcommerce".

**Not one of the six packages either `apps/phase_2/*` app directly declares.** Discovered as a transitive dependency (`agrimore_domain` → `agrimore_core`) while walking the dependency closure in `docs/migration/repository_consolidation/18_dart_package_recovery_journal.md` Stage 1 — recorded there so the discovery isn't lost. `agrimore_services`, `agrimore_testing`, and `agrimore_ui` (also present in System B's `packages/`) were confirmed NOT part of the closure and were not imported.
