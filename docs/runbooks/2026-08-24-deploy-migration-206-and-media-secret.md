# Runbooks — migration 206 (+207 if present) and the media signing secret

**Prepared by:** Phase D1, 2026-08-24. **Executed by:** the owner, not this agent. Every
command below is copy-pasteable; no placeholder needs guessing, and no secret value is
ever pasted into chat or written to a file — generated secrets are piped directly into
the tool that consumes them.

Ordered by risk: migration first (closes a live defect, mechanically low risk), media
secret second (an unblock, with a risk finding that changes the recommended approach).

---

## Runbook A — apply the pending checkout/gift-card migrations to production

### What this actually deploys — read this first

As of this writing, `database/supabase/migrations/` ends at `207_gift_card_issue_idempotency_advisory_lock.sql`. It was **staged, not committed** when this section was first drafted; it landed as commit `a3a8980f` (Phase R5, a concurrent session) before this runbook was finalized — caught and corrected here rather than left stale, per this document's own "re-check immediately before relying on it" discipline. `206_checkout_order_idempotency_advisory_lock.sql` (committed `8dab89f9`, Phase R3) and `207` are now **both** committed and both part of what a `db push` will apply together. 207 fixes a related, more severe defect (real gift-card double-issuance, not just a duplicate-order race) using the identical advisory-lock pattern as 206, with its own domain-separated lock namespace (a different `hashtextextended` seed) so the two functions' locks can never collide. It is architecturally the same low-risk shape as 206 — `CREATE OR REPLACE FUNCTION` only, no schema change. **This phase did not run its own dedicated apply/re-apply/rollback proof on 207** — that was Phase R5's own responsibility (its commit message and `docs/evidence/production-readiness/2026-08-24-readiness-evidence.md`'s Phase R5 note describe an equivalent rollback-controlled proof); this phase's own W1 throwaway-container proof (apply twice, rollback, re-apply, concurrency test) was run against 206 specifically, and separately confirmed the *full* migration set including 207 replays cleanly end to end.

**`supabase db push` applies every locally-committed, not-yet-applied migration in one run — not a single named one — so this deploy will carry 206 and 207 together; there is no way to ship "only 206" through this pipeline once both are committed, which they now are.** Step 1 below still has you check the actual state right before you act — more migrations may land between now and when you run this.

### Pre-flight checks

Run these from the repository root, in order.

```bash
git status --short
```
**Expected:** empty, or only files you recognize as your own in-progress work. If migration/rollback files you don't recognize are staged or untracked, stop and ask whoever owns them before proceeding — do not commit on their behalf.

```bash
ls database/supabase/migrations/ | sort -V | tail -5
git log --oneline -1 -- database/supabase/migrations/
```
**Expected:** confirms the actual latest migration number *right now*, and whether it's committed. If it's higher than 207, or 207 itself has since been committed, this section still applies to the whole pending set — the reasoning above (same pattern, same low risk) is what matters, not the specific number, but re-read any new migration's own header comment before trusting that reasoning transfers.

```bash
node scripts/validators/branch-lag-guard-validator.mjs
```
**Expected:** `Branch lag guard validator passed`. If it fails, `main` is behind `HEAD` locally — see `MERGE_RUNBOOK.md` before proceeding; this runbook assumes local `main` already holds everything you intend to ship.

```bash
node scripts/validate-governance.mjs --lane=gate --plan
```
**Expected:** exits 0, plan shows required validators selected. This is the safe, read-only inventory mode — never run `--lane=gate` without `--plan` outside of CI (it deletes every `node_modules` in the repo).

### Step 1 — push the validated branch to the protected remote (human seam)

Per `MERGE_RUNBOOK.md`'s "Human remote promotion seam" (§103-135) — this has always been a human-only step, before and independent of this phase:

```bash
git rev-parse --short HEAD
git ls-remote origin refs/heads/main refs/heads/stepup/main
```
**Expected:** compare local `HEAD` against what `origin/main` currently resolves to, so you know exactly what you're about to push.

