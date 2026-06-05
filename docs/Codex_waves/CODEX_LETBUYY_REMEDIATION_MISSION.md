# CODEX LETBUYY REMEDIATION MISSION — Single Agent, GPT‑5.5 xhigh, Continuous Until Fixed

> **Use this when you want ONE Codex agent — no subagents — to fix every issue** found in the final architecture review, in dependency order, in one continuous autonomous run, on GPT‑5.5 at Extra‑High reasoning. It drives the P0→P4 remediation plan (`docs/LETBUYY_MASTER_EXECUTION_PLAN.md` + `docs/P0_SECURITY_MASTER.md` … `docs/P4_PRODUCT_MASTER.md`, sequenced by `docs/LETBUYY_CODEX_IMPLEMENTATION_MASTER.md`). It never runs out of the *right* next task; when a fix needs a human, it logs it and moves on — exactly like the old `CODEX_MASTER_SEQUENTIAL_MISSION.md`, but pointed at the remediation backlog instead of the feature backlog.

**Driver:** GPT‑5.5 in Codex. **Reasoning:** `xhigh` ("Extra High") for security/DB/release‑pipeline work · `high` for cost/perf/mechanical edits.
**Mode:** Single agent, **no subagents**, continuous, autonomous, local, across as many sessions as it takes. Never stop while unblocked work remains.
**Branch:** one branch, `stream/letbuyy-remediation`. Small reversible commits.
**Source‑of‑truth docs (read before you start):** `docs/LETBUYY_MASTER_EXECUTION_PLAN.md` (verdicts), `docs/LETBUYY_CODEX_IMPLEMENTATION_MASTER.md` (order/graph), and per phase `docs/P0_SECURITY_MASTER.md`, `docs/P1_COST_MASTER.md`, `docs/P2_PERFORMANCE_MASTER.md`, `docs/P3_SCALABILITY_MASTER.md`, `docs/P4_PRODUCT_MASTER.md`. Obey `AGENTS.md`, `CLAUDE.md`, `docs/governance/`.

---

## PART A — How To Run Codex Efficiently (June 2026, single agent, 24/7)

This is grounded in the current Codex/GPT‑5.5 docs (sources at the end). Read it once, then use the launch prompt in Part C.

### A1. Model + "extra high intelligence" = `xhigh` reasoning
GPT‑5.5 (April 2026) is OpenAI's strongest agentic‑coding model: it stays on task longer without stopping early, holds context across large systems, and is *more* token‑efficient than GPT‑5.4. In Codex it has a **400K context window** and an optional **Fast mode** (1.5× faster tokens for 2.5× the cost). There is no separate "intelligence" switch — the dial you want is **reasoning effort**, which supports `none | low | medium (default) | high | xhigh`. "Extra High" in the UI = `xhigh` in config; OpenAI's own GPT‑5.5 evals were run at `xhigh`. Use `xhigh` for the hard, high‑risk work (auth redesign, migrations, release pipeline) and `high` for mechanical edits to conserve tokens.

`~/.codex/config.toml`:
```toml
model = "gpt-5.5"               # shows as "GPT-5.5" in the Codex model picker
model_reasoning_effort = "xhigh"
approval_policy = "never"        # don't pause for approvals during a continuous run
sandbox_mode = "workspace-write" # write to the repo; keep .git/.codex protected

[sandbox_workspace_write]
network_access = true            # needed for pnpm/flutter/supabase CLI; keep off if you mirror deps
```

### A2. Continuous / non‑stop execution
- Run headless with **`codex exec`** (non‑interactive; finishes without a human and is the right entry point for long autonomous runs). Pair it with `--ask-for-approval never --sandbox workspace-write`.
- `--full-auto` still exists but is now a **deprecated compatibility alias** (it maps to on‑request + workspace‑write and prints a warning) — prefer the explicit flags above.
- `--dangerously-bypass-approvals-and-sandbox` (alias **`--yolo`**) removes *all* approvals and sandboxing. Use it **only inside an externally hardened, isolated environment** (a container or throwaway VM), never on your normal machine.
- Codex genuinely sustains long‑horizon runs (OpenAI demonstrated a single ~25‑hour, ~13M‑token run). "24/7 forever" is still bounded by your **plan usage limits** and **context compaction** — the way you make it *effectively* non‑stop is durable markdown memory (A4) so each new session resumes exactly where the last left off. Use `codex exec resume --last` (or `--continue`) to pick up the thread after a stop/compaction.

### A3. Single agent — no subagents
Subagents are GA (up to 6 concurrent) but **Codex only spawns them when you ask it to**, and there's no separate "system" to disable. So enforce single‑agent operation by: (1) don't define any `[agents]` blocks in config; (2) tell the agent, in the prompt, to **never delegate / never spawn a subagent** and to do all work in its own loop. The launch prompt below states this explicitly.

