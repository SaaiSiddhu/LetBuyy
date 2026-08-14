# 12 — Local Environment Isolation Plan

**Evidence artifact, not governance authority.** Subordinate to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, root `AGENTS.md`, and the relevant local `AGENTS.md` files. Where this document appears to conflict with those, the governance chain wins and the conflict is logged in §8.

---

> ## ⚠️ EXECUTION UPDATE — 2026-08-09 (added after this plan was executed)
>
> This document was written **read-only** in Phase 1: it was a *design*, and §7/§9 correctly listed the whole design as unverified. The design has since been **executed**. Read this banner before relying on anything below.
>
> | Field | Value |
> |---|---|
> | Executed on | **2026-08-09** |
> | Baseline SHA | `ee3711829d857e986014c5811bb94d86ebc3d343` |
> | Executed in | worktree `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/w0-local-environment`, branch `codex/w0-local-environment` — **not** the production-linked repo |
> | Full execution evidence | **`22_LOCAL_STACK_EXECUTION_EVIDENCE.md`** |
> | Raw transcripts | `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/W0-LOCAL-ENV/` (`01`–`06`) |
>
> **What the execution confirmed in this plan**
> - §1 (stray production link) — **confirmed**. `supabase/.temp/` in the original repo still holds `linked-project.json`, `project-ref`, `pooler-url`, `start-secrets/`. Read-only `ls` only; nothing touched.
> - §4.2 / §5 (adopt `local-stack-up.mjs`'s isolation pattern) — **confirmed and used**. Redirected `HOME`/`XDG_CONFIG_HOME` + `--workdir` + unique `project_id` is sufficient; the stack booted with **all 8 services healthy**, the full **124-migration** chain applied, **438** tables, **997** RLS policies, all 6 canonical money RPCs, and **0 rows** of business data. DB identity `127.0.0.1:15422`, not `aws-1-ap-south-1.pooler.supabase.com`.
> - §5.9 / §2.6 (Node pin missing) — **closed**. `.nvmrc` + `.node-version` = `20`, root `engines.node` = `">=20.9.0"` (commit `623718a1`). Floor verified empirically: `next@16.1.6` declares `engines.node ">=20.9.0"`.
> - §6 step 2 (`pnpm install --frozen-lockfile`) — **executed, exit 0**, lockfile byte-identical.
> - §7/§9 "Docker daemon running?" — **yes**, `docker info` exit 0, docker 29.6.2.
>
> **What the execution corrected or added**
> 1. **§2.2 port table is not what a linked machine actually runs.** There is no `supabase/config.toml` at the worktree root at all, and **12 dormant `supabase_*_Letbuyy_Store` containers** already exist on this machine from the production-linked repo. This collision hazard was not anticipated here. The isolated stack used `letbuyy-w0-local-env` + the 15420-series block and is fully disjoint; the dormant containers were never started, stopped, or removed.
> 2. **§5/§6 must NOT be executed by running `local-stack-up.mjs` as-is.** Line 838 runs `supabase db reset`, which the Wave 0 mandate forbids outright. `supabase start` against a fresh volume applies the identical 124 migrations with no reset. The script also seeds App Bridge tables (`app_developers`/`marketplace_apps`/`app_extensions`, lines 646–721) and boots the ART-22-frozen `app-marketplace`/`theme-marketplace` (lines 46–47). See `22_…§7`.
> 3. **§4.2's characterisation of `.tmp/` understates the risk.** It was untracked **and unignored** — a stray `git add -A` would have committed a generated `config.toml`, the migration copy, the redirected CLI home, and `.dev.vars` holding local Supabase JWTs (violating `SEC-R2`, `AGENTS.md:225`). Fixed in commit `4f3ded6f`.
> 4. **The teardown script is weaker than the boot script.** `local-stack-down.mjs` uses `--no-backup` (line 48), `rm -rf`s the run root including logs (line 62), and passes the **real `HOME`** (line 18) rather than the redirected one. See `22_…§8`.
> 5. **Two baseline defects surfaced that are NOT local-environment problems:**
>    - `services/api-gateway` **cannot bundle** at the baseline — 17 esbuild errors from 9 symbols missing from `@letbuyy/shared-types`. Cause: `packages/shared-types/src/index.ts` never re-exports the tracked `./contact` module. The one-line fix exists only as an **uncommitted** change in the original working tree. Verified: adding it takes errors 17 → 0 and `/health` → HTTP 200. (`22_…§5`)
>    - `node scripts/validate-governance.mjs` fails at validator **#2** (`tenant-isolation-validator`) in a clean tree, not #6 as doc 10/11 reported — because the dirty tree carries an uncommitted 59-line regeneration of `tenant-tables.registry.ts`. **106 of 108 validators never run** at the baseline. (`22_…§6`)
>
>   Together these mean the committed baseline is in a **worse** state than the dirty working tree for both build and governance. Treating `ee371182` as a clean, buildable starting point is a false premise.
>
> §7 and §9 below are retained as the historical Phase 1 record. Items they list as unverified that have since been measured are marked inline; `22_…§11` is the current authority on what remains unverified.

---

**Audit identity**
- Agent: F — Local Environment and Reproducibility Auditor, Wave 0 Phase 1 (read-only)
- Repo root: `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store`
- Branch: `stepup/main` (`git branch --show-current`)
- HEAD SHA at time of audit: `ee3711829d857e986014c5811bb94d86ebc3d343` (`git rev-parse HEAD`)
- Timestamp used: literal date **2026-08-09** (system date unavailable to this agent; per instructions)
- Mode: **read-only** — no service booted, no `docker up`, no `supabase start`, no `pnpm install`, no `supabase` CLI mutation of any kind was run. Only `node -v`, `pnpm -v`, `docker -v`, `supabase --version` (version probes) and file reads/greps were executed.
- Raw evidence: `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/F/` (`00_git_and_tool_versions.txt`, `01_supabase_link_state.txt`, `02_port_map_and_federation_stack.txt`, `03_env_template_keys.txt`, `04_lockfile_vs_package_json_check.txt`, `05_toolchain_pins.txt`)

**What was executed vs. inferred:** every command below was actually run on this machine (see raw-evidence files for full output). Design recommendations in §5–§6 are proposals layered on top of that evidence — they were **not executed** and their correctness at boot time is explicitly unverified (§9).

---

## 1. Critical finding first: this machine is currently linked to a REMOTE PRODUCTION Supabase project

This is the single most important fact this audit turned up, and it must gate every later Wave 0 phase that touches Supabase.

`supabase/config.toml` (tracked, repo-owned) is a plain local-dev config — `project_id = "Letbuyy_Store"`, ports `54321–54329`, no `[remote]` or project-ref block. Read in isolation, the repository looks unlinked.

But `supabase/.temp/` (git-ignored — `.gitignore:124` `**/supabase/.temp/`, **not tracked**, confirmed via `git ls-files --error-unmatch`) is **machine-local CLI state**, and it says otherwise:

```
supabase/.temp/project-ref        → qtrzgnnqnvboifoqntfi
supabase/.temp/linked-project.json → {"ref":"qtrzgnnqnvboifoqntfi","name":"Letbuyy-Store-Production","organization_id":"bgtushwxatiejcaiyyqd","organization_slug":"bgtushwxatiejcaiyyqd"}
supabase/.temp/pooler-url         → postgresql://***REDACTED***@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

(Full paths recorded, no credential values printed, per the safety rules governing this audit — see `artifacts/.../raw-evidence/F/01_supabase_link_state.txt`.)

Interpretation: at some prior point on **this machine**, someone ran `supabase link` from the repo root against a Supabase Cloud project literally named **"Letbuyy-Store-Production"**. This state is local to `~`-scoped CLI config resolution triggered from this working directory and is not part of the git history — it did not come from any commit, and no command in this audit created it; it pre-dates this session (file mtimes: 2026-08-01 / 2026-08-03, i.e. before the 2026-08-09 audit date).

**Consequence:** if anyone runs plain `supabase start`, `supabase db reset`, `supabase db push`, or `supabase migration up` from the **repo root** (as opposed to an isolated `--workdir`), the CLI resolves this linked state and there is a live risk of an accidental read against, or worse a push/reset against, the production project. `supabase start` alone starts *local* containers using `supabase/config.toml`'s local ports and does not by itself require the link — but several other subcommands (`db push`, `db remote`, `migration up --linked`, `db pull`) do consult the link, and an operator who *believes* they are "starting local Supabase" is one flag away from touching production. This is exactly the class of accident Wave 0 environment isolation exists to prevent.

**This finding is a hard input to the Wave 0 baseline decision** — it is not merely a preference. Recommended immediate posture (design only, not executed by this audit):
1. Treat the repo-root `supabase/` directory as **linked and unsafe for exploratory commands** until a human explicitly confirms/unlinks it (`supabase unlink` is itself a mutating command and out of scope for this read-only audit).
2. Any new local/dev Supabase workflow should run through an isolated `--workdir` (see §5) whose CLI state (`HOME`/`XDG_CONFIG_HOME`) is redirected away from whatever produced this link, so it can never inherit it.
3. Flag to a human operator (ARB-level, per `AGENTS.md` money/RLS/OAuth change-control) that a production project ref exists in a contributor's local CLI cache and confirm this is expected (e.g., a legitimate ops workstation) rather than accidental.

---

## 2. Required local services, ports, runtimes, credentials — inventoried from source

### 2.1 Runtimes needed to run the V1 web topology locally

| Runtime | Source of truth | Local port | Notes |
|---|---|---|---|
| storefront-runtime (Next) | `scripts/dev/ports.mjs` | 9000 | shopper storefront |
| merchant-control-plane (Next) | ″ | 9001 | merchant admin |
| identity-platform (Next) | ″ | 9002 | accounts/auth |
| marketing-site (Next) | ″ | 9006 | in V1 canonical map |
| platform-console (Next) | ″ | 9007 | internal console |
| @letbuyy/ui Storybook | ″ | 9009 | design system dev server |
| api-gateway (Cloudflare Worker, `wrangler dev`) | ″ | 9010 (inspector 9110) | backend every app/worker points at |
| mobile-bff (Worker) | ″ | 9011 (inspector 9111) | not a V1 web surface but shares the port map |
| webhook-service (Worker) | ″ | 9012 (inspector 9112) | |
| queue-workers (Worker) | ″ | 9013 (inspector 9113) | Cloudflare Queues consumers — emulated locally by `wrangler dev`/Miniflare, no external broker required |

`app-marketplace` (9003), `developer-portal` (9004), `theme-marketplace` (9005), `platform-operations-portal` (9008) also appear in `scripts/dev/ports.mjs` / `APP_PORTS` — these are the **frozen/pending-consolidation** apps per root `CLAUDE.md`; they are not V1 deploy targets but the port map still provisions them because `pnpm dev` boots the whole `apps/*` filter. This is a pre-existing repo decision, not something this audit is proposing to change.

### 2.2 Database / auth / storage (Supabase local stack)

From `supabase/config.toml` (repo default, unlinked-config view):

| Component | Port |
|---|---|
| API (Kong/PostgREST/Auth/Storage) | 54321 |
| Postgres | 54322 |
| DB shadow (used by `db diff`) | 54320 |
| Studio | 54323 |
| Inbucket (local SMTP/email capture) | 54324 (+ 54325/54326 if uncommented) |
| Connection pooler (disabled by default: `[db.pooler] enabled = false`) | 54329 |
| Analytics (Postgres backend) | 54327 |
| Edge Functions inspector | 8083 |

Postgres major version pinned: `major_version = 17` (must match the target remote's major version per the config's own comment).

Docker is a hard prerequisite — `supabase start` runs Postgres/Kong/GoTrue/etc. as containers. Docker Desktop or Colima; the audit confirmed `docker -v` succeeds and the daemon is installed (not confirmed running — that is a boot-time check, see §9).

### 2.3 Optional infra — LCIS V2 (`tools/central-intelligence`)

`tools/central-intelligence/docker-compose.yml` defines a **separate, optional** stack not required for the core V1 runtimes:

| Service | Container name | Ports |
|---|---|---|
| Qdrant (vector store) | `lcis-qdrant` | 6333, 6334 |
| ClickHouse (SigNoz backing store) | `lcis-clickhouse` | 9000 (native), 8123 (HTTP) |
| SigNoz OTel collector | `lcis-otel-collector` | 4317 (gRPC), 4318 (HTTP) |
| SigNoz query service | `lcis-signoz-query` | 8080 |
| SigNoz frontend | `lcis-signoz-frontend` | 3301 |

Note the **generic, non-project-scoped container names** (`lcis-qdrant`, `lcis-clickhouse`, …) and the **fixed host ports** (6333/6334/9000/8123/4317/4318/8080/3301, none namespaced). Two checkouts of this repository (e.g. this `Copy/Letbuyy_Store` tree alongside a sibling clone) running this compose file simultaneously would collide on both container names and ports. This is a real isolation gap for §5/§6 to close if LCIS V2 is ever brought into the Wave 0 local-boot scope — but it is out of scope for the frozen V1 web topology itself (LCIS is AI-infrastructure tooling, not a runtime app per the Canonical Runtime Map).

Its `package.json` also declares `"engines": { "node": ">=20" }` — the only `engines` field found anywhere in the repo outside `docs/archive/`.

### 2.4 Credentials / secrets referenced by local templates (key names only — no values read from any real secret file)

Read from `config/env/templates/next-app.env.example`, `config/env/templates/worker.env.example`, `config/env/production.env.example`, `config/env/staging.env.example`, `tools/central-intelligence/.env.example` (full key inventory persisted at `artifacts/.../raw-evidence/F/03_env_template_keys.txt`). Representative categories:

- Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Session/signing: `AUTH_SECRET`, `CUSTOMER_SESSION_SECRET`, `CSRF_SECRET`, `INTERNAL_API_SECRET`, `PREVIEW_SIGNING_KEY`, `STORE_ACCESS_SIGNING_KEY`, `PAYMENT_CONFIG_ENCRYPTION_KEY`
- Payments: `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`, `STRIPE_SECRET_KEY/WEBHOOK_SECRET`, `PAYPAL_*`, `CASHFREE_*`
- Bot protection: `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`
- Email: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- Rate limiting: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (optional locally — see §2.5)
- Platform console: `PLATFORM_CONSOLE_API_TOKEN`, `PLATFORM_CONSOLE_SESSION_SECRET`, `PLATFORM_CONSOLE_TOTP_SECRET`, `PLATFORM_CONSOLE_ALLOWED_EMAILS`

None of these were read from any real `.env*` file — only from the committed `*.env.example` / `*.env.template` files, whose values are placeholders by repo contract (`config/env/README.md`: *"Templates use placeholders only… do not copy real secrets back into the repository."*).

### 2.5 Nine real `.env.local` files already exist on this machine (gitignored, not tracked, contents not read)

`find` located `.env.local` under `apps/app-marketplace`, `apps/storefront-runtime`, `apps/marketing-site`, `apps/platform-operations-portal`, `apps/platform-console`, `apps/developer-portal`, `apps/identity-platform`, `apps/theme-marketplace`, `apps/merchant-control-plane`. Each confirmed **not tracked** (`git ls-files --error-unmatch` fails for all nine) and gitignored (`git check-ignore -v` matches `.env*.local` per-app `.gitignore` rules, e.g. `apps/app-marketplace/.gitignore:5`, `apps/storefront-runtime/.gitignore:42`). **Contents were never opened** — per the secret-handling rule, only path + tracked/gitignored status is recorded. Their existence is consistent with `scripts/dev/setup-local-env.mjs` having already been run on this machine (see §4) but this was not independently confirmed by diffing contents.

`tools/central-intelligence/.env.example` also exists on disk but is likewise untracked/gitignored there.

Redis: `UPSTASH_REDIS_REST_URL` / `_TOKEN` are optional locally by explicit design — `scripts/dev/setup-local-env.mjs` leaves both blank with the comment *"the API gateway uses Redis for rate limiting whenever both Upstash vars are set, and fails closed (429) if it can't reach it… Blank ⇒ it falls back to its built-in in-memory limiter. No local Redis needed."* So no standalone Redis/Upstash-emulator service is required for local boot.

### 2.6 Node / pnpm / Docker / Supabase CLI versions installed on this machine

```
node -v        → v26.5.1
pnpm -v        → 10.6.2
docker -v      → Docker version 29.6.2, build dfc4efb
supabase --version → 2.111.0
```

Root `package.json` pins `"packageManager": "pnpm@10.6.2"` — this **exactly matches** the installed pnpm. No root `engines.node` field exists anywhere in the repo (only `tools/central-intelligence/package.json` declares `"node": ">=20"`, and `docs/archive/firebase-legacy/functions/package.json` declares `"node": "20"` — both outside the actively maintained workspace). CI (`ci.yml`) pins `NODE_VERSION: "20"` for most jobs and `node-version: 22` in five topology/architecture/deploy workflows (`architecture-governance.yml`, `environment-lifecycle.yml`, `live-production-certification.yml`, `staging-runtime-deployment.yml`, `production-rollout.yml`). **The locally installed Node (v26.5.1) is a major-version mismatch against every CI pin (20/22)**, and nothing in the repository enforces or even warns about this locally — no `.nvmrc`, no `.tool-versions`, no root `engines` field. This is flagged as a reproducibility gap in doc 13 (§3) and should be closed before Wave 0 declares a local baseline.

---

## 3. Deprecated/reserved topology cross-check

Per root `CLAUDE.md`'s Canonical Runtime Map / Deprecated Runtime Policy: this audit's port and service inventory (§2.1) draws only from `scripts/dev/ports.mjs` and `pnpm-workspace.yaml`, and neither references any of the deprecated aliases (`apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront`). Reserved services (`search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline`, `checkout-runtime`, `mobile/shopper-app`, `mobile/operator-app`) have no `wrangler.toml` / `package.json` under `services/*` or `apps/mobile/*` beyond manifest placeholders and correctly do not appear in the local port map. No conflict found here.

---

## 4. Existing prior art: the repo already ships two local-environment designs

This is important context for Wave 0 — the isolation problem this audit was asked to *design* a solution for is **already partially solved in-repo**, by two different, non-conflicting mechanisms:

### 4.1 `scripts/dev/setup-local-env.mjs` + `scripts/dev/ports.mjs` (the everyday path, `pnpm dev`)

Invoked automatically by `pnpm dev` / `pnpm dev:all` / `pnpm dev:apps` / `pnpm dev:services`. It:
- Reads the **committed** key sets from `config/env/templates/{next-app,worker}.env.example` (governance-owned schema)
- Overlays obviously-fake, well-labelled local values (`DEV_SECRET = "letbuyy_local_dev_only_secret_change_me_please"`, Cloudflare's official Turnstile *always-pass* test keys `1x00000000000000000000AA`, a well-known public Supabase demo JWT pair, `rzp_test_localdev`, `sk_test_localdev`, sandbox-mode payment provider flags)
- Writes untracked `apps/<app>/.env.local` and `services/<svc>/.dev.vars`, **never overwriting existing files unless `--force`**
- Points every app/worker at `http://localhost:54321` (the default unlinked local Supabase config) and at the `9000+` port map

This is a **convenience layer only** (`docs/LOCAL_DEV.md`: *"Local dev is a convenience layer. Staging and production remain the only supported runtime targets."*) — it assumes a human separately runs `supabase start` against the repo-root `supabase/` config, which is exactly the config now shown (§1) to carry a stale production link in its CLI state.

### 4.2 `scripts/utilities/local-stack-up.mjs` (the "federation stack" — a genuinely isolated design)

This script is a **materially more isolated** design than the everyday path and is strong prior art for what this audit was asked to produce:

- Unique project id: `"letbuyy-federation-local"`
- Runs entirely under `.tmp/federation-stack/` (repo-relative, **not gitignored by an explicit rule but also not tracked** — confirmed via `git check-ignore` returning no match, meaning `.tmp/` is simply outside any tracked path; it is not part of git history)
- Generates its **own** `supabase/config.toml` inside that directory (`prepareSupabaseProject()`), with its **own** distinct port block offset from both the repo-root default and from `54321`-series conventions: API 15421, DB 15422, shadow 15420, Studio 15423, Inbucket 15424, SMTP 15425, POP3 15426, Analytics 15427, Pooler 15429
- Copies real migrations from `database/supabase/migrations/` into the isolated project so the schema is authentic, not a stub
- **Redirects the Supabase CLI's own state** via `HOME` / `XDG_CONFIG_HOME` overrides (`supabaseCliEnv`) pointed at `.tmp/federation-stack/home/` — this is the critical design detail that would prevent this script from ever inheriting the stray production link found in §1, because the CLI never reads the real `~/.supabase` or repo-root `supabase/.temp/` state
- Always invokes `supabase` with `--workdir <isolated dir>`, never against the repo-root `supabase/` directory
- Ports for app/worker HTTP servers are also distinct: gateway 8787, webhook-service 8788, web apps on 3000–3005/3010/3011 (a **different** range than `scripts/dev/ports.mjs`'s 9000s — the two designs do not collide with each other if run side by side)
- Local secrets are all clearly-synthetic placeholders (`local-<label>-placeholder`, a deterministic 32-hex string, `sandbox` payment modes) with an explicit escape hatch (`providerCredentialOverrides()`) to pull real sandbox provider credentials from the *process* environment only, never from a committed file
- Detects a modern Node binary (`detectModernNodeBin`, requires major ≥ 22) independent of whatever `node` resolves to on `PATH`, with fallback search paths — evidence the script's author was already aware of the Node-version drift risk flagged in §2.6

This script was **not run** by this audit (`.tmp/federation-stack/` does not exist on this machine — confirmed by directory listing), so whether it actually boots end-to-end is unverified (§9). One drift risk noted on inspection, not executed or confirmed: its `seedSql()` inserts into `users` / `users_custom` tables; a targeted grep of `database/supabase/migrations/*.sql` confirms both table names still exist in the current baseline migration (`000_baseline.sql`) as well as being referenced across many later migrations, so this is not conclusively stale — but it was not cross-checked against the *current* canonical `store_customers`/`customer_credentials` model from `CLAUDE.md` beyond table-name presence, and should be re-verified at the environment-boot phase before this script is relied upon as-is.

---

## 5. Design: isolated local environment (proposed — not executed)

Given §4.2 already contains most of the isolation properties Wave 0 needs, this design **adopts and hardens `local-stack-up.mjs`'s pattern** rather than inventing a third one, and adds the specific gaps found in this audit.

1. **Unique project id** — keep `letbuyy-federation-local` (or a per-agent/per-branch suffix, e.g. `letbuyy-federation-local-<branch-slug>`, if multiple isolated stacks must coexist on one machine).
2. **Unique container/service names** — Supabase's own CLI already derives container names from `project_id` (`supabase_db_<project_id>`, etc.), so this is inherited for free once the project id is unique. The LCIS `docker-compose.yml` (§2.3) does **not** do this — its container names are hardcoded (`lcis-qdrant`, …); if LCIS ever needs to run per-checkout-isolated, that compose file needs a `COMPOSE_PROJECT_NAME` or per-service name override, which is out of scope for the V1 web boot path but should be logged as a backlog item if/when LCIS is brought into scope.
3. **Unique ports, offset from both existing conventions** — reuse `local-stack-up.mjs`'s `15420–15429` Supabase block and `8787/8788`/`3000–3011` app block; do **not** reuse `scripts/dev/ports.mjs`'s `9000–9013` range for the isolated stack, so a contributor can run the everyday `pnpm dev` and the isolated federation stack simultaneously without collision (already true in the existing script — verified by inspection, §4.2).
4. **Separate DB volume** — inherited from Supabase CLI default behavior: a distinct `project_id` inside a distinct `--workdir` produces distinct Docker named volumes, isolated from both the default `supabase/config.toml` volumes and from any other isolated stack with a different id.
5. **Local-only test credentials** — reuse the two existing placeholder sets (`setup-local-env.mjs`'s `DEV_SECRET`/demo JWTs for the everyday path, `local-stack-up.mjs`'s `local-<label>-placeholder` set for the isolated path). Neither should ever be promoted to staging/production — both are already clearly labelled as such in-repo.
6. **No remote Supabase link** — enforced structurally by always invoking the CLI with `--workdir <isolated dir>` **and** a redirected `HOME`/`XDG_CONFIG_HOME`, exactly as `local-stack-up.mjs` already does. This is the specific mechanism that neutralizes the §1 finding: as long as every local/CI Supabase invocation goes through an isolated workdir + redirected CLI home, the stray production link sitting in this machine's real `supabase/.temp/` is simply never consulted.
7. **No production secrets** — both existing scripts already satisfy this (placeholders only, `SKIP_NEEDS_HUMAN_*` sentinels for anything that must be provisioned by a human — e.g. `FCM_PROJECT_ID`, `APNS_KEY_ID` in `services/queue-workers/wrangler.toml`).
8. **Provider sandbox/test mode only** — already true: Razorpay `rzp_test_*`, Stripe `sk_test_*`, PayPal `PAYPAL_MODE=sandbox`, Cashfree `CASHFREE_ENVIRONMENT=sandbox`, domain registrar `REGISTRAR_PROVIDER=sandbox`.
9. **Reproducible tool versions** — this is the one dimension **not** solved by either existing script and the one gap this audit adds to the design: pin Node to match CI (`NODE_VERSION: "20"` in `ci.yml`) via a root `.nvmrc` or `engines.node`, and keep the existing exact pnpm pin (`packageManager: "pnpm@10.6.2"`, already matching the installed CLI). See doc 13 for the full reproducibility analysis and recommendation.

### 5.1 Recommended fixed port table for a new isolated environment (design only)

| Layer | Suggested block | Rationale |
|---|---|---|
| Supabase (API/DB/shadow/Studio/Inbucket/SMTP/POP3/Analytics/Pooler) | `15420–15429` | Reuse `local-stack-up.mjs` verbatim — already implemented, already offset from both `54321` (repo default / possibly-linked) and `9000s` (everyday `pnpm dev`) |
| API gateway / webhook-service (Workers) | `8787` / `8788` | Reuse `local-stack-up.mjs` verbatim |
| Web apps (isolated smoke-test mode) | `3000–3011` | Reuse `local-stack-up.mjs` verbatim |
| Web apps (everyday dev mode) | `9000–9013` | Existing `scripts/dev/ports.mjs` — unchanged |

No new ports are proposed; the design is "adopt what's already isolated, pin what isn't."

---

## 6. Design: what a fresh, from-scratch isolated boot would need (not executed)

For a **new** machine/CI runner with nothing installed, the boot order this design implies (still design-only — none of this was run):

1. Install pinned Node (per §5.9 recommendation, matching `NODE_VERSION: "20"` from `ci.yml` once a pin exists) and Corepack/pnpm at the exact `packageManager` pin (`pnpm@10.6.2` — already enforced by `packageManager`, Corepack will fetch this automatically).
2. `pnpm install --frozen-lockfile` (already the repo default via `.npmrc: frozen-lockfile=true`) — this **fails loud** rather than silently drifting the lockfile, which is the correct posture for reproducibility (verified as a real `.npmrc` setting, not merely a doc claim).
3. Ensure Docker Desktop/Colima is running (`docker info` succeeds) — required before any Supabase local start.
4. Run the isolated stack entry point (`node scripts/utilities/local-stack-up.mjs`, or whatever supersedes it after the hardening in §5.9) rather than a bare `supabase start` from the repo root, so the stray production link (§1) is never in the resolution path.
5. Run `node scripts/dev/setup-local-env.mjs` only for the everyday multi-app dev-server workflow — it assumes a Supabase instance is already reachable at `http://localhost:54321` (the repo-default port), which the *isolated* stack in step 4 deliberately does **not** use (it uses `15421` instead). These two flows are not currently wired together — a contributor using the isolated federation stack would need to point the everyday `.env.local` files at the isolated stack's ports manually, or the isolated script's own app-boot logic (lines beyond what this audit inspected) handles this itself. This wiring gap is unverified and flagged for the environment-boot phase.

None of steps 1–5 were executed by this audit.

---

## 7. What this document does NOT claim

*(Phase 1 record. Inline `[RESOLVED 2026-08-09]` markers added after execution — see `22_LOCAL_STACK_EXECUTION_EVIDENCE.md`.)*

- Whether `supabase start` (in either the default or isolated workdir) actually succeeds on this machine — ~~unverified~~ **[RESOLVED 2026-08-09]** the **isolated** workdir starts successfully: all 8 enabled services healthy, `supabase status` exit 0, 124/124 migrations applied. The **default/repo-root** workdir was still never started, deliberately (it is the linked one).
- Whether `local-stack-up.mjs` runs to completion without error — **still unverified, and deliberately so.** It was not executed: line 838 runs the forbidden `supabase db reset`, and it seeds App Bridge tables / boots ART-22-frozen apps. Its *isolation primitives* were adopted and proven; the script as a whole was not.
- Whether the nine existing `.env.local` files on this machine (§2.5) actually match what `setup-local-env.mjs` would currently generate — **still unverified**; contents were never opened, in either phase.
- Whether Docker's daemon is actually running right now — ~~unverified~~ **[RESOLVED 2026-08-09]** `docker info` exit 0; Docker 29.6.2; ~12 GB of Supabase images pulled cold during the boot.

---

## 8. Conflicts / escalation items found

1. **Governance-vs-machine-state conflict (not a doc conflict, but load-bearing):** no committed document claims or denies a remote Supabase link exists; the *machine* has one anyway (§1). This is not a conflict between two authoritative documents, but it is a conflict between the intended "local dev never touches production" posture implied throughout `config/env/README.md` / `docs/LOCAL_DEV.md` and the actual state of this contributor's CLI cache. Recorded here per the escalation instruction rather than resolved unilaterally (this audit did not run `supabase unlink`).
2. No conflicts found between `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, root `AGENTS.md`, and the local-environment scripts inspected — the scripts' scope (local dev only, explicitly subordinate to staging/production as the only supported deploy targets) is consistent with the Constitution's authority chain and with `CLAUDE.md`'s Canonical Runtime Map.

---

## 9. Explicitly unverified (deferred to the environment-boot phase)

*(Phase 1 record. The environment-boot phase ran on 2026-08-09; `22_LOCAL_STACK_EXECUTION_EVIDENCE.md` §11 is now the current authority on what remains unverified.)*

- Whether the Supabase local stack (default or isolated) actually boots and reaches a healthy state — **[RESOLVED 2026-08-09]** the isolated stack boots and is healthy (`22_…§4`). The default/linked one was still not started.
- Whether `local-stack-up.mjs` seed data (`users`/`users_custom` inserts) still matches the *current* schema beyond table-name presence — **still open.** The seed was not run at all (`22_…§7`), so the column-level question is untouched.
- Whether the LCIS `docker-compose.yml` stack boots cleanly and whether its unnamespaced container names/ports actually collide in practice — **still open.** LCIS was out of scope for the V1 web boot and was not started.
- Whether Docker's daemon is currently running — **[RESOLVED 2026-08-09]** yes, `docker info` exit 0.
- Whether `pnpm install --frozen-lockfile` actually succeeds on a truly fresh `node_modules` — **[PARTIALLY RESOLVED 2026-08-09]** it succeeds (**exit 0**) into an empty `node_modules` in a fresh worktree, with `pnpm-lock.yaml` byte-identical before and after. But resolution was served entirely from the local pnpm store (`resolved 860, reused 860, downloaded 0`), so a **network-cold** install is still untested.

### 9.1 New unverified items raised by the execution (2026-08-09)

- Whether any V1 web app other than `storefront-runtime` boots (`merchant-control-plane`, `identity-platform`, `marketing-site`, `platform-console` — none attempted).
- Whether `webhook-service`, `queue-workers`, or `mobile-bff` start.
- Whether the api-gateway works end-to-end against **seeded** data — the proven round trip (`22_…§5.4`) is a correct-*empty*-result path.
- Whether any money RPC executes correctly — existence verified, none invoked.
- Whether validators #3–#108 pass — unmeasured; the gate dies at #2.