```bash
git push origin refs/heads/stepup/main:refs/heads/stepup/main
git push origin refs/heads/main:refs/heads/main
```
`stepup/main` first — the production branch-lag guard resolves `origin/stepup/main`, so pushing `main` first can leave a guarded deploy blocked on a stale integration ref.

**Verify:**
```bash
git ls-remote origin refs/heads/main refs/heads/stepup/main
```
**Expected:** both resolve to the same commit you just pushed.

**Stop condition:** if either push is rejected (non-fast-forward), someone else pushed to the remote branch since your last fetch. Do not force-push. Fetch, reconcile per `MERGE_RUNBOOK.md`'s Divergence section, and restart this runbook from the pre-flight checks.

### Step 2 — trigger the production deploy workflow

Pushing to `origin/main` auto-triggers `.github/workflows/production-deploy.yml` (`on: push: branches: [main]`). No separate trigger command is needed. If you'd rather trigger it explicitly (e.g. to re-run without a new push), use the GitHub UI's "Run workflow" button on that workflow, or:

```bash
gh workflow run production-deploy.yml --ref main
```

**What happens automatically, in this order** (read the full job graph in `production-deploy.yml` before trusting this summary): `branch-lag-guard` → `governance-gate` → `release-preflight` (checks every required secret, including `PRODUCTION_MEDIA_UPLOAD_SIGNING_SECRET` — see Runbook B if this is what's currently failing) → `migration-preflight` (runs `pnpm run validate:migrations`, then generates a **diff between your local migrations and production's actual current schema** as a downloadable CI artifact — this is the only way to see what production has already applied; this repository cannot tell you that on its own) → `staging-e2e` (full Playwright suite against staging) → `migrate-production` (takes an encrypted `pg_dump` backup **before** touching anything, uploads it as a CI artifact with 7-day retention, rejects any uncommitted migration file, then runs `pnpm dlx supabase@latest db push --db-url ... --include-all`) → `deploy-workers-production` → `deploy-apps-production` → `smoke-test-production`.

**Verify:**
- Watch the `migration-preflight` job; download the `production-migration-diff` artifact and confirm it shows only the migrations you expect (206, and 207 if it landed) — not something unrelated.
- Watch `migrate-production` succeed. Its own step order means a backup exists before the migration runs, regardless of outcome.
- After `deploy-apps-production`, run:
  ```bash
  curl -s https://api.letbuyy.com/v1/health
  ```
  **Expected:** a 200 response. This does not itself confirm the migration ran — the migration diff artifact and `smoke-test-production`'s own result are the real proof.

**Stop condition:** if `migration-preflight`'s diff artifact shows anything beyond the migrations you expect, or if `staging-e2e` fails, **do not manually re-trigger past it** — the workflow's own job dependencies already prevent `migrate-production` from running until `staging-e2e` succeeds; investigate the failure on staging first.

### Rollback

`database/supabase/rollback/206_checkout_order_idempotency_advisory_lock.rollback.sql` restores `create_checkout_order` to migration 202's exact prior body (diff-verified during Phase R3 authoring). This workflow has no automatic rollback job — apply it manually, the same way any hand-run production SQL is authorized in your organization (this runbook does not invent a new access path):

```bash
psql "$PRODUCTION_DB_CONNECTION_STRING" -v ON_ERROR_STOP=1 -f database/supabase/rollback/206_checkout_order_idempotency_advisory_lock.rollback.sql
```

**Verify:**
```bash
psql "$PRODUCTION_DB_CONNECTION_STRING" -Atc "SELECT pg_get_functiondef('public.create_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric)'::regprocedure) LIKE '%pg_advisory_xact_lock%';"
```
**Expected:** `f` (false) — confirms the lock is gone and the function matches migration 202 again. If 207 was also applied and needs rolling back, its own rollback file follows the identical pattern.

### Blast radius

