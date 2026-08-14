# 16 — Implementation Plan (as executed)

> **Status:** this is the plan that was actually followed, not a proposal. It records the scope
> decision, the authorization boundary, the file-ownership model, and the verification strategy.
> Outcomes are in [19-implementation-change-log.md](19-implementation-change-log.md) and
> [21-final-test-evidence.md](21-final-test-evidence.md).
>
> **Date:** 2026-08-04 → 2026-08-05.

---

## 1. The scope decision

Discovery produced **99 deduplicated defects (23 P0 / 45 P1 / 31 P2)** — see
[15-gap-register-and-priorities.md](15-gap-register-and-priorities.md). Most of the P0s sit **outside**
the theme layer and are high-stakes under the engagement's own rules (money · auth · RLS · GST ·
sanitizer · public contract · production migration), so they required an explicit authorization decision
rather than an engineering one.

**Authorized for fix in this engagement — tenant isolation only:**

| # | Defect | Register IDs |
|---|---|---|
| 1 | Cross-tenant storefront handle leak (`subdomain OR store_name` → arbitrary tenant) | TEN-01 |
| 2 | `public.themes` `USING(true)` policy to PUBLIC, now covering site-private themes | TEN-06 |
| 3 | RLS `FORCE` missing on 24 of 32 theme tables | TEN-07 |
| 4 | Storefront access gate bypassed on `vercel.app` hosts | TEN-11 |
| 5 | Proxy fails **open** when store-access resolution is unavailable | TEN-12 |

**Explicitly NOT authorized — documented, escalated, untouched:**

- Theme-lifecycle P0s (`GET /themes/:slug/editor` mutating `theme_instances`; unauthenticated
  `GET /themes/:slug/schema` performing registry writes; non-transactional `installTheme`; the three
  disagreeing active-theme stores).
- Shopper-auth P0s (Liquid no-JS login/register always 403 for want of a Turnstile widget; unthrottled
  brute-force on `POST /api/orders/login`; two incompatible HS256 token shapes under one cookie).
- Checkout/payment/GST P0s (unsigned public order-create bypassing the built-but-orphaned ART-14 signed
  handoff; pre-payment inventory hard-decrement never released; GST computed to zero; GST invoices never
  issued; COD never ledgered at confirm).

Each of those is a decision-ready docket item in
[17-open-decisions-and-arb-gates.md](17-open-decisions-and-arb-gates.md).

**Ordering:** security first, then the mission work on `letbuyy-core` and the presets. There is no value
in perfecting a theme that can serve one tenant's data under another tenant's handle.

---

## 2. Unconditionally safe work (no authorization needed)

Completion of the canonical winner is the encouraged default (`WIN-R6`, `AGENT-R2`, `PRIME-R3`):

| Track | Work |
|---|---|
| **letbuyy-core exists** | A migration making the canonical theme a real first-class row on any database — migration 188 is a knowing no-op on fresh DBs |
| **Bundle completion** | The 4 missing templates, the 2 missing sections that break every experience composition, layout/a11y hardening, `--lb-*` tokens, mobile-first CSS |
| **Branding** | `compilePortableToLiquidBundle` basing every compiled storefront on the Urban Kicks demo fixture |
| **Preset engine** | The 10 experiences validate but 0/10 apply their section compositions |
| **Governance hygiene** | The five theme-scoped failures among the 22 pre-existing HEAD failures |
| **Tests** | Regression coverage for every fix, plus the mandatory two-site isolation proof |

---

## 3. The constraint model

### 3.1 User-owned work — never touched

The working tree is **user-owned**: 6 784 modified files (6 063 mode-only `chmod`), 721 real content
changes, 11 untracked. Every agent carried an explicit never-touch list, and integrity was re-verified
by numstat after every round:

| File | Expected diff | Why |
|---|---|---|
| `services/api-gateway/src/execution/theme-execution.adapter.ts` | **166/81** | Uncommitted package-provisioning + scaffold-cleanup work |
| `apps/merchant-control-plane/next.config.ts` | **48/1** | Uncommitted `node:crypto` / `jsdom` client-bundle fix |
| `apps/storefront-runtime/next.config.ts` | **26/1** | Same fix, storefront side |
| `apps/storefront-runtime/src/lib/webpack/node-crypto-client-stub.ts` | untracked | Referenced only by the uncommitted config |
| `packages/typescript/ui/src/tokens.ts` | **9/0** | Sidebar token work — **also a FROZEN path** |
| `supabase/config.toml`, `scripts/.DS_Store` | untracked | Cause the 2 working-tree-only governance failures |

> Two review rounds flagged `tokens.ts` (frozen, 9/0) and the `packages/typescript/ui` test files as
> possible agent damage. Both were resolved as **user-owned**: all are timestamped 22:02, before any
> agent ran, and appear in the Phase 0 untracked inventory.

### 3.2 Frozen paths

`packages/theme-engine/src/theme-registry.ts` and `packages/typescript/ui/src/tokens.ts` require a
`FROZEN-OVERRIDE: <human>` commit trailer (`scripts/validators/frozen-path-override-gate.mjs`). Neither
was edited. This is why the `THEME_SETTINGS_SCHEMA` divergence documented in
[09-settings-schema-and-editor.md](09-settings-schema-and-editor.md) was **not** fixed by editing the
frozen schema — that is an ARB gate.

