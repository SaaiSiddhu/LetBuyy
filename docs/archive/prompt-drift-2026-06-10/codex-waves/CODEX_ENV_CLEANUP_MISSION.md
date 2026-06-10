# CODEX ENV CLEANUP MISSION — Remove Local Dev (Staging + Production Only)

**Driver:** Codex agent. Reasoning: `xhigh` for wrangler/CI rewiring, `medium` for deletions/repoints.
**Mode:** Continuous, autonomous, 24h+. Never stop while unblocked work remains.
**Source of truth:** `LETBUYY_STAGING_PRODUCTION_ONLY_PLAN.md` (the full inventory + target model). This mission executes it.
**Governance posture:** KEEP ALL 128 VALIDATORS GREEN, typecheck/lint/build green, at every commit. Human‑gated (filling secret stores, first staging deploy) → `[SKIP — NEEDS HUMAN]` and continue.

---

## 0. PRIME DIRECTIVE
Eliminate the local‑dev environment entirely and standardize on **two environments only — `staging` and `production`** — with **all testing on staging**. Delete every local artifact, collapse the deployed `dev` env into `staging`, repoint all `localhost` defaults to staging, convert the local seeder into a staging seeder, rewire CI to build→deploy→test on staging, and patch the missions' REAL‑E2E clause from `federation:local:up` to staging. **No feature changes** — this is config/infra hygiene.

**SUCCESS CRITERIA (proven):**
1. Zero `.env.local`, `.dev.vars`, `.dart-defines.local`, `dart-defines/local.json`, or `config/env/templates/local.env.example` remain.
2. No `local:*` / `federation:local*` / `dev` stack scripts in `package.json`; `scripts/dev/` and `infrastructure/scripts/local/` removed; a `scripts/staging/seed.mjs` exists (converted from the local seeder).
3. Wrangler has only `[env.staging]` + `[env.production]` (no `[env.dev]`, no `api-dev`/`cdn-dev`, no `localhost`/`letbuyy-local-storage` defaults).
4. No `localhost`/`:54321`/`:8787` fallback defaults remain in app/service **source**; defaults point to staging.
5. CI builds → deploys to **staging** → runs tests/E2E against staging; no `federation:local`/`localhost` in workflows.
6. Mission docs' REAL‑E2E clause references **staging**, not local.
7. `pnpm turbo typecheck`, `pnpm lint`, `pnpm turbo build`, `pnpm run validate:governance` (128/128) all green. `CODEX_ENV_CLEANUP_LEDGER.md` complete; human‑gated secret/deploy items in the SKIP list.

## 1. OPERATING CONTRACT
1. Continuous; ledger → next task. 2. **Green Law:** typecheck/lint/build/governance green after every commit; 3 strikes → revert + BLOCKED → next. 3. **Safe‑deletion:** before deleting any file, `grep` for live references (scripts that read it, imports); if referenced, repoint the reference first; then `git rm`; keep the build green. Log every deletion in `DELETED`. 4. **No secrets in repo:** never inline a real secret; staging/prod values live in platform stores → `[SKIP — NEEDS HUMAN]`. 5. **Don't break prod/staging config:** only remove `dev`/local; never touch the `[env.production]`/`[env.staging]` blocks except to add a staging fallback where a localhost default was removed. 6. Small reversible commits; no fabrication.

## 2. ARCHITECTURE INVARIANTS — DO NOT TOUCH
`[env.staging]` / `[env.production]` wrangler blocks (except removing localhost defaults) · `database/**` migrations/`000_baseline.sql` (the *baseline* stays; only the local *runner* goes) · `packages/*-core/**`, `shared-types`, governance validators (read‑only) · any application business logic. This mission edits **config, scripts, env files, CI, wrangler, and default URLs only.**