**If this goes wrong:** the change is scoped to one function definition (`create_checkout_order`, plus `issue_gift_card` if 207 shipped) — no table, no data row, no other RPC. Worst case if the migration itself fails mid-apply: `CREATE OR REPLACE FUNCTION` is a single DDL statement per function, so it either fully applies or fully doesn't — there is no partial-function state. Worst case if the *fix* itself were somehow wrong (not indicated by any test in this session): concurrent checkout requests would serialize slightly more than before (an advisory lock adds brief contention, proven at 5x and 20x concurrency to add no meaningful latency) — never data loss, never a new class of duplicate order. **Who notices first:** checkout error-rate/latency dashboards (if contention were somehow pathological) or `smoke-test-production`'s own checkout-path assertions, before any human does.

---

## Runbook B — provision `MEDIA_UPLOAD_SIGNING_SECRET`

### The decisive finding — read this before the same-value-cutover framing below

The owner's request assumed a same-value cutover might be **necessary** to avoid invalidating already-issued signed upload URLs. Direct source reading (`services/api-gateway/src/routes/media.ts`, `services/api-gateway/src/routes/upload.ts`) found something more specific: **the signed upload token this secret produces is never verified anywhere in this codebase.**

- `POST /media/signed-upload` (`media.ts:251-326`) signs a token over `{site_id, intent_id, object_key, content_type, size_bytes, expires_at}` (`media.ts:78-91`), persists its **hash** and expiry in `media_assets.upload_token_hash`/`upload_intent_expires_at` (`media.ts:298-299`), and returns the token to the caller.
- The actual upload endpoint, `POST /v1/upload` (`upload.ts:119-225`, mounted at `services/api-gateway/src/index.ts:815`), **never reads the token, the object key, or any signature** — it authorizes purely via the caller's session (`auth.user`) and `verifyUploadStoreOwnership` (`upload.ts:99-107`), and generates its **own independent** object key (`upload.ts:168`).
- No other file in the repository reads `upload_token_hash`, `upload_intent_expires_at`, or the `x-letbuyy-media-upload-token` header (confirmed by exhaustive grep across `services/`, `apps/`, `packages/`).

**TTL, for completeness (it does not currently gate anything):** `planSignedR2UploadIntent` (`packages/infrastructure/storage-adapter/index.ts:71-72`) defaults `expiresInSeconds` to 900 (15 minutes), clamped between 60 and 3600 seconds; `media.ts`'s call site does not override it.

**Consequence:** rotating or newly setting `MEDIA_UPLOAD_SIGNING_SECRET` to **any** value — matching `AUTH_SECRET` or freshly generated — has **zero functional impact on uploads today**, because nothing checks the signature against anything. The only place a missing secret matters is `POST /media/signed-upload` itself, which returns `503 STORAGE_UNAVAILABLE` if `mediaUploadSigningSecret()` resolves to `null` (`media.ts:64-69, 279-282`) — and any non-empty value, old or new, satisfies that.

**Recommendation, given this:** set a **freshly generated** value now, not a copy of `AUTH_SECRET`. The "same-value first, rotate later behind a dual-verify window" approach the request anticipated is unnecessary — there is no verify-side dependency to transition, so there is nothing to keep in sync, and a fresh value fully satisfies SEC-R7 (no shared symmetric signing secret) immediately rather than as a bounded, dated, temporary exception. This conclusion rests entirely on the code as read on 2026-08-24; if it turns out something outside this repository (a Cloudflare-side rule, a client SDK, a not-yet-merged branch) does verify this token, that would change the answer — this is a repository-only reading, stated as such.

**If you want to independently re-confirm before trusting this for a security-relevant secret** (recommended for exactly that reason):
```bash
grep -rn "upload_token_hash\|x-letbuyy-media-upload-token\|MEDIA_UPLOAD_SIGNING_SECRET" --include="*.ts" services/ apps/ packages/ | grep -v __tests__
```
**Expected, matching this finding:** only the write/generation sites listed above — no verify call.

### Pre-flight checks