### A4. The technique that actually makes long runs work: durable project memory + per‑milestone verification
OpenAI's own long‑horizon guidance: keep the spec, plan, runbook, and status in markdown the agent re‑reads every loop, and verify after **every** milestone. For this mission those files already exist — the P‑master docs are the spec, `LETBUYY_CODEX_IMPLEMENTATION_MASTER.md` is the plan/runbook, and you maintain a status ledger. The agent loop is: **Plan → Edit → Run tests/lint/typecheck/governance → Observe → Repair → Update ledger → Repeat.** Tests are the external source of truth that keeps the run honest no matter how long it runs; every red‑to‑green cycle is unambiguous feedback. Use `/plan` to checkpoint approach before big changes.

### A5. Skip‑and‑continue (the behavior you asked for)
Anything that needs a human (live keys, prod DB apply, Apple signing, paid signups, brand/copy/pricing, an irreversible decision) → append it to `CODEX_REMEDIATION_LEDGER.md` under `## SKIPPED — NEEDS HUMAN` with the exact requirement and where it blocks, then **immediately start the next unblocked task**. Never let one human gate stall the whole program. This mirrors the old prompt's SKIP law.

---

## PART B — The Remediation Program (what "done" means)

**PRIME DIRECTIVE:** Make LetBuyy safe to launch a 100‑merchant private beta, then progressively ready for 1,000, by fixing every VERIFIED finding in `LETBUYY_MASTER_EXECUTION_PLAN.md` in dependency order, on the existing (correct) architecture, in one continuous single‑agent run — **without** re‑doing the FALSE‑POSITIVE items it calls out.