## 3. THE WORK — E0 → E6
- **E0 Baseline.** `CODEX_ENV_CLEANUP_LEDGER.md`; record green baseline (typecheck/lint/build/governance); confirm the §1 inventory in the plan. **Effort:** S. **Priority:** P0.
- **E1 Delete local env files.** Remove the 10 `.env.local`, 4 Flutter local dart‑defines, 8 `.dev.vars`, and `config/env/templates/local.env.example`. Confirm no script reads them first. **Effort:** S. **Priority:** P0. _DoD: none remain; build green._
- **E2 Scripts.** Remove `dev`, `local:*`, `federation:local:*` from `package.json`; delete `scripts/dev/**` + `infrastructure/scripts/local/**`; **convert** `seed-local-data.mjs` → `scripts/staging/seed.mjs` (targets the staging Supabase via env, not localhost). **Effort:** M. **Priority:** P0. _DoD: no local scripts; staging seeder exists._
- **E3 Wrangler collapse.** In api‑gateway / queue‑workers / webhook‑service: delete `[env.dev]*` blocks, `api-dev`/`cdn-dev` routes, and replace base `localhost`/`letbuyy-local-storage` defaults with staging values. Keep staging + production only. **Effort:** M. **Priority:** P0. _DoD: only 2 envs; `validate:cloudflare` green._
- **E4 Source defaults → staging.** Replace every `localhost:*` default/fallback in `apps/*/src/**` and `services/*/src/**` (api clients, `config/urls.ts`, `proxy.ts`, `next.config.ts`, seo/robots, theme‑editor) with the staging URL; keep env‑driven overrides. **Effort:** M. **Priority:** P0. _DoD: no localhost defaults in source; typecheck/build green._
- **E5 CI → staging.** Rewire `.github/workflows/*` so CI builds → deploys to **staging** → runs Playwright/J1‑J5 against `*.staging.letbuyy.store`; remove `federation:local`/`localhost` steps; add per‑PR preview deploy if feasible. Update `.gitignore`/READMEs (replace "run locally" with "deploy to staging"). Real CI secrets → `[SKIP — NEEDS HUMAN]`. **Effort:** M. **Priority:** P1. _DoD: workflows reference staging only._
- **E6 Patch mission docs.** Update the REAL‑E2E clause in `CODEX_*_MISSION.md` (production hardening, federation, mobile parity, master sequential, etc.) from `federation:local:up`/local to **staging** per the plan §5. **Effort:** S. **Priority:** P1. _DoD: no mission says "local stack" as the proof; staging is the proof._
- **GATE (FINAL):** zero local surface remains; staging+production only; typecheck/lint/build/governance 128/128 green; `CODEX_ENV_CLEANUP_STATUS.md` written with the SKIP list (secret stores + first staging deploy are the only human‑gated items).

## 4. LEDGER — `CODEX_ENV_CLEANUP_LEDGER.md`
```
# ENV CLEANUP LEDGER — started <ts>
## DELETED (append-only): <ts> <file> — confirmed no live ref — git rm — build green
## PROGRESS / SKIPPED — NEEDS HUMAN (secret stores, staging deploy) / VALIDATOR (128/128) ledgers
```

## 5. LAUNCH PROMPT
```
Read docs/Codex_waves/CODEX_ENV_CLEANUP_MISSION.md and LETBUYY_STAGING_PRODUCTION_ONLY_PLAN.md in full,
then execute E0→E6 continuously and autonomously, 24h+.

Goal: remove the local-dev environment entirely; standardize on staging + production ONLY; all testing on staging.
Delete every .env.local / .dev.vars / .dart-defines.local / local.env.example; remove local:*/federation:local/dev
scripts + scripts/dev + infrastructure/scripts/local (convert the seeder to scripts/staging/seed.mjs); collapse wrangler
to [env.staging]+[env.production] only (drop env.dev, api-dev/cdn-dev, localhost defaults); repoint all localhost source
defaults to staging; rewire CI to build→deploy→test on staging; patch the missions' REAL-E2E clause from local to staging.

Hard rules: NO feature/business-logic changes; never inline real secrets (platform stores only → [SKIP — NEEDS HUMAN]);
never touch [env.production]/[env.staging] except removing localhost defaults; safe-deletion (confirm no live ref →
repoint → git rm → build green); keep typecheck/lint/build and all 128 validators green per commit; small reversible
commits; 3 strikes → BLOCKED → next; no fabrication. Maintain CODEX_ENV_CLEANUP_LEDGER.md. Begin with E0 now.
```

## 6. NORTH STAR
Two environments, zero localhost — staging is dev+test, production is merchants — with no local secrets or emulators anywhere in the tree.
