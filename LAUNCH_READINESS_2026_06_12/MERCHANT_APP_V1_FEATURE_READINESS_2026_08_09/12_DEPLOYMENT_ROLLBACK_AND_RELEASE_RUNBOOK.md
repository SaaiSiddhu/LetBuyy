# 12 — DEPLOYMENT, ROLLBACK AND RELEASE RUNBOOK

**Package:** `MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09` · **Date:** 2026-08-09
**Audited commit:** `ee371182` (`stepup/main`)
**Authority:** Evidence package. Subordinate to DOC 01 (Constitution), root `AGENTS.md`, DOC 03.

> **This runbook has never been executed.** It documents the pipeline that exists in the repository
> plus the preconditions that must hold first. No step below has been performed by this program, and
> no deployment of this repository has been observed.

---

## 0. The precondition that makes everything else moot

```
git rev-list --count main..stepup/main          106
git rev-list --count origin/main..stepup/main   291
```

`production-deploy.yml` triggers on `main`. DEPLOY-R1/ART-03 require the lag to be **0**, and the
workflow's own branch-lag guard runs first, so **the pipeline cannot pass its first gate today**.

Until H-1 (doc 14) is done, every section below is theory. This is the ART-03 "deploy meta-blocker",
and it is still open — larger now (291) than when the prior program measured it (~180).

## 1. Preflight — all must be green before promotion

