# 00b — Constitutional Amendment Draft: Six-App Topology

**Status: DRAFT ONLY. Not applied. No directory was created, renamed, or moved to produce this document.** This is the document the owner asked Phase 0 to prepare so the Constitution can be amended *before* any rename happens — per the brief's explicit stop condition, doing the rename first would put the governance gate into a permanent red state.

## What is closed vs. what remains open

**Closed (owner decision, not relitigated here):** the final application structure is six runtimes — `apps/customer_app`, `apps/customer_web`, `apps/merchant_app`, `apps/merchant_web`, `apps/admin_app`, `apps/admin_web`.

**Open, and not decided by this document:** which existing codebase becomes each of the six (see doc 04's survivor scorecard for evidence, not a verdict); founder decision D-0 (canonical backend); the actual timing/sequencing of the rename.

## Current constitutional topology (as written today)

The Constitution fixes exactly 8 named active runtimes (`services/api-gateway`, `services/queue-workers`, `services/mobile-bff`, `apps/identity-platform`, `services/webhook-service`, `apps/storefront-runtime`, `apps/merchant-control-plane`, `apps/marketing-site`), 2 supporting non-extractable apps (`apps/mobile/merchant-app`, `apps/platform-console`), 8 RESERVED manifest-only placeholders, and a Deprecated Runtime Policy that explicitly forbids `apps/admin` and `apps/merchant` as active topology. This is mirrored in code, not just prose: `scripts/validators/governance-common.mjs` (read directly, lines 57–116) defines these as exported arrays —

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

## The mapping this amendment must define

| Owner's six-app name | Maps onto (candidate, per doc 04 — not decided here) | Current constitutional class of that candidate | Collides with an existing deprecated-alias string? |
|---|---|---|---|
| `apps/customer_app` | System A `apps/marketplace` (only confirmed production identity) or a new mobile root | Not currently in any Constitution list (System A is outside System C's topology entirely) | No |
| `apps/customer_web` | `apps/storefront-runtime` (rename) | `canonicalAppRoots` | No |
| `apps/merchant_app` | `apps/mobile/merchant-app` (rename, drop the `mobile/` nesting) | `canonicalAppRoots` (also referenced as `apps/mobile/merchant-app` specifically, not just via the array, in `mobile-topology-honesty-validator.mjs:14`) | **No exact-string collision** — `deprecatedAppAliasRoots` contains `"apps/merchant"`, not `"apps/merchant_app"`. Checked whether any validator does an unsafe raw `.startsWith("apps/merchant")` that `"apps/merchant_app/…"` would false-trip: none found (see below) — the shared helper `startsWithPrefix()` in `governance-common.mjs:203` is boundary-safe (`file === prefix \|\| file.startsWith(prefix + "/")`), so `"apps/merchant_app"` does **not** match prefix `"apps/merchant"` through it. This must stay true after the rename — worth a regression test, not just a one-time check. |
| `apps/merchant_web` | `apps/merchant-control-plane` (rename) | `canonicalAppRoots` | No |
| `apps/admin_app` | System A `apps/admin` or System B `apps/admin_app` (already named this in System B, coincidentally) | Not in any Constitution list currently (`apps/mobile/operator-app` is the closest RESERVED equivalent, but that's a different concept — platform-operator mobile, currently empty) | Same reasoning as `merchant_app` above — no exact match against `deprecatedAppAliasRoots`'s `"apps/admin"`, boundary-safe helper confirmed not to false-positive |
| `apps/admin_web` | `apps/platform-console` (rename) | `canonicalAppRoots` | No |

**The real risk is not a validator false-positive today — it's human and prose ambiguity.** CLAUDE.md's Deprecated Runtime Policy prose says "Do not recreate or reference deprecated app aliases as active topology: `apps/admin`, ... `apps/merchant`" without the qualifier "as an exact path, not a prefix." A future contributor (or a future validator author) reading that prose, not the code, could reasonably treat `apps/admin_app` and `apps/admin` as "the same forbidden thing" and block or revert the rename. **The amendment must add an explicit sentence stating that `apps/admin_app`/`apps/merchant_app` are the approved six-app-model names and are not instances of the deprecated `apps/admin`/`apps/merchant` aliases**, so this ambiguity cannot recur.

## Every file discovered that hardcodes a current runtime name (found, not guessed)

### Central source-of-truth (highest leverage — one edit, cascades to 105 dependent files)

- **`scripts/validators/governance-common.mjs`** — defines `canonicalAppRoots`, `frozenAppRoots`, `reservedMobileRuntimeRoots`, `deprecatedAppAliasRoots`, `forbiddenRuntimeRoots`, `forbiddenRuntimeSubtrees`, `canonicalServiceRoots`, `reservedServiceRoots`, `canonicalRuntimeRoots` (lines 57–116, quoted above in full). `grep -rl governance-common scripts/validators/*.mjs` found **105 of the 115 files in `scripts/validators/` import from this module.** Amending the arrays here is necessary and, for any validator that only *references the exported array* (not a separate hardcoded literal), sufficient.

### Validators confirmed to ALSO hardcode a runtime name directly, beyond the import (found by direct read, not assumed)

- **`scripts/validators/mobile-topology-honesty-validator.mjs:14`** — `reporter.assert(canonicalAppRoots.includes("apps/mobile/merchant-app"), …)` — a literal string assertion, independent of whatever the array itself contains. Amending `governance-common.mjs` alone does **not** fix this line; it must be edited by hand to the new name.
- Nine more validators reference `apps/mobile/merchant-app` / `apps/mobile/shopper-app` / `apps/mobile/operator-app` directly (confirmed via `grep -l`, not yet individually read line-by-line — flagged for Phase 1, not exhaustively verified here): `beta-readiness-validator.mjs`, `ci-simulation-validator.mjs`, `custom-domain-target-validator.mjs`, `dart-dead-source-validator.mjs`, `domain-boundary-validator.mjs`, `environment-validator.mjs`, `provider-mode-badge-validator.mjs`, `token-source-single-validator.mjs`, plus `governance-common.mjs` itself.

**Honest limit:** I confirmed by direct read that at least one validator (`mobile-topology-honesty-validator.mjs`) has its own literal beyond the shared array. I did **not** individually read all 105 files that import `governance-common.mjs` to check each for a similar independent literal — that is a Phase 1 sweep (`grep -n '"apps/' scripts/validators/*.mjs` per candidate name, then hand-review each hit), not something this inventory phase completed.

### Non-validator config files that hardcode current runtime names (found via `grep -rl`, not yet individually opened for this document)

```
config/vercel/projects.json
config/runtime/deployment-topology.json
config/runtime/production-topology.json
config/env/staging-production-secret-matrix.json
config/env/ownership/runtime-env-ownership.json
config/governance/web-v1-scope-registry.json
config/eslint/boundary-baseline.json
.github/workflows/mobile-merchant-release.yml
.github/workflows/ci.yml
apps/mobile/merchant-app/runtime.manifest.json
apps/merchant-control-plane/runtime.manifest.json
apps/merchant-control-plane/package.json
```

Every app being renamed also carries its own `package.json` `"name"` field (e.g. `@letbuyy/merchant-control-plane`) and `runtime.manifest.json` — both would need updating for every one of the 6 apps being renamed, not just the two listed above (those two were confirmed present; the others were not individually re-verified for this list but follow the same pattern established by every other `apps/*` directory inventoried in doc 01).

## Amendment text (draft, for the owner to approve or edit — not yet applied to the Constitution)

> **Amendment — Six-App Topology (proposed, pending ARB/owner approval).**
> The canonical application topology is renamed from its current 8-runtime-plus-2-supporting-app form to six product-facing application roots: `apps/customer_app`, `apps/customer_web`, `apps/merchant_app`, `apps/merchant_web`, `apps/admin_app`, `apps/admin_web`. This amendment supersedes the specific path names in the Canonical Runtime Map and Deprecated Runtime Policy sections wherever they conflict, but does **not** change the underlying design law (modular monolith, `site_id` tenancy, zero-fee ledger, RLS+FORCE RLS backstop, sole-issuer identity target) — only the application-layer naming and grouping. `apps/admin_app` and `apps/merchant_app` are declared **approved six-app-model names, not instances of the deprecated `apps/admin`/`apps/merchant` aliases** — the Deprecated Runtime Policy's prohibition on those two aliases refers only to the exact historical paths, never re-created under those exact names. Every validator and config file enumerated in `docs/migration/repository_consolidation/00b_topology_amendment_draft.md` must be updated in the same change series that performs the rename; the rename must not land before `scripts/validators/governance-common.mjs`'s canonical arrays are updated, or the governance gate will fail on the very next run.

This text is a draft for the owner's edit, not a ratified amendment — no Constitution file was modified in this phase.
