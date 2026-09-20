# 14 — Test, Build & Governance Baseline

> **Purpose.** Establish, with evidence, what was already failing **before** any change in this
> engagement, so that no later failure can be mistaken for a regression and no pre-existing
> failure can be silently attributed to this work.
>
> **Status of this document:** proven by execution. Every row below records a command that was
> actually run, its exit code, and its output location.
>
> **Authority:** subordinate to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root
> `AGENTS.md` → local `AGENTS.md`. This document is evidence, never law (`DOC-R2`).

---

## 1. Repository state at baseline

| Fact | Value | Evidence |
|---|---|---|
| Branch | `stepup/main` | `git rev-parse --abbrev-ref HEAD` |
| HEAD | `bf35062e` — *feat(demo): mount Turnstile so the form works in production* | `git rev-parse HEAD` |
| Staged files | **0** | `git diff --cached --name-status` → empty |
| Modified files (total) | **6 784** | `git status --porcelain \| awk '{print $1}' \| sort \| uniq -c` |
| — of which **mode-only** (`100644`→`100755`) | **6 063** | `git diff --numstat \| awk '$1==0 && $2==0' \| wc -l` |
| — of which **real content changes** | **721** | `git diff --numstat \| awk '$1!=0 \|\| $2!=0' \| wc -l` |
| Untracked files | **11** | `git ls-files --others --exclude-standard` |
| Local database | Supabase stack up 34 h, PostgreSQL **17.6** aarch64 | `docker ps`; `docker exec supabase_db_Letbuyy_Store psql -U postgres -d postgres -c "select version();"` |

### 1.1 User-owned work — DO NOT TOUCH

