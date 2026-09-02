# services/compatibility/firebase_bridge

System A's (Firebase) Cloud Functions backend, relocated here as a **bounded
compatibility service** per Stage 5's explicit D-0 boundary: this move
reorganizes Firebase backend code structurally under `services/`, alongside
the rest of this repository's backend, **without** repointing any runtime
from Firebase to Supabase or vice versa, and without merging any domain model
with the canonical `services/api-gateway`.

## Status: NOT wired into any live path

This directory is **not** imported by, deployed alongside, or otherwise
connected to `services/api-gateway` or any of the 8 canonical ACTIVE
runtimes. It exists so Firebase-dependent logic has a location that matches
the target shape (`services/` for backend) while D-0 (which backend is
canonical) remains open. Activating it as a live path, or deleting it, both
require a D-0 decision this phase does not make.

## What's here and what isn't

Copied: `src/` (24 files — the real TypeScript Cloud Functions logic,
including `adminAuth.ts`'s server-side password-verification REST call),
`package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.dev.json`.

**Not copied (generated, regenerable):** `lib/` (compiled JS output of
`src/`, gitignored in the source repo) and `node_modules/` (432 MB,
gitignored). Regenerate with `npm install && npm run build` from this
directory if this bridge is ever activated.

**Correction to `07_final_path_mapping.md`'s figure:** that document cites
"127 files" for this directory. Re-measured this session:
`git ls-files functions | grep -v '^functions/lib/\|^functions/node_modules/'`
= 29 real tracked source files (this copy has 30, likely `.gitignore` itself
counted differently) — the 127 figure appears to have counted something else
(possibly including `lib/` or a different measurement method); not
reconciled, stated plainly per this engagement's practice of disclosing
count discrepancies rather than silently carrying a prior figure forward.

## Provenance

- **Source system:** System A, `Ecommerce/LetBuyy` (`github.com/SiddhuSaai/letbuyy.git`)
- **Source path:** `functions/`
- **Source HEAD at copy time:** `be716ae18b5f1e25e1266f963ab5c0907928db26`
- **Full commit history:** preserved in `~/LetBuyy-history-preservation-2026-08-29/system-A-letbuyy.bundle`
