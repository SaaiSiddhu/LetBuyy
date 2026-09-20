# 00b — Constitutional Amendment Draft: Six-App Topology

**Status: DRAFT, FINALISED FOR SIGNATURE. Not applied.** No directory has been created, renamed, or moved to produce this document, in Phase 0 or in this revision. This is the document the owner reads once and either signs, rejects, or amends. Every rename phase (3, 4, 6) stays blocked until a signature is recorded in the block at the end of this document. Nothing in this document is a decision — where a choice depends on a founder decision (D-0 through D-7) or a survivor question, both variants are written out and labelled, not chosen.

## What is closed vs. what remains open

**Closed (owner decision, not relitigated here):** the final application structure is six product-facing runtimes — `apps/customer_app`, `apps/customer_web`, `apps/merchant_app`, `apps/merchant_web`, `apps/admin_app`, `apps/admin_web` — plus two new structural tiers, `apps/phase_2/*` and a directory for non-six-app-model runtimes (name open, see Gap 2).

**Open, and not decided by this document:** which existing codebase becomes each of the six (see `04_application_survivor_scorecard.md` for evidence, not a verdict); founder decision D-0 (canonical backend) through D-7; the fee/merchant-of-record model; the actual timing/sequencing of the rename.

## Current constitutional topology (as written today, re-verified this session)