```bash
gh secret list --repo <org>/<repo> | grep -i media_upload_signing_secret
```
**Expected:** neither `STAGING_MEDIA_UPLOAD_SIGNING_SECRET` nor `PRODUCTION_MEDIA_UPLOAD_SIGNING_SECRET` present — confirming this is a first-time provision, not an overwrite of a working value.

```bash
grep -n "PRODUCTION_MEDIA_UPLOAD_SIGNING_SECRET" .github/workflows/production-deploy.yml
```
**Expected:** shows the `release-preflight` job's check (`.github/workflows/production-deploy.yml:73,110`) — confirms this is genuinely what's blocking deploy today.

### Step 1 — generate and set the staging secret

The value is generated locally and piped straight into `gh secret set` — it is never displayed, pasted, or written to a file.

```bash
openssl rand -base64 48 | gh secret set STAGING_MEDIA_UPLOAD_SIGNING_SECRET --repo <org>/<repo>
```

**Verify:**
```bash
gh secret list --repo <org>/<repo> | grep STAGING_MEDIA_UPLOAD_SIGNING_SECRET
```
**Expected:** the secret is listed with a recent "Updated" timestamp. `gh secret list` never shows values, by GitHub's own design — this is the only verification available without deploying.

### Step 2 — generate and set the production secret

```bash
openssl rand -base64 48 | gh secret set PRODUCTION_MEDIA_UPLOAD_SIGNING_SECRET --repo <org>/<repo>
```

**Verify:**
```bash
gh secret list --repo <org>/<repo> | grep PRODUCTION_MEDIA_UPLOAD_SIGNING_SECRET
```
**Expected:** listed, recent timestamp.

### Step 3 — confirm the deploy gate now passes and the secret resolves correctly

This only happens as a side effect of the next real staging/production deploy (triggered by Runbook A or a normal `main` push) — there is no standalone way to test a GitHub Actions secret without running the workflow that consumes it.

**Verify, after the next deploy:**
- `release-preflight` (staging and production workflows) no longer lists `MEDIA_UPLOAD_SIGNING_SECRET` as missing.
- In the deployed Worker, `mediaUploadSigningSecret()` (`media.ts:64-69`) now resolves `env.MEDIA_UPLOAD_SIGNING_SECRET` (the new dedicated value) rather than falling through to `env.AUTH_SECRET` — confirm via a log line or a temporary debug assertion if you want direct proof; this repository does not currently log which branch that function takes.

### Rollback

There is nothing to roll back in the security sense — per the finding above, no live behavior depends on this value. If the secret was set incorrectly (e.g. empty string), `mediaUploadSigningSecret()` falls through to `AUTH_SECRET` exactly as it does today (`media.ts:65`), which is the pre-existing, already-live state — not a new failure mode.

```bash
gh secret list --repo <org>/<repo> | grep MEDIA_UPLOAD_SIGNING_SECRET
```
**Expected (to confirm no accidental deletion):** both `STAGING_` and `PRODUCTION_` variants still listed.

### Stop condition

Stop and escalate, rather than proceeding, if: `gh secret set` reports an error (insufficient permissions, wrong repo); the independent re-confirmation grep above finds a verify-side reference this document missed; or if the next deploy's `release-preflight` job still reports the secret as missing after Steps 1-2 (indicates a name mismatch or a GitHub Environment-scoped secret shadowing the repo-level one — check `production-migrations` and `production` Environment-level secrets, not just repository secrets).

### Blast radius

**If this goes wrong:** per the finding, functionally nothing — the value is not currently verified anywhere, so a wrong, empty, or mismatched value cannot break an upload that isn't already dependent on `AUTH_SECRET`'s current behavior. The only real risk is scope: `gh secret set` without `--repo` targets the wrong repository, or without further flags sets a repository-level secret when an Environment-level one was intended — the pre-flight `gh secret list` step is what catches this before it matters. **Who notices first:** the next deploy's `release-preflight` job, before any user-facing system does — this is a CI-gate-only, not a live-behavior, blast radius today.