**EXECUTION ORDER (finish each phase's gate before the next — from `LETBUYY_CODEX_IMPLEMENTATION_MASTER.md`):**
```
PHASE 1  P0 Security      → customer-session primitive (gateway-enforced, REST+GraphQL), set-password OTP binding,
                            CSRF unify + public-mutation coverage, customer-auth rate limit + Turnstile        (BETA BLOCKER)
PHASE 2  Release Safety   → pipeline fail-closed (no silent skips), secrets-before-deploy, migration diff/backup,
                            WS11–WS13 flags OFF in prod, smoke suite green on staging                          (BETA BLOCKER)
PHASE 3  P1 Cost          → request-log sampling, cron no-op, worker log sampling, atomic single rate-limit,
                            queue write batching + bulk single-path, (decide) Hyperdrive activation
PHASE 4  P2 Performance   → edge cache + purge-on-publish, pooled SQL reads, view-counter de-hot, keyset pagination,
                            trigram search, async export, variant diff + checkout deferral
PHASE 5  P3 Scalability   → partition+retention (079–083), analytics/search projections, dual-model consolidation,
                            queue storm controls, GraphQL fan-out/N+1 fixes, then deploy+prove WS11–WS13 in staging
PHASE 6  P4 Product       → multi-template theme editor, GraphQL cart (real or loud-unsupported),
                            API-ownership consolidation + validator, developer-portal deploy decision
```

**OVERALL SUCCESS (run is COMPLETE only when, with evidence):** the customer‑auth kill chain red‑team test fails at every step; no `password_hash` in any API response; identity set‑password requires a server‑side OTP intent; one CSRF cookie name across runtimes; customer‑auth throttled + Turnstile; the release pipeline cannot report green while skipping migrations/deploys and cannot serve a revision before its secrets exist; WS11–WS13 OFF in prod until staging‑proven; the smoke suite is green on staging; **128/128 governance, typecheck, tests, and a network‑free build all green.** Everything in Phases 3–6 that remains is logged with status; `COMPLETE` requires the P0+P2(release) gates proven, the rest either done or in `SKIPPED — NEEDS HUMAN`.

---

## PART C — THE SINGLE LAUNCH PROMPT (paste into Codex `/goal`, or `codex exec`)

```
Read these in full before acting:
  docs/LETBUYY_MASTER_EXECUTION_PLAN.md          (verified findings + verdicts; obey the FALSE-POSITIVE list)
  docs/LETBUYY_CODEX_IMPLEMENTATION_MASTER.md     (ordered plan, dependency graph, migration/test/deploy sequence)
  docs/P0_SECURITY_MASTER.md, P1_COST_MASTER.md, P2_PERFORMANCE_MASTER.md, P3_SCALABILITY_MASTER.md, P4_PRODUCT_MASTER.md
  AGENTS.md, CLAUDE.md, docs/governance/

You are ONE agent. Do NOT spawn or delegate to subagents. Do all work yourself in a continuous loop.
Run autonomously (24h+, many sessions) on branch stream/letbuyy-remediation. Never stop while unblocked work remains.
Use GPT-5.5 at reasoning effort xhigh for Phase 1 (security), Phase 2 (release pipeline), and all DB migrations;
high for cost/perf/mechanical edits.

FIX EVERYTHING IN THIS ORDER (finish each phase's gate before the next):
  PHASE 1  P0 Security  → P0_SECURITY_MASTER.md: build the customer-session primitive in @letbuyy/auth-core and a
           gateway requireCustomerSession middleware; rewrite verifyStoreCustomer (storefront.ts:1058) to authenticate,
           never trust body customer_id; gate orders/addresses/profile/wishlist; stop returning password_hash;
           tokenize password reset; remove by-email/status/contact-order public routes (internal-sign if still needed);
           enforce session on the GraphQL customer/order resolvers; bind identity set-password to a server-side OTP intent;
           unify CSRF cookie name to letbuyy_csrf across identity/gateway/mobile; cover public review/contact mutations;
           add a customer-auth rate limiter + Turnstile. (BETA BLOCKER)
  PHASE 2  Release Safety → P0-E: make missing release credentials a HARD failure (no silent skips; add `if: always()` +
           a "no required job skipped" gate); set Worker secrets BEFORE deploy (incl. CUSTOMER_SESSION_SECRET);
           add migration diff artifact + backup/restore point + manual-approval env before `supabase db push`;
           add FEATURE_GRAPHQL/EXTENSIONS/LIQUID flags defaulting OFF in production; build the smoke suite
           (identity login, storefront product read, checkout create, webhook bad-signature reject, queue health). (BETA BLOCKER)
  PHASE 3  P1 Cost  → sample worker_request_logs (100% errors/payment/admin, 1-5% anon GET); cron no-op + stop the
           always-on completion event; lower worker log sampling; collapse to one atomic rate-limit; batch queue writes
           (3->1) and make GraphQL bulk single-path; activate Hyperdrive pooled reads OR record the decision to drop it.
  PHASE 4  P2 Performance → edge-cache public REST storefront with purge-on-publish; pooled SQL for hot reads;
           de-hot the product view counter (event/rollup or atomic increment behind cache); keyset pagination + drop
           default exact counts; pg_trgm search indexes; async R2 export; variant diff + defer GST/usage off checkout.
  PHASE 5  P3 Scalability → partition+retention migrations 079-083 (windowed, staging-proven, *_legacy kept one cycle);
           move analytics/search to projections; consolidate dual JSONB/relational (085/086, readers->relational behind a flag);
           queue storm controls (deterministic-error quarantine, per-queue budgets, circuit breaker); fix GraphQL fan-out/N+1;
           THEN deploy WS11-13 to staging, run their suites against the deployed env, resolve the GraphQL cart stub, and
           graduate them on in production behind the flags.
  PHASE 6  P4 Product → multi-template theme editor (replace the hardcoded "Home page" pill); real GraphQL cart or a loud
           CART_NOT_SUPPORTED; API-ownership consolidation + a validator banning commerce logic in app-local routes;
           decide+wire developer-portal deploy; align docs/messaging with shipped capability.

DO NOT re-do the FALSE POSITIVES from the master plan: do NOT implement a Liquid renderer (it exists), do NOT "secure"
the operations routes (they have RBAC; only add MFA/step-up), do NOT rebuild app-bridge/OAuth validation (already
SSRF/redirect/scope hardened), do NOT add (…, created_at) indexes to the hot tables (they exist), do NOT add DB_ERROR
sanitization (the sanitizer already scrubs it — only add AUTH_ERROR to its allowlist).

UNIVERSAL LAWS (obey every phase):
- The Green Law: after EVERY commit the repo is green — run typecheck, lint, the area's tests/validators (flutter analyze
  + flutter test for mobile), and the full `node scripts/validate-governance.mjs` (128/128) at every phase gate. Never
  commit red. Can't go green in 3 attempts -> revert, log BLOCKED + diagnosis in CODEX_REMEDIATION_LEDGER.md, move on.
  Keep the build network-free (self-hosted fonts; never reintroduce next/font/google).
- Flag-guard every behavior change (customer-session, DB access path, caching, WS11-13) so rollback is a flag flip, not a
  redeploy. Migrations are additive-first and forward-only/fresh-replay-safe; never mutate prod; partition/data migrations
  only in an approved window. Never break a public contract (shared-types/api-client). Confirm-before-destructive only by
  logging the destructive step to SKIPPED — NEEDS HUMAN, then continuing elsewhere.
- Prove work for real: after a fix, run the relevant test (and the kill-chain red-team test for Phase 1). Every DONE =
  command + result. No fabrication — never claim a route is gated that still trusts body input, never fake a test.
- Skip-and-continue: anything human-gated (live keys, prod DB apply, Apple signing, paid signups, brand/copy/pricing,
  irreversible decisions) -> append to CODEX_REMEDIATION_LEDGER.md "## SKIPPED — NEEDS HUMAN" with the exact requirement
  and where it blocks, then immediately start the next unblocked task. Never block the whole program on one gate.
- WS11-13 stay OFF in production until Phase 5 proves them in deployed staging.

Maintain CODEX_REMEDIATION_LEDGER.md (current phase, gates passed, the append-only SKIPPED — NEEDS HUMAN list, and a
VALIDATOR LEDGER of 128/128 proofs). Write CODEX_REMEDIATION_STATUS.md when the success criteria are proven or no
unblocked work remains — COMPLETE only if the P0 + release-safety gates are proven, else BLOCKED — AWAITING HUMAN with
the exact remaining gates. Begin PHASE 1, task P0-A.1 (customer-session primitive), now.
```

---

## PART D — Recommended invocation (isolated, continuous)

```bash
# In an isolated VM/container with the repo checked out and deps available:
cd /path/to/Letbuyy_Store
git checkout -b stream/letbuyy-remediation

# config.toml as in A1 (model gpt-5.5, xhigh, approval never, workspace-write)
# Headless continuous run, paste the Part C prompt as the goal:
codex exec --ask-for-approval never --sandbox workspace-write \
  "$(cat docs/Codex_waves/REMEDIATION_GOAL.txt)"     # ← the Part C prompt saved to a file

# After any stop/compaction, resume the same thread:
codex exec resume --last
# (Only use --dangerously-bypass-approvals-and-sandbox / --yolo if this box is a throwaway, network-restricted VM.)
```

Interactive alternative: open Codex, set model **GPT‑5.5** + reasoning **Extra High**, run `/plan` to checkpoint Phase 1, then `/goal` with the Part C prompt.

---

## PART E — Differences from the old `CODEX_MASTER_SEQUENTIAL_MISSION.md`
| | Old (feature program) | This (remediation program) |
|---|---|---|
| Goal | Build WS7→WS10 features | Fix the VERIFIED findings from the final review |
| Order | WS7→WS1→WS11→…→WS10 | P0→Release→P1→P2→P3(+WS11-13 rollout)→P4 |
| Agent | Single agent, sequential | Single agent, sequential, **subagents explicitly forbidden** |
| Model | GPT‑5.5, xhigh foundations / medium pages | GPT‑5.5, **xhigh** security+DB+pipeline / **high** mechanical |
| Skip law | SKIPPED — NEEDS HUMAN | Same — note and move on |
| Anti‑waste | — | Explicit **do‑not‑redo FALSE‑POSITIVE** list |
| Run mode | continuous, many sessions | `codex exec` non‑interactive, durable‑memory resume, continuous |

## ONE‑LINE NORTH STAR
One agent, no subagents, GPT‑5.5 at Extra‑High: close the customer‑auth kill chain and the release gates first, then cost → performance → scale → product — green after every commit, skip‑and‑continue on every human gate, until the beta‑blocker gates are proven.

---

### Sources
- [Introducing GPT‑5.5 — OpenAI](https://openai.com/index/introducing-gpt-5-5/) (400K context in Codex, Fast mode, token efficiency, evals at xhigh)
- [Run long horizon tasks with Codex — OpenAI Developers](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex) (25‑hour run; durable‑memory + per‑milestone verification; `/plan`)
- [Codex Changelog — OpenAI Developers](https://developers.openai.com/codex/changelog) · [Codex Models](https://developers.openai.com/codex/models) (GPT‑5.5 in Codex; 5.2/5.3‑Codex sunset)
- [Configuration Reference — Codex](https://developers.openai.com/codex/config-reference) · [Advanced Config](https://developers.openai.com/codex/config-advanced) (`model`, `model_reasoning_effort=xhigh`, `approval_policy`, `sandbox_mode`)
- [Command line options — Codex CLI](https://developers.openai.com/codex/cli/reference) · [Non‑interactive mode](https://developers.openai.com/codex/noninteractive) (`codex exec`, `--ask-for-approval never`, `--sandbox workspace-write`, `--dangerously-bypass-approvals-and-sandbox`/`--yolo`, `--full-auto` deprecated)
- [Subagents — Codex](https://developers.openai.com/codex/subagents) (GA, up to 6; spawned only on request — so single‑agent = don't delegate)
- [Best practices — Codex](https://developers.openai.com/codex/learn/best-practices) · [Reasoning effort](https://developers.openai.com/codex/config-reference) (none/low/medium/high/xhigh)