The entire working tree is **user-owned**. It was not created by this engagement and must not be
reverted, stashed, cleaned, or committed (`AGENT-R16`: *"MUST treat a dirty worktree as user-owned
and never revert changes you did not make"*).

The 721 content-changed files cluster in surfaces unrelated to the theme system:

- `apps/developer-portal/**` — portal shell, navigation, docs page, `globals.css` (+1 746 lines)
- `apps/marketing-site/**` — contact page, locale routing, brand assets
- `apps/merchant-control-plane/**` — dashboard client, `globals.css`, `AdminShell`, navigation, **`next.config.ts` (+48 lines)**
- `apps/mobile/merchant-app/**` — Android launcher assets
- binary asset churn across `public/` trees

Untracked files (11), verbatim:

```
apps/developer-portal/public/icons/letbuyy-logo-512.png
apps/developer-portal/public/icons/letbuyy-logo-dark.svg
apps/developer-portal/public/icons/letbuyy-logo-light.svg
apps/developer-portal/public/icons/letbuyy-mark.svg
apps/developer-portal/public/og/letbuyy-default.png
apps/developer-portal/src/components/PortalShell.tsx
apps/developer-portal/src/lib/navigation.ts
apps/merchant-control-plane/public/__g3.html
apps/merchant-control-plane/public/activation/choose-theme-left.png
apps/merchant-control-plane/public/activation/choose-theme-right.png
apps/storefront-runtime/src/lib/webpack/node-crypto-client-stub.ts
packages/typescript/ui/src/sidebar-navigation.stories.tsx
packages/typescript/ui/tests/components/navigation-linked-parent.test.tsx
supabase/.gitignore
supabase/config.toml
tools/central-intelligence/package-lock.json
```

Two of these are theme-relevant and are treated as **user-owned inputs**, not as this
engagement's output:

- `apps/storefront-runtime/src/lib/webpack/node-crypto-client-stub.ts` — the `node:crypto`
  client-bundle stub referenced by the previous session's handoff.
- `apps/merchant-control-plane/next.config.ts` (+48 lines, **modified not untracked**) — the module
  replacement that keeps `node:crypto` out of the client theme-editor bundle.

### 1.2 Stale worktrees (excluded from all searches)

`git worktree list` reports **12 prunable worktrees** rooted at a *different* absolute path
(`/Users/saai_sidd/Git/Letbuyy_Store/...`) than the live checkout
(`/Users/saai_siddharth/Projects/Start_Up/Letbuyy_Store`). Their directories nevertheless exist
under `.claude/worktrees/` and contain full copies of `database/supabase/migrations`,
`tests/migrations`, etc.

> **Search hygiene rule for this engagement:** every `rg`/`find` invocation must exclude
> `.claude/worktrees`, `node_modules`, `.next`, `dist`, `.turbo`, `graphify-out`, `build`.
> Failing to do so produces duplicate, stale hits that read as real findings.

---

## 2. The governance gate — and why the documented command was **not** run as-is

`CLAUDE.md` and `DOC-R5` require `node scripts/validate-governance.mjs` after topology, import,
package, environment, generated-artifact, or governance-memory changes.

**Reading the script before running it revealed a destructive side effect.**

`scripts/validate-governance.mjs:169-187` defines `removeGeneratedArtifactDirectories()`, which
walks `apps/`, `packages/`, `services/` and executes:

```js
fs.rmSync(absPath, { recursive: true, force: true });
```

for every directory named `node_modules`, `.next`, `.turbo`, `dist`, `.dart_tool`, `build`,
`coverage`, `.cache`, `.wrangler`, `.vercel`, `.symlinks`, `Pods`.

It is invoked at `scripts/validate-governance.mjs:190-192` immediately before
`stale-artifact-validator.mjs`, which **is** a member of the default `gate` lane
(`scripts/validate-governance.mjs:86`).

**Consequence:** running the documented command on a developer machine deletes every workspace
`node_modules` under `apps/`, `packages/`, and `services/`, requiring a full `pnpm install`
before anything can build again.

**Mitigation used here.** The 107 gate-lane validators were extracted from the script and executed
**individually**, with `stale-artifact-validator.mjs` excluded. This produces the identical
pass/fail signal for the other 107 validators with no filesystem destruction.

```bash
node -e 'const fs=require("fs");const src=fs.readFileSync("scripts/validate-governance.mjs","utf8");const m=src.match(/^const validators = \[([\s\S]*?)\];/m);console.log([...m[1].matchAll(/"([^"]+\.mjs)"/g)].map(x=>x[1]).filter(v=>v!=="stale-artifact-validator.mjs").join("\n"))' > validator-list.txt
while read -r v; do node "scripts/validators/$v" > "logs/$v.log" 2>&1; echo "$? $v"; done < validator-list.txt
```

> **Follow-up recorded in `25-follow-up-backlog.md`:** the gate lane silently destroying developer
> `node_modules` is a defect in the gate, not in this engagement. Fixing it is out of scope here
> because `scripts/validate-governance.mjs` is governance tooling (`ARCH-R4` / `AGENT-R4` territory)
> and the change is not required to complete the theme system.

---

## 3. Governance baseline — the numbers

Two runs, one command set, two trees:

| Tree | Validators run | Pass | **Fail** |
|---|---|---|---|
| **Clean `HEAD` (`bf35062e`)** — detached worktree, no user edits | 107 | 85 | **22** |
| **Working tree** (with the user's 721 content changes + 11 untracked) | 107 | 83 | **24** |

The clean-HEAD tree was produced non-destructively with
`git worktree add --detach <scratchpad>/head-wt HEAD` plus a symlink to the root `node_modules`.
No repository file was modified to obtain this measurement.

### 3.1 The 22 failures that pre-exist at `HEAD`

These fail on the committed codebase with **zero** working-tree changes. None is attributable to
this engagement.

| # | Validator | Head-line failure |
|---|---|---|
| 1 | `tenant-isolation-validator` | `services/api-gateway/src/tenant/tenant-tables.registry.ts` does not match the schema-derived registry (**tenant-table registry drift** — the handoff named this one) |
| 2 | `validate-design-system` | 1 HARD invariant violation; ratchet metrics show 98 raw hex, 849 naked `rgb()/hsl()`, 604 raw-px font sizes, 1 568 raw-px spacing, 387 arbitrary radii |
| 3 | `package-ownership-validator` | `packages/lcis-adapters`, `packages/lcis-business` lack `AGENTS.md` |
| 4 | `dependency-manifest-validator` | undeclared imports incl. **`packages/theme-engine/src/theme-safe-update.ts` imports `${fromVersion}`** (a template literal mis-parsed as a module specifier) |
| 5 | `undeclared-import-validator` | same finding as #4 |
| 6 | `provider-isolation-validator` | `packages/lcis-adapters/**` call provider URLs directly instead of via `packages/infrastructure` |
| 7 | `typescript-governance-validator` | `packages/lcis-adapters/tsconfig.json` lacks declaration maps; not referenced by `tsconfig.workspace.json` |
| 8 | `custom-domain-target-validator` | merchant UI must read the public target env |
| 9 | `merchant-domains-settings-validator` | domains settings page missing `NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET` and `apexMxWarning` |
| 10 | `platform-domain-literal-validator` | 5 functional `letbuyy.store` literals in `apps/identity-platform` (`DEPLOY-R3`) |
| 11 | `route-ownership-validator` | `custom-domains.ts:GET:/domains:483` — tenant-table handler with no ownership/internal/session gate |
| 12 | `legacy-site-type-validator` | marketing create page advertises legacy portfolio/resume outside the flag |
| 13 | `domain-boundary-validator` | **`services/api-gateway/src/schemas/theme.schema.ts` defines domain contracts locally** (facade must not); `apps/marketing-site/src/app/api/founding-pricing/route.ts` unclassified |
| 14 | `route-line-count-validator` | **`services/api-gateway/src/routes/themes.ts` has 1 870 lines; limit is 1 500** |
| 15 | `single-source-crypto-validator` | **`services/api-gateway/src/routes/themes/theme-update-route.ts` declares local crypto helpers** instead of importing shared ones |
| 16 | `cms-slugify-validator` | merchant-control-plane smart-collections page declares a local slugify |
| 17 | `date-format-validator` | 3 surfaces declare local `formatDate` instead of `@letbuyy/ui/formatting` |
| 18 | `api-client-runtime-base-validator` | `apps/marketing-site/src/app/create/page.tsx` must use the shared API base resolver |
| 19 | `marketing-dead-twin-validator` | marketing homepage must keep using the live `Header`/`Hero` |
| 20 | `raw-error-message-validator` | `services/api-gateway/src/routes/resource-search.ts` returns raw `error.message` for `SEARCH_ERROR` |
| 21 | `environment-validator` | **secret-like values in tracked `packages/theme-engine/test/dynamic-source-binding.test.ts` and `packages/theme-engine/test/theme-engine.test.ts`** |
| 22 | `prompt-perimeter-validator` | 3 prompt-class files under `V1_SCOPE_LOCK_2026_06_12/LIQUID_MIGRATION/` unregistered in `PROMPTS.md` |

### 3.2 The 2 additional failures introduced by the **user's** uncommitted work

Computed as the set difference (fails in working tree, passes at `HEAD`):

| Validator | Failure | Cause | Ownership |
|---|---|---|---|
| `migration-safety-validator` | *"Root `supabase/config.toml` is retired; archive duplicate configs under `docs/archive` instead"* | the **untracked** `supabase/config.toml` | **user-owned** — not modified by this engagement |
| `tooling-governance-validator` | *"Unexpected root script file: `scripts/.DS_Store`"* | a macOS Finder artifact | **user-owned** — not modified by this engagement |

### 3.3 Correction to the inherited handoff

> The previous session reported **"two governance failures pre-existing: tenant-table registry
> drift; untracked root `supabase/config.toml`."**

That is **incomplete**. Measured against clean `HEAD`, the true pre-existing count is **22**.
Tenant-table registry drift is one of them (#1). The untracked `supabase/config.toml` is *not* a
`HEAD` failure at all — it is one of the two working-tree-only failures (§3.2), caused by an
untracked user file.

Every claim in the inherited handoff is treated the same way in this engagement: as a **lead to
reproduce**, never as established fact.

---

## 4. Theme-scoped subset of the pre-existing failures

Five of the 22 `HEAD` failures sit inside the theme system and are therefore in scope for safe,
reversible repair during implementation:

| Validator | Theme artifact | Class |
|---|---|---|
| `dependency-manifest-validator` / `undeclared-import-validator` | `packages/theme-engine/src/theme-safe-update.ts` — `${fromVersion}` parsed as an import specifier | validator false-positive **or** a genuinely malformed dynamic import; must be determined from source |
| `domain-boundary-validator` | `services/api-gateway/src/schemas/theme.schema.ts` defines domain contracts locally | `CODE-R1` — contracts belong in the domain package |
| `route-line-count-validator` | `services/api-gateway/src/routes/themes.ts` = 1 870 lines (limit 1 500) | structural; split into route modules |
| `single-source-crypto-validator` | `services/api-gateway/src/routes/themes/theme-update-route.ts` declares local crypto helpers | `SEC` / single-source-crypto |
| `environment-validator` | secret-shaped literals in two tracked `packages/theme-engine/test/*.test.ts` files | `SEC-R2` / `R-21` |

The remaining 17 belong to `lcis-*`, marketing-site, identity-platform, custom-domains, and
design-system surfaces that are **outside this engagement's scope**. They are recorded here so
they are not mistaken for regressions, and carried to `25-follow-up-backlog.md`.

---

## 5. Theme-relevant validators that **pass** at baseline

Recorded because they are the invariants this engagement must not break:

| Validator | Result | Reported detail |
|---|---|---|
| `theme-governance-validator` | **PASS** | *"25 built-in section schemas, WARN mode, **Liquid default OFF**, fallback placeholder, schema migration runner"* |
| `no-public-using-true-validator` | PASS | no `USING(true)` policy granted to PUBLIC |
| `rls-force-coverage-validator` | PASS | RLS `FORCE` coverage satisfied |
| `no-new-react-sections-validator` | PASS | `ART-17` / `THEME-R2` freeze holds |
| `canonical-ledger-only-validator` | PASS | no direct money-table writes in TS |
| `identity-sole-issuer-validator` | PASS | `ART-05` holds |
| `no-blanket-service-role-validator` | PASS | `ART-08` / `SEC-R9` holds |
| `stepup-crypto-validator` | PASS | `PAY-R7` real-crypto step-up holds |
| `sequential-migration-validator` | PASS | migration numbering intact |
| `rollback-integrity-validator` | PASS | rollback pairing satisfied for the checked range |
| `theme-editor-dead-shell-validator` | PASS | editor shell is live, not a dead twin |

> `theme-governance-validator`'s own output is the authoritative, machine-checked statement that
> **the Liquid default is OFF**. Any later claim that Liquid is on platform-wide must be reconciled
> against this line.

---

## 6. Commands run for this baseline

| # | Command | Purpose | Exit | Notes |
|---|---|---|---|---|
| 1 | `git rev-parse --abbrev-ref HEAD` / `git rev-parse HEAD` | branch + HEAD | 0 | `stepup/main` @ `bf35062e` |
| 2 | `git status --porcelain`, `git diff --numstat`, `git ls-files --others --exclude-standard` | working-tree classification | 0 | 6 784 M / 721 real / 11 `??` |
| 3 | `git worktree list` | worktree inventory | 0 | 12 prunable stale worktrees |
| 4 | `docker ps` | local service availability | 0 | Supabase stack healthy, up 34 h |
| 5 | `docker exec supabase_db_Letbuyy_Store psql -U postgres -d postgres -c "select version();"` | DB reachability | 0 | PostgreSQL 17.6 |
| 6 | `git worktree add --detach <scratchpad>/head-wt HEAD` | clean-HEAD comparison tree | 0 | additive only; removed after use |
| 7 | 107 × `node scripts/validators/<name>.mjs` (working tree) | governance baseline | 24 non-zero | `stale-artifact-validator` excluded |
| 8 | 107 × `node scripts/validators/<name>.mjs` (clean HEAD) | pre-existing baseline | 22 non-zero | same exclusion |
| 9 | `git diff --numstat -- <3 failing files>` | attribution | 0 | all three are `0 0` (mode-only) ⇒ content identical to `HEAD` |

**Not run, and why:**

| Command | Reason |
|---|---|
| `node scripts/validate-governance.mjs` (as documented) | destroys workspace `node_modules` (§2). Equivalent signal obtained by running the 107 validators individually. |
| `pnpm --filter … build` | deferred to the post-implementation verification pass (`21-final-test-evidence.md`); running it at baseline would only re-measure `HEAD`. |
| Playwright E2E | deferred to the verification pass; requires running applications. |

---

## 7. Attribution rule for the rest of this engagement

Any validator, test, or build failure observed later is classified as:

- **PRE-EXISTING** — appears in §3.1 (22 at `HEAD`) or §3.2 (2 user-owned), **or**
- **USER-OWNED** — traceable to one of the 721 modified / 11 untracked files listed in §1.1, **or**
- **INTRODUCED** — anything else. Introduced failures are this engagement's responsibility and are
  either fixed or reported openly in `21-final-test-evidence.md`. None is hidden, and no test is
  weakened to make it pass (`Work discipline`).