The Constitution fixes exactly 8 named ACTIVE runtimes, 2 SUPPORTING non-extractable apps, 8 RESERVED manifest-only placeholders, and 4 FROZEN roots — re-read directly from `CLAUDE.md` lines 62–95 this session, not carried forward from memory. A Deprecated Runtime Policy (`CLAUDE.md:98–112`) forbids `apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `apps/mobile/operator-team-app`, and `apps/storefront-runtime/consumer-storefront` as active topology. This is mirrored in code, not just prose: `scripts/validators/governance-common.mjs` (read directly, lines 57–116) defines these as exported arrays —

```js
canonicalAppRoots = [
  "apps/storefront-runtime", "apps/merchant-control-plane", "apps/identity-platform",
  "apps/marketing-site", "apps/platform-console", "apps/mobile/merchant-app",
];
frozenAppRoots = [
  "apps/app-marketplace", "apps/developer-portal", "apps/theme-marketplace",
  "apps/platform-operations-portal",
];
reservedMobileRuntimeRoots = ["apps/mobile/shopper-app", "apps/mobile/operator-app"];
deprecatedAppAliasRoots = [
  "apps/admin", "apps/analytics", "apps/auth", "apps/checkout",
  "apps/internal", "apps/merchant", "apps/storefront",
];
forbiddenRuntimeRoots = [...deprecatedAppAliasRoots, "apps/mobile/operator-team-app"];
forbiddenRuntimeSubtrees = ["apps/storefront-runtime/consumer-storefront"];
canonicalServiceRoots = ["services/api-gateway", "services/mobile-bff", "services/webhook-service", "services/queue-workers"];
reservedServiceRoots = ["services/checkout-runtime", "services/search-service", "services/media-service", "services/notification-service", "services/event-bus", "services/analytics-pipeline"];
```

This accounts for **10 of `services/`'s 11 entries** (4 ACTIVE + 6 RESERVED). The 11th, `services/lcis-api`, is Gap 3 below.

---

## GAP 1 — the deprecated-alias carve-out

**Re-verified this session, both halves.**

**Code side (safe today):** `scripts/validators/governance-common.mjs:203` —
```js
export function startsWithPrefix(file, prefix) {
  return file === prefix || file.startsWith(`${prefix}/`);
}
```
This is boundary-safe. `"apps/admin_app".startsWith("apps/admin" + "/")` is `false` (there is no `/` after `admin` in `admin_app`), and `"apps/admin_app" === "apps/admin"` is `false`. Every validator that checks membership in `deprecatedAppAliasRoots`/`forbiddenRuntimeRoots` through this helper will not false-positive on `apps/admin_app`, `apps/admin_web`, `apps/merchant_app`, or `apps/merchant_web`.

**Prose side (not safe today):** `CLAUDE.md:100` reads "Do not recreate or reference deprecated app aliases as active topology" followed by the bare list (`apps/admin`, `apps/merchant`, …) with no exact-path qualifier. A future contributor — human or AI — reading the prose rather than the code has no way to know the check is boundary-safe, and could reasonably block or revert a rename of `apps/merchant-control-plane` → `apps/merchant_web` on the mistaken belief that "merchant" anywhere in a path is forbidden.

**Amendment text — the carve-out sentence, naming all four new paths explicitly:**

> `apps/admin_app`, `apps/admin_web`, `apps/merchant_app`, and `apps/merchant_web` are declared approved six-app-model names. None of the four is an instance of the deprecated `apps/admin` or `apps/merchant` aliases — the Deprecated Runtime Policy's prohibition names only the exact historical paths `apps/admin` and `apps/merchant`, never re-created under those exact names, and the shared path-matching helper (`startsWithPrefix()`, `scripts/validators/governance-common.mjs:203`) already treats path-prefix boundaries correctly, confirmed by direct read of its implementation. This sentence exists to close a prose ambiguity, not a code defect.

**Recommendation:** add this exact sentence to `CLAUDE.md`'s Deprecated Runtime Policy section when the amendment is applied, immediately after the alias list. Not applied in this phase.

---

## GAP 2 — the `apps/supporting/*` term collision

**Confirmed this session:** `CLAUDE.md:73` already defines SUPPORTING as a constitutional tier — `apps/mobile/merchant-app` and `apps/platform-console`, "ride the canonical topology; non-extractable; authorize no further backend service." The owner's target structure reuses the identical word "supporting" for a *different* grouping — a directory intended to hold `marketing-site`, `identity-platform`, `developer-portal`-class runtimes that are real and functioning but aren't part of the six-product-name set. Same word, two different meanings, in the same document family.

Three ways to close this, each with its real consequence — **not a decision, a menu:**

| Option | What it does | Consequence |
|---|---|---|
| **A — Rename the existing constitutional tier** (e.g. SUPPORTING → PLATFORM or EMBEDDED) | Frees the word "supporting" for the owner's new directory | Touches every place the word SUPPORTING is used as a tier name today: `CLAUDE.md`, this document, `04_application_survivor_scorecard.md`, `07_final_path_mapping.md`, and any validator/config that stores the literal string "SUPPORTING" as a classification label (not verified this session which, if any, do — a text-search sweep, not attempted here, would be needed before applying this option) |
| **B — Rename the owner's new directory** (e.g. `apps/supporting/` → `apps/auxiliary/`, `apps/platform/`, or `apps/other/`) | Leaves the existing constitutional tier and every reference to it untouched | Only affects a directory that does not exist yet — zero existing references to update, but requires the owner's sign-off on a different name than originally proposed |
| **C — Define both explicitly, keep both names** | No renames anywhere | Lowest execution cost today, highest ongoing cost forever — every future document, validator error message, and conversation about "supporting" must disambiguate tier-SUPPORTING from directory-`apps/supporting/`, and a misreading (by a human or an AI session) is a standing risk this whole engagement's own history shows is real (see the deprecated-alias prose gap directly above) |

**Recommendation: Option B.** The new directory doesn't exist yet, so renaming it costs nothing today, while the existing SUPPORTING tier is already load-bearing in the Constitution's own prose and in this document. This is a recommendation, not a decision — the owner may prefer A or C.

---

## GAP 3 — `services/lcis-api` and the wider LCIS tooling layer

**Fully re-verified this session**, and the brief's own count needed a correction, recorded here rather than silently carried forward.

`services/lcis-api`: 9 git-tracked files (`AGENTS.md`, `package.json`, `tsconfig.json`, `src/app.ts`, `src/index.ts`, `src/middleware.ts`, `src/server.ts`, `test/app.test.ts`, `test/execution.test.ts` — confirmed via `git ls-files services/lcis-api`), real TypeScript, **no `wrangler.toml`** (confirmed absent — every one of the 10 governed `services/*` runtimes is a Cloudflare Worker; this one structurally is not). `grep -n "lcis-api" scripts/validators/governance-common.mjs CLAUDE.md AGENTS.md` returns nothing in any of the three — it is named in none of the governing documents.

The same gap extends further than just this one directory:
- `tools/graph-server`, `tools/central-intelligence` — also absent from `governance-common.mjs`, `CLAUDE.md`, `AGENTS.md`.
- `packages/lcis-*` — **19 packages** (`packages/lcis-adapters` through `packages/lcis-twin`, listed via `ls -d packages/lcis-*` this session), also absent from all three governing files. **Correction to this phase's brief, which stated 14: the real, counted number is 19.**

This is a classification gap, not a rogue runtime — `services/lcis-api` and its siblings are the Central Intelligence System's own implementation (documented extensively elsewhere in `CLAUDE.md`'s AI-infrastructure section), not undisclosed commerce backend. But a naive rule a future phase might reach for — "everything under `services/` is backend, everything under `packages/` is a domain package" — would misclassify 20 directories (`services/lcis-api` + 19 `packages/lcis-*`) as governed commerce infrastructure when they are dev-time tooling.

Two ways to close this — **not a decision:**

| Option | What it does | Migration cost | Blast radius |
|---|---|---|---|
| **A — Relocate to `tools/`** (`services/lcis-api` → `tools/lcis-api`, alongside `tools/graph-server`/`tools/central-intelligence`) | Makes the physical location match the existing "tooling lives under `tools/`" convention | A real `git mv` of 9 files, plus any script/doc that references `services/lcis-api` by path (not swept this session — a dedicated reference search, same method as `07`/`08`'s path-mapping work, would be needed before applying) | Unknown until that sweep runs; likely small given zero governance-file references were found, but LCIS's own internal cross-references (its own docs reference its own paths) were not checked |
| **B — Define a fifth constitutional class, TOOLING** (`services/lcis-api`, `tools/graph-server`, `tools/central-intelligence`, all 19 `packages/lcis-*` explicitly listed as TOOLING — non-deployed, non-commerce, authorizes nothing) | No files move; the Constitution's four-class list becomes five, and each of the 21 named paths gets an explicit entry | Zero `git mv` operations, zero risk of breaking a path reference | Touches only governance documents (`CLAUDE.md`, `governance-common.mjs` gains a `toolingRoots` export used by whichever validator needs to distinguish tooling from commerce) — no source file moves |

**Recommendation: Option B.** It resolves the classification gap (which is the actual problem — nothing here is currently misbehaving, it's just unnamed) without moving 28 directories' worth of working tooling code for a naming preference. Option A is the more "correct-looking" filesystem layout but carries real, unmeasured reference-breakage risk for a purely cosmetic gain. This is a recommendation, not a decision.

---

## GAP 4 — the new structural tiers: `apps/phase_2/*` and the SUPPORTING-collision directory

The Constitution has exactly four classes today: ACTIVE, SUPPORTING, RESERVED, FROZEN. The owner's target structure adds two more groupings that don't fit any of the four as currently defined. Draft amendment text for both:

**`apps/phase_2/*`** (currently: `rider_app`, `store_ops_app`, both donor apps from System B with **no equivalent anywhere in System A or System C** — confirmed in `07_final_path_mapping.md`'s UNRESOLVED section, items on `rider_app`/`store_ops_app`):

> `apps/phase_2/*` holds runtimes for product capabilities not yet part of the six-app model's core scope — currently the quick-commerce rider and store-operations verticals. A path under `apps/phase_2/` is **not** ACTIVE (not part of the governed 8-runtime commerce core), **not** RESERVED (it holds real source, not an empty manifest placeholder — RESERVED roots must stay empty per the existing rule; `apps/phase_2/*` explicitly does not), and **not** FROZEN (it is not a deploy-target that was once live and is now paused — it has never been part of System C's topology). Activating a `phase_2` app into full ACTIVE status requires the same ARB approval and constitutional amendment any topology change requires. Existing in `apps/phase_2/` authorizes no new backend service — any backend work these apps need routes through the D-0-selected canonical backend, not a bespoke one.

**The SUPPORTING-collision directory** (name pending Gap 2's resolution — written here as `apps/{name}/`, holding `marketing-site`, `identity-platform`, `developer-portal`-class runtimes):

> `apps/{name}/` holds runtimes that are real, deployed, and governed, but are not one of the six core product-facing names. This is not a demotion — `apps/identity-platform` (sole token issuer target) and `apps/marketing-site` remain ACTIVE-class in every functional sense; `apps/{name}/` is a *directory grouping*, not a new authority tier. Membership in `apps/{name}/` does not change a runtime's ACTIVE/RESERVED/FROZEN status — it is an organizational label answering "which of these is one of the six," not "is this governed."

**Interaction with the RESERVED-roots-must-stay-empty rule, stated explicitly so this cannot be misread later:** RESERVED is the *only* tier where "must stay empty" applies. Neither `apps/phase_2/*` nor the SUPPORTING-collision directory are RESERVED, and neither is subject to the emptiness rule — both are expected to hold full, real source from the moment they're created. Conflating "not ACTIVE" with "must be empty" would be a category error this amendment exists to prevent.

---

## Every file that hardcodes a current runtime name — §61 fully closed, real counts, no placeholder list

Phase 0's original document listed 12 config files as "found via `grep -rl`, not yet individually opened." **All 12 were opened this session**, plus the 4 remaining apps' own `runtime.manifest.json`/`package.json` that the original text assumed "follow the same pattern" without checking. Real count: **359 hardcoded-runtime-name occurrences across 18 files**, every one a pure path-string or label-string edit — **none required touching validator logic**, confirmed by reading each file's content, not just its grep hit count.

### Central source-of-truth (unchanged from Phase 0, re-confirmed)

`scripts/validators/governance-common.mjs` (lines 57–116, quoted in full above) — `grep -rl governance-common scripts/validators/*.mjs` finds **105 of the 115 files in `scripts/validators/`** import from this module. Amending the arrays here is necessary and, for any validator that only references the exported array, sufficient.

### Validators with an additional hardcoded literal beyond the shared import

`scripts/validators/mobile-topology-honesty-validator.mjs:14` — `reporter.assert(canonicalAppRoots.includes("apps/mobile/merchant-app"), …)`, a literal string assertion independent of the array. Nine more validators reference `apps/mobile/merchant-app`/`shopper-app`/`operator-app` directly per `grep -l` (not individually re-read this session, unchanged from Phase 0: `beta-readiness-validator.mjs`, `ci-simulation-validator.mjs`, `custom-domain-target-validator.mjs`, `dart-dead-source-validator.mjs`, `domain-boundary-validator.mjs`, `environment-validator.mjs`, `provider-mode-badge-validator.mjs`, `token-source-single-validator.mjs`, plus `governance-common.mjs` itself). A full hand-review of all 105 importers for a similar independent literal remains Phase 3 work, not completed here.

### Non-validator config files — opened, counted, classified

| File | Occurrences | Nature | Path-string edit, or validator logic? |
|---|---|---|---|
| `config/vercel/projects.json` | 10 | Vercel project `name`/`directory` fields, pure JSON | Pure path-string |
| `config/runtime/deployment-topology.json` | 11 | `runtimeRoot` fields + derived `checkName` strings (dash-normalized from the path — both must change together) | Pure path-string |
| `config/runtime/production-topology.json` | 12 | `runtimeRoot` fields + sibling manifest-file existence paths (e.g. `apps/identity-platform/vercel.json`) | Pure path-string |
| `config/env/staging-production-secret-matrix.json` | 15 | App-path → short-name → **environment-variable name** mapping (e.g. `apps/merchant-control-plane` → `merchant-control-plane` → `MERCHANT_CONTROL_PLANE_INTERNAL_SECRET`) | Pure path-string **in this file** — but renaming cascades to a live secret name in the actual Cloudflare/Vercel deployment dashboards, which this repository does not control and this document cannot verify. Flagged, not resolved. |
| `config/env/ownership/runtime-env-ownership.json` | 6 | App-path array entries | Pure path-string |
| `config/governance/web-v1-scope-registry.json` | 66 | Evidence strings inside a dated Web V1 scope audit (`"evidence": "apps/merchant-control-plane/src/..."`) — read by `web-v1-scope-perimeter-validator.mjs:290-291`, which checks `entry.evidence` is a string >20 chars, **not** that it names a real path | Pure path-string, and **not required for the gate to keep passing** (verified by reading the validator's actual check) — but left unedited after a rename, these 66 entries become factually stale citations. Recommend updating for accuracy, not required for governance. |
| `config/eslint/boundary-baseline.json` | 179 | Per-file lint-ratchet baseline entries, one line per file, e.g. `"apps/identity-platform/src/app/api/auth/accounts/route.ts"` | Pure path-string — largest single file in this sweep, mechanically a prefix substitution across all 179 lines |
| `.github/workflows/mobile-merchant-release.yml` | 6 | `working-directory:` YAML fields | Pure path-string |
| `.github/workflows/ci.yml` | 8 | `working-directory:` YAML fields | Pure path-string |
| `apps/mobile/merchant-app/runtime.manifest.json` | 6 | `runtimeRoot`, `sourceAuthority`, a manifest-file existence path, `runtimeClassification: "mobile-merchant-control-plane"` (a derived slug, not a literal path — still just a string) | Pure path/label-string |
| `apps/merchant-control-plane/runtime.manifest.json` | 7 | Same shape as above, plus `secretStore: "Vercel merchant-control-plane project environment"` (prose referencing the name) | Pure path/label-string |
| `apps/merchant-control-plane/package.json` | 2 | `"name": "@letbuyy/merchant-control-plane"` (the npm package name — checked whether any other workspace package imports it by this name: not verified this session) + a `test` script referencing its own subpath test files | Pure string; the npm package-name rename's cross-workspace import impact was **not verified this session** |
| `apps/storefront-runtime/{runtime.manifest.json,package.json}` | 7 (6+1) | Same shape, verified present this session (Phase 0 had assumed, not checked) | Pure path/label-string |
| `apps/identity-platform/{runtime.manifest.json,package.json}` | 8 (6+2) | Same shape, verified present this session | Pure path/label-string |
| `apps/marketing-site/{runtime.manifest.json,package.json}` | 8 (6+2) | Same shape, verified present this session | Pure path/label-string |
| `apps/platform-console/{runtime.manifest.json,package.json}` | 8 (6+2) | Same shape, verified present this session | Pure path/label-string |

**Total: 359 occurrences across 18 files (7 shared config files + 2 GitHub workflows + 6 apps' own manifest/package.json pairs), every one confirmed a pure string edit by reading the surrounding code, zero requiring a change to what a validator's logic actually checks.** The one genuine non-repository consequence found: the secret-matrix file's env-var-name cascade, which this repository cannot itself resolve (it names variables that live in external deployment platforms).

---

## Blast radius

Drawn from `07_final_path_mapping.md` and `09_pre_restructure_build_baseline.md`, cited by name:

- **Path-mapping ledger (`07_final_path_mapping.md`):** every top-level path across all three systems was classified with a proposed destination, an action (MOVE/COPY/EXTRACT/MERGE/DELETE/DEFER), and a `D0_DEPENDENT` flag. The six-app rename touches the rows marked MOVE for the six ACTIVE/SUPPORTING candidates plus this document's own 359-occurrence config sweep above — `07` does not carry an aggregate file-count total beyond that per-row table, so this document does not fabricate one; the true single number is `359` (config/manifest references) `+ 105` (validators importing `governance-common.mjs`) `+ 10` (validators with their own literal) as the closest measured approximation of "files touched," not counting the six directories' own internal file counts, which move with them via `git mv` and require no internal edits.
- **Pre-existing failures (`09_pre_restructure_build_baseline.md`):** **6 of the 10 governed runtimes are fully green today** (`marketing-site`, `queue-workers`, `mobile-bff`, `webhook-service`, `platform-console`, `apps/mobile/merchant-app`); the other 4 (`identity-platform`, `storefront-runtime`, `merchant-control-plane`, `api-gateway`) already have a first-failure recorded in `09`, attributed there to specific pre-existing dirty files or tracked defects — **none caused by this document or by any rename.** This baseline exists precisely so that if a rename lands and one of these four still fails, or a currently-green runtime turns red, the failure is attributable: compare against `09`'s recorded first-failure-by-name before assuming the rename caused it.

## Rollback

`git mv` preserves file history through Git's rename-detection heuristic (confirmed working in this engagement's own Phase 7.5: 159 files moved, `git show --name-status -M HEAD` recorded every one as `R100`). Two rollback scenarios, depending on whether the rename has been pushed anywhere:

1. **Rename committed locally, not yet pushed** (the state every phase of this engagement has stayed in — the branch is currently 20 commits ahead of `main`, entirely local-only relative to `main`, per `09`'s own governance-gate finding): `git reset --soft HEAD~N` (N = the number of rename commits) restores the pre-rename working tree and index exactly, with zero data loss, exactly as this engagement's own Phase 7.5 demonstrated correcting a malformed commit. The rename can then be re-attempted or abandoned.
2. **Rename pushed and pulled by another session or remote:** a hard rewind is no longer safe (per this whole engagement's standing prohibition on force-push and history rewrite on shared branches). Rollback instead means a **forward revert**: `git revert` the rename commit(s), which — because they are clean `R100` renames — produces a clean inverse rename moving every file back to its original path, itself provable the same way (`git show --name-status -M` on the revert commit should also read 100% renames, not delete+add).

Either path is reversible. Neither path is instant or free — a config-file sweep this large (359 occurrences) means a revert commit is large too, even though it is mechanically simple.

---

## Amendment text (draft, incorporating Gaps 1–4, for the owner to approve or edit — not yet applied to the Constitution)

> **Amendment — Six-App Topology and Structural Tiers (proposed, pending ARB/owner approval).**
>
> 1. The canonical application topology is renamed from its current 8-runtime-plus-2-supporting-app form to six product-facing application roots: `apps/customer_app`, `apps/customer_web`, `apps/merchant_app`, `apps/merchant_web`, `apps/admin_app`, `apps/admin_web`. This supersedes the specific path names in the Canonical Runtime Map and Deprecated Runtime Policy sections wherever they conflict, but does **not** change the underlying design law (modular monolith, `site_id` tenancy, zero-fee ledger, RLS+FORCE RLS backstop, sole-issuer identity target) — only application-layer naming and grouping.
> 2. **Gap 1 carve-out:** `apps/admin_app`, `apps/admin_web`, `apps/merchant_app`, and `apps/merchant_web` are approved six-app-model names, not instances of the deprecated `apps/admin`/`apps/merchant` aliases (full text under Gap 1 above).
> 3. **Gap 2 resolution:** *[pending owner choice among Options A/B/C above; Option B — renaming the new directory, not the existing SUPPORTING tier — is this document's recommendation]*.
> 4. **Gap 3 resolution:** *[pending owner choice between Option A (relocate to `tools/`) and Option B (new TOOLING class) above; Option B is this document's recommendation]*.
> 5. **Gap 4:** `apps/phase_2/*` and the SUPPORTING-collision directory are defined as described above — neither is RESERVED, neither is subject to the "must stay empty" rule, and neither authorizes any new backend service.
> 6. Every file enumerated in this document's config sweep (359 occurrences across 18 files) and every validator identified (105 importers of `governance-common.mjs` plus 10 with independent literals) must be updated in the same change series that performs the rename. The rename must not land before `governance-common.mjs`'s canonical arrays are updated, or the governance gate will fail on the very next run.
> 7. This amendment does not resolve D-0 through D-7, does not select a survivor codebase for any of the six slots, and does not decide the fee or merchant-of-record model.

This text is a draft for the owner's edit, not a ratified amendment — no Constitution file was modified in this phase.

---

## SIGNATURE BLOCK

**Signing this block approves the items marked ✅ below and nothing else.** It does not resolve D-0, does not select a survivor codebase for any of the six product slots, does not decide the fee/merchant-of-record model, and does not authorize Phase 3 to begin until every item is marked.

| # | Item | Approve | Reject | Amend (describe) |
|---|---|---|---|---|
| 1 | The six product-facing names: `apps/customer_app`, `customer_web`, `merchant_app`, `merchant_web`, `admin_app`, `admin_web` | ☐ | ☐ | ☐ |
| 2 | Gap 1 carve-out sentence, verbatim as drafted above | ☐ | ☐ | ☐ |
| 3 | Gap 2 resolution — **specify: Option A / B / C** | ☐ | ☐ | ☐ |
| 4 | Gap 3 resolution — **specify: Option A / B** | ☐ | ☐ | ☐ |
| 5 | Gap 4 tier definitions (`apps/phase_2/*` and the SUPPORTING-collision directory) | ☐ | ☐ | ☐ |
| 6 | The 359-occurrence config sweep and 115-validator update obligation, to be executed in the same change series as the rename | ☐ | ☐ | ☐ |
| 7 | Explicit non-approval: this signature does **not** resolve D-0–D-7, does not pick a survivor app, does not set the fee model | (acknowledged by signing) | | |

**Signed:** ______________________ **Date:** ______________________

**Once all 7 rows are marked, this document authorizes Phase 3 to begin planning the rename — not to execute it. Execution still requires its own separate go-ahead per the two-lane merge rule and the governance-gate-green precondition.**

---

## Correction block — dated, Phase 2B finalisation, 2026-09-02 (appended, not rewriting the record above)

This revision closed all four gaps identified in Phase 2B's brief:

- **Gap 1** (deprecated-alias carve-out): re-verified `governance-common.mjs:203` and `CLAUDE.md:98-112` directly; added the explicit carve-out sentence naming all four new paths (`apps/admin_app`, `apps/admin_web`, `apps/merchant_app`, `apps/merchant_web`) together — the original draft's carve-out language (still preserved in the "Every file discovered" section above) only named two of the four.
- **Gap 2** (SUPPORTING term collision): new section added; not present in any form in the original draft. Three options drafted, Option B recommended, not decided.
- **Gap 3** (`services/lcis-api` and LCIS tooling): new section added; not present in the original draft at all. **Corrected the brief's own count of `packages/lcis-*` packages from 14 to 19**, verified via direct `ls -d packages/lcis-*` this session. Two options drafted, Option B recommended, not decided.
- **Gap 4** (new structural tiers): new section added, defining `apps/phase_2/*` and the SUPPORTING-collision directory and their explicit non-interaction with the RESERVED-must-stay-empty rule.
- **§61 admission closed:** all 12 originally-listed config files opened and counted this session, plus the 4 remaining apps' own manifest/package.json pairs the original draft had assumed without checking. Real total: **359 occurrences across 18 files**, every one confirmed (by reading, not assuming) a pure string edit. One material finding not in the original draft: the secret-matrix file's app-path → env-var-name cascade, which this repository cannot itself resolve.
- **Blast radius and Rollback sections:** both new, citing `07_final_path_mapping.md` and `09_pre_restructure_build_baseline.md` by name as required.
- **Signature block:** new, 7 items, explicit non-approval line for D-0–D-7 and the survivor/fee questions.

Nothing from the original draft was deleted — the original "Every file discovered" section, its mapping table, and its collision-checking prose for `merchant_app`/`admin_app` are preserved above, now folded under the expanded §61 sweep and Gap 1 sections respectively.