| # | Check | Command | State at `ee371182` |
|---|---|---|---|
| P-1 | Branch lag zero | `git rev-list --count origin/main..stepup/main` | **FAIL — 291** |
| P-2 | Governance gate | `pnpm validate:governance` | **FAIL** — aborts at validator 5/108 |
| P-3 | All 108 validators actually executed | (requires P-2 to pass; the runner is fail-fast) | **UNKNOWN — 102 never ran** |
| P-4 | Full typecheck | `pnpm typecheck` | Not run to completion this program |
| P-5 | Gateway suite | `npx tsx --test services/api-gateway/src/__tests__/*.test.ts` | **FAIL — 544/551, 7 failures** (user's in-flight refactor) |
| P-6 | Foundation waves 0–6 | `pnpm test:foundation:wave{0..6}` | 6/7 green; wave 5 red (design-system) |
| P-7 | Real-Postgres suites | `node --test tests/executable/*.mjs` | **PASS — 4/4** |
| P-8 | Flutter | `flutter analyze && flutter test` | **PASS — clean, 164/164** |
| P-9 | Migration ↔ rollback pairing | `pnpm validate:migrations` | **FAIL** — retired root `supabase/config.toml` |
| P-10 | Deploy matrix ↔ topology | `pnpm validate:deployment` | **PASS** |
| P-11 | Production secrets present | Cloudflare/Vercel/GitHub secret stores | **NOT PROVISIONED** (doc 14 §2) |
| P-12 | DNS resolves for every host the mobile app targets | `dig` | **NOT PROVISIONED** |

**Current preflight result: 3 of 12 green. Promotion is not permitted.**

## 2. Deployment sequence (as built in `production-deploy.yml`)

The pipeline is genuinely well-constructed — it is the *inputs* that are missing, not the machinery.

```
 1. branch-lag guard                   <-- currently fails here
 2. governance gate
 3. release preflight (secret presence enumeration)
 4. database migration (gated, with encrypted backup first)
 5. staging E2E
 6. backup
 7. deploy Workers   (wrangler deploy --env production)
      api-gateway · queue-workers · mobile-bff · webhook-service
 8. deploy Vercel apps
      storefront-runtime · merchant-control-plane · identity-platform ·
      platform-console · marketing-site
 9. smoke tests
```

Secrets are injected with `wrangler secret put <NAME> --env production` (names in doc 11 §5).

> **`--env production` is load-bearing.** `wrangler.toml`'s default `[vars]` block sets
> `FEATURE_EXTENSIONS="true"` and `FEATURE_LIQUID="true"`; only `[env.production.vars]` sets them
> `"false"`. A deploy that omits `--env production` ships a **constitutionally forbidden**
> configuration — third-party extensions enabled and the Liquid renderer flipped cohort-wide without
> the ART-17/THEME-R6 parity, security and performance gate.

## 3. Smoke tests that must pass immediately after deploy

Derived from the go-live probes the governance chain already names, plus this audit's findings:

| # | Probe | Pass condition | Why |
|---|---|---|---|
| S-1 | `GET https://{store}.letbuyy.com/` for a published store | 200 with the storefront, **not** the 401 holding page | Exercises both storefront blockers at once (§6) |
| S-2 | Unauthenticated `POST /api/auth/switch` | 401 | ART-06 account-takeover regression probe |
| S-3 | Anonymous order create | denied | ART-14 server-authority |
| S-4 | `commission_bps` on a fresh site | `0` | ART-12 ratchet |
| S-5 | Cross-tenant read with tenant A's session against tenant B | zero rows | ART-08 fail-closed |
| S-6 | Duplicate payment webhook, same event id | exactly one ledger effect | PAY-R2 idempotency |
| S-7 | `POST /app-store/bridge/fetch` in production | **should be rejected** | Currently **not** behind `extensionsFeatureGate` — this probe is expected to FAIL today (doc 10 §5.3) |
| S-8 | Mobile app cold start against production | login screen reachable, Turnstile challenge renders | Turnstile fails closed without keys |
| S-9 | Merchant creates a store | returned store URL is on `letbuyy.com` | Fixed this program; was `.store` |

## 4. Rollback triggers

Roll back immediately on any of:

- any cross-tenant read returning another tenant's row (S-5);
- any money effect posted more than once, or a ledger row mutated rather than reversed;
- `commission_bps` non-zero on any site;
- an unauthenticated privileged path returning 200;
- storefront 5xx or blanket 401 after S-1;
- error rate or latency breaching the runbook threshold — **note: no crash/APM provider is
  connected (doc 11 §6), so this trigger currently depends on manual observation.**

## 5. Rollback procedures

| Layer | Mechanism | Evidence it exists |
|---|---|---|
| Workers | Redeploy the previous version (`wrangler deploy` of the prior tag) | `production-deploy.yml` |
| Vercel apps | Promote the previous deployment | Vercel project history |
| Database | **Paired rollback per migration** — `database/supabase/rollback/<n>.rollback.sql` | 126 migrations; rollback dir present; `validate:migrations` enforces pairing |
| Feature capability | Flip the env flag (`FEATURE_EXTENSIONS`, `FEATURE_LIQUID`, `FEATURE_GRAPHQL`) and redeploy | `wrangler.toml` per-env vars |
| Theme renderer | Per-theme `renderer.engine` switch — the designed rollback for the Liquid flip | ART-17 / THEME-R6 |
| Mobile app | **Staged rollout halt + rollback** in Play Console; iOS has no pipeline at all | `mobile-merchant-release.yml` (Android only) |

**Money is the exception: it does not roll back.** The ledger is append-only and enforced at the
database layer — verified behaviourally (`ERROR: ledger is append-only; use reversing entries` on
both UPDATE and DELETE). A wrong posting is corrected by a **reversing entry**, never by a rollback
or a mutation (ART-10 / PAY-R6 / R-6). Any incident procedure that proposes "revert the ledger" is
constitutionally invalid.

## 6. The storefront ordering hazard — read before deploying any storefront fix

Two defects currently mask each other:

1. `apps/storefront-runtime/src/middleware.ts` **does not exist**, and nothing invokes `proxy()`,
   even though `proxy.ts:61` exports a Next.js `config.matcher`. Subdomain and custom-domain routing
   never executes.
2. `sites.published` (boolean, `NOT NULL DEFAULT false`, migration `090`) had **readers but no
   writer**. `proxy.ts:380,392` denies unless `published` **and** `status === 'published'`.

**Deploying fix 1 alone would 401 every storefront on the platform** — the routing would finally
execute and would then deny every store, because `published` is `false` everywhere. The merchant
admin would still show the store as published, because
`merchant-control-plane/.../domains/page.tsx:78` reads the lenient
`data.published === true || data.status === 'published'`.

This program fixed (2): `services/api-gateway/src/routes/stores.ts` now writes `published` in
lockstep with `status` on both publish paths. **(1) remains open** and is registered as a mandatory
V1 blocker.

**Deployment rule: ship them together, and back-fill existing rows** —
`UPDATE sites SET published = true WHERE status = 'published'` — as a paired migration, before or
with the middleware. Verify with S-1 against a real published store.

## 7. Incident ownership

| Domain | Owner |
|---|---|
| Money, ledger, settlement, reconciliation | Money owner — reversing entries only, never mutation |
| Tenancy / RLS | Security owner — treat any cross-tenant read as S0 |
| Identity / sessions | Identity owner — `identity-platform` is the sole issuer |
| Storefront / theme | Storefront owner — per-theme `renderer.engine` is the rollback |
| Mobile release | Mobile owner — Play staged rollout is the only live control today |
| Deploy pipeline | Release owner — branch-lag guard must stay green |

`CODEOWNERS` exists at `.github/CODEOWNERS`. Named humans are outside this package's authority.

## 8. Honest statement of this runbook's status

- The pipeline **exists** and is well-shaped (gates before migration, backup before deploy, smoke
  after).
- It has **never run to completion** in this repository state.
- **3 of 12 preflight checks pass.**
- Rollback is real for Workers, Vercel, migrations and flags; **absent for iOS** (no pipeline);
  **inapplicable for money** (append-only by design).
- Detection depends on telemetry that is **NOT CONNECTED**.

Nothing here should be read as "deployment is ready". It is a description of the machine and of
what must be true before the machine may be started.