### 3.3 Disjoint file ownership

Every implementation agent received an exclusive file list. Work that needed a file outside that list was
reported as `needsOtherFiles` rather than performed. This is what allowed parallel agents to run without
overwriting each other, and it caught two agents that would otherwise have silently reached into
`packages/theme-engine` while another workstream owned it.

**Sequential where the file is shared.** `packages/theme-engine/src/theme-bundle.ts` is a single
3 317-line fixture from which both example bundles are generated. Bundle work therefore ran as a
*sequential chain* (sections → templates → layout), never in parallel.

### 3.4 Two operational hazards discovered and worked around

1. **The governance gate destroys developer dependencies.**
   `scripts/validate-governance.mjs:169-192` `rm -rf`s every `node_modules`, `.next`, `dist`, `.turbo`,
   `build`, `coverage`, `.cache`, `.wrangler`, `.vercel` under `apps/`, `packages/`, `services/`, and
   `stale-artifact-validator.mjs` is a gate-lane member (line 86). The 107 validators were therefore run
   **individually**, excluding that one. (An agent did run the wrapper once; `node_modules` survived only
   because the script `process.exit`s at validator #2 and never reached the deletion.)
2. **The gate stops at the first failure.** Because it exits on the first non-zero validator, any
   "N pre-existing failures" claim derived from running it is systematically wrong. This is precisely how
   the inherited handoff arrived at "2" when the true clean-HEAD count is **22**.

---

## 4. Execution model

Discovery → documentation → implementation, each as a fan-out of specialized agents with an
**adversarial reviewer** at the end of every implementation round. The reviewer owns no files, is
read-only, is not shown the implementers' reports, and is instructed that *"implementation reports are
not evidence; only code and command output are."*

That loop is the single most valuable part of this plan. It caught, across three security rounds:

| Round | Verdict | What the reviewer caught that the implementers reported as done |
|---|---|---|
| 1 | **FAIL** | Access gate closed for `vercel.app` only; `theme.schema.ts` had **zero** content change; a **fourth** ambiguous resolver; new migrations untracked (a *new* gate failure) |
| 2 | **FAIL** | The gate still bypassable via the sibling `/preview` surface; `theme.schema.ts` still untouched; the only new "test" was `test('probe', () => assert.ok(true))` |
| 3 | **PASS_WITH_ISSUES** | Preview bypass genuinely closed (full attack matrix walked); residual findings all pre-existing and out of scope |

Reviewers were additionally required to **verify existence before quality** after one round reported four
new templates and two new sections while every file showed a `0/0` diff.

---

## 5. Verification strategy

| Layer | Method |
|---|---|
| **Governance** | All 107 validators run individually, twice: once against a clean-`HEAD` detached worktree and once against the working tree, so every failure is attributable |
| **Types** | `pnpm --filter <pkg> typecheck` across all five affected workspaces |
| **Builds** | Real `pnpm --filter <pkg> build` — `CLAUDE.md` warns the validator gate does **not** cover `next build` |
| **Database** | Full reset: `public` dropped, all 124 migrations replayed from zero, seeds applied — this is what proved the fresh-DB `letbuyy-core` defect |
| **Migrations** | Each new migration applied, applied **again** (idempotency), rolled back, verified reversed, re-applied |
| **Tenancy** | Two-site isolation with a TEST-R4 **positive control ordered first**, so an empty database cannot green the suite |
| **Regression** | Each security test carries a *control* asserting the removed predicate would have selected the wrong tenant — the test fails if the fix is reverted |

### 5.1 Known pre-existing failures, fixed as a baseline before work began

- **22** validator failures at clean `HEAD` (24 in the working tree; the 2 extra are user-owned artifacts).
- **4** `@letbuyy/theme-engine` test failures: `liquid-l3-compiler`, `l5-product`, `l6-collection`,
  `l7-search` — 1 726 tests, 1 722 pass. Proven pre-existing: all four import only `../src/index.ts` and
  contain zero references to any changed module. They demonstrate that the canonical Liquid renderer
  **cannot bind commerce data into product/collection/search loops** — a P0 for the Liquid strategy that
  is out of scope here and recorded in [17-open-decisions-and-arb-gates.md](17-open-decisions-and-arb-gates.md).

Every later result is classified against those baselines as **PRE-EXISTING**, **USER-OWNED**, or
**INTRODUCED**. Nothing is hidden and no test was weakened to pass.

---

## 6. What this plan deliberately does not do

- **Does not flip the Liquid default.** `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` stays `false`, and
  migration 197 deliberately does **not** set `default_template.rendererEngine = 'liquid'` on the
  canonical row — that single key short-circuits the default-off constant
  (`theme-governance.ts:154-160`) and would silently move every store installing the canonical theme onto
  Liquid while the parity harness is unwired and the React fallback is broken for 22 sections.
- **Does not delete the React renderer** (ART-17 forbids it until the data decision).
- **Does not add React section components** (`THEME-R2`; `no-new-react-sections-validator` stays green).
- **Does not touch money RPCs, payment code, auth issuers, step-up, or sanitizer `FORBID` lists.**
- **Does not commit, push, merge or deploy.** New SQL files were made visible to
  `sequential-migration-validator` with `git add -N` (intent-to-add) — path recorded, no content staged.
