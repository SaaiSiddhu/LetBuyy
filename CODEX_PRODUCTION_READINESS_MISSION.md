# CODEX PRODUCTION-READINESS MISSION — LetBuyy "Shopify for India", Phase 3 (Make It Real)

**Driver:** GPT‑5.5 in Codex, reasoning effort `xhigh` for the migration baseline + real‑stack work, `medium` for mechanical edits.
**Mode:** Continuous, autonomous. Run as long as it takes (24h+). Never stop while an unblocked task remains.
**Predecessors (done):** `CODEX_FOUNDATION_MISSION.md` (Phases 0‑5), `CODEX_FEDERATION_MISSION.md` (Phases F0‑F8). State verified: 7 apps are thin clients, 286/286 tests pass, governance 128/128, full prod build passes — but **nothing has run against a real database** and **a fresh DB cannot be provisioned.** This mission removes every remaining production blocker.
**Governance posture (carried forward):** KEEP ALL 128 VALIDATORS GREEN at every commit. Never delete/weaken a validator; update governance memory in lockstep when an architecture change requires it. Anything needing a human *policy/credential* decision → `[SKIP — NEEDS HUMAN]` and continue.

---

## 0. PRIME DIRECTIVE

Make LetBuyy **provisionable and integration‑proven**: a brand‑new staging environment can be stood up from migrations alone, the J1‑J5 cross‑app journeys pass against **staging Postgres** (not mocks), the India‑native flows that need no external keys actually work, and the UI is premium and self‑contained (self‑hosted fonts, consistent Lucide icons). Close the entire production‑blocker list in one mission.

**SUCCESS CRITERIA — COMPLETE only when all are proven with recorded command evidence:**

1. **Fresh‑DB provisioning works.** `database/supabase/migrations/*` (or a squashed baseline) applies cleanly on a brand‑new staging Postgres with zero manual patching — proven by staging seed/deploy evidence.
2. **Real end‑to‑end passes.** `LETBUYY_E2E_REQUIRE_REAL_STACK=1` J1‑J5 Playwright journeys run green against **staging** (staging Postgres + staging gateway + deployed apps). No mock Commerce API anywhere in the proof path.
3. **India‑native that needs no keys is real, not scaffold.** COD checkout works end‑to‑end; GST invoicing is verified on a real order; at least **one online provider beyond Razorpay** (Cashfree **or** native UPI) has a real, testable implementation. Providers that genuinely require live keys keep honest, clearly‑surfaced "configure credentials" states (not fake success).
4. **Build is self‑contained.** `pnpm turbo build` succeeds with **no network fetch** — fonts are self‑hosted (`next/font/local`), no `next/font/google` / `fonts.googleapis.com` calls remain.
5. **Premium UI.** All 7 apps render icons via **`lucide-react`** through the one design system (no emoji/ad‑hoc inline SVG for UI affordances), with a consistent self‑hosted premium font pairing wired in `@letbuyy/ui`.
6. **Every human‑gated item is recorded** in `CODEX_PRODUCTION_LEDGER.md` under `SKIPPED — NEEDS HUMAN` with exact commands (live keys, social OAuth, payout rails, Resend, prod DB apply).
7. `pnpm turbo typecheck`, `pnpm run validate:governance` (128/128), `pnpm lint`, `pnpm turbo build`, full `node --test`, and the real‑stack Playwright suite all pass.
8. `CODEX_PRODUCTION_STATUS.md` summarizes the run; mark COMPLETE only if criteria 1‑7 are genuinely green on the real stack.

---

## 1. OPERATING CONTRACT (how you must run)

1. **Continuous execution.** Finish a task → update ledger → start the next unblocked task. Never pause to ask. Never end while unblocked tasks remain.
2. **The Green Law.** Tree is green after every commit: area validators + `pnpm turbo typecheck` + `pnpm lint` each increment; full `pnpm run validate:governance` at every phase gate. Never commit red. Can't go green in 3 attempts → revert, log `BLOCKED` with diagnosis, move on.
3. **The REAL‑E2E Law (unchanged).** UI/cross‑app proof runs against staging Supabase + the staging gateway. Mocks are forbidden as proof. If staging is not credentialed/deployed, record `[SKIP — NEEDS HUMAN: staging deploy + secrets]` for live proof only.
4. **DATABASE SAFETY (critical).** NEVER mutate production. The migration baseline is built and validated **only against disposable staging database targets**. Applying a baseline to an already‑provisioned environment is explicitly out of scope and human‑gated. Do not edit historical migration *intent* in place destructively — archive originals, don't delete.
5. **Small reversible increments.** One logical change → validate → commit. Hundreds of small green commits over one big red one.
6. **Human‑skip ledger (mark and continue).** Anything needing live secrets (Razorpay live, Supabase service‑role, Cloudflare, Vercel, Resend, OAuth provider creds), production DB apply, remote git, paid signups, or policy/pricing/legal → append to `CODEX_PRODUCTION_LEDGER.md` under `## SKIPPED — NEEDS HUMAN` with exact command/decision, then continue.
7. **Anti‑ceremony.** No new validators, no new top‑level docs beyond the two ledger/status files, no new services, no business‑logic Next.js API routes. Reuse existing packages.
8. **No fabrication.** Every `DONE` needs command + result evidence. Never fake a test, never claim a provider works when it throws, never call a mock run "end‑to‑end." Self‑verify UI in a real browser with screenshots.
9. **Anti‑thrash.** Max 3 attempts per task → log `BLOCKED` + diagnosis → next task. Never loop on one error.
10. **Respect existing law.** Obey `AGENTS.md`, `CLAUDE.md`, `docs/governance/`, the Deprecated Runtime Policy, and migration governance. Update governance memory in the same commit when a change requires it.

---

## 2. THE BLOCKER MAP (what this mission closes)

- **P0 🔴 Migration replay broken (master blocker).** `004_plan_alignment.sql` was retired to a no‑op, but ~15 later migrations still assume it ran: `super_admin_allowlist` is never `CREATE`d (referenced by `011` line 78), `products.site_id` is never renamed to `store_id` (breaks `027`/`031`). Fresh DBs cannot be built. **Fix this first — everything else depends on it.**
- **P1 🔴 Nothing has run against real data.** J1‑J5 only pass statically. Boot the real stack and run them for real.
- **P2 🟠 India‑native mostly scaffold.** Only Razorpay works; UPI/PhonePe/Cashfree/COD/logistics throw "scaffolded." Make the no‑key ones real (COD, GST) + one real online provider.
- **P3 🟠/🟡 UI + build fragility.** `next/font/google` fetches Inter at build (network‑fragile); icons are inconsistent. Self‑host premium fonts + standardize Lucide via the design system.
- **P4 🟡 Human‑gated prerequisites.** Live keys, social OAuth (currently disabled), Resend email, payout rails — document precisely as SKIPs.

---

## 3. ARCHITECTURE INVARIANTS (never violate)

- One backend (`api-gateway`), one contract (`shared-types`/`api-client`), one identity verifier (`auth-core`), async via the event spine, outbound webhooks only from `webhook-service`, themes data‑only, **one design system (`@letbuyy/ui`)** consumed by all 7 apps.
- **Migrations must fresh‑replay** on an empty DB with no manual steps. New migrations are append‑only and forward‑safe.
- **No runtime network at build time.** Fonts self‑hosted; assets repository-owned or deployment-owned.
- INR‑first money; COD and GST are first‑class.

---

## 4. LEDGER — create and maintain `CODEX_PRODUCTION_LEDGER.md`

```
# CODEX PRODUCTION LEDGER — started <ISO ts>

## BASELINE
- typecheck / governance(128) / lint / build / test : <results>
- fresh-DB replay status BEFORE fix : FAIL at <migration> (evidence)

## PROGRESS LOG (newest first)
- <ts> [P#.#] <task> — DONE — evidence: <cmd> -> <result> — commit <sha>
- <ts> [P#.#] <task> — BLOCKED — tried A/B/C — error — hypothesis

## SKIPPED — NEEDS HUMAN   (append-only)
- [SKIP] <task> — requires <exact cmd/cred/decision> — unblocks <tasks>

## REAL-E2E LEDGER   (append-only)
- <ts> <journey> vs REAL stack -> PASS (screenshots) | FAIL <why>

## VALIDATOR LEDGER   (append-only)
- <ts> validate:governance -> 128/128 PASS after <sha>
```

---

## 5. THE WORK — P0 → P4 (in order; don't start a phase until the prior gate is green)

### P0 — Repair migration replay so a fresh DB provisions (MASTER UNBLOCK)

Goal: a brand‑new empty Postgres can be built from the repo with zero manual patching. Strategy: **achieve one clean replay in a throwaway working copy, then squash to a verified baseline** (Option A), archiving history. Never touch any existing DB.

- **P0.1 Reproduce the failure.** On a disposable staging Postgres target, apply `database/supabase/migrations/001…072` in order and record the exact first failure (expected: `011` → `super_admin_allowlist` missing). Log it in BASELINE. _DoD: failure reproduced + recorded._
- **P0.2 Reconstruct the true current schema.** In a **throwaway working copy only** (never the tracked files yet, never a real DB), restore the retired body of `004_plan_alignment.sql` (the `site_id→store_id` renames + `super_admin_allowlist` creation + any tables it created) and re‑apply `001…072`. Iteratively fix any remaining historical drift (e.g. `031` stores‑view mismatch) in the working copy until the full chain applies clean on an empty DB. This reproduces the schema your live DBs actually have. _DoD: 001→072 applies with 0 errors on a fresh DB in the working copy._
- **P0.3 Generate the verified baseline.** `pg_dump --schema-only` the resulting database into `database/supabase/migrations/000_baseline.sql` (a single, fresh‑replay‑safe schema incl. RLS, functions, triggers, and the mission tables 067/070/071/072). _DoD: baseline file produced._
- **P0.4 Prove equivalence.** Boot two throwaway DBs: one from `000_baseline.sql` alone, one from the P0.2 clean chain. Diff their schemas (`pg_dump --schema-only` both, compare). They must be identical — the baseline must not change the data model. _DoD: schema diff is empty; evidence logged._
- **P0.5 Archive history (reversible).** Move `001…072` into `docs/archive/migrations-history/` (do NOT delete). Keep `000_baseline.sql` as the sole active migration; new migrations continue at `073_*`. Update any migration‑governance memory/manifest in the same commit so governance stays 128/128. _DoD: only baseline (+ any new 073+) active; governance green._
- **P0.6 Wire staging to the baseline.** Keep `scripts/staging/seed.mjs` able to seed demo data (≥1 store, products, ≥2 themes, a partner + app) against an explicit staging database URL, verify staging gateway `/health` 200 and a **real** product query. _DoD: staging deploy + seed proves real data from scratch — no manual patching._

**GATE P0:** governance 128/128; staging deploy + seed proves a real Supabase from the baseline with seeded data; equivalence proof recorded. (If staging is not credentialed/deployed, the baseline + equivalence diff must still be produced and committed, and only the *live proof* may be `[SKIP — NEEDS HUMAN: staging deploy + secrets]` with exact run commands.)

### P1 — Run J1‑J5 against STAGING (close the REAL‑E2E law)

- **P1.1 Deploy + smoke.** With staging ready from P0, hit each app and the gateway; fix anything that only worked against mocks. _DoD: all apps + gateway serve real staging data._
- **P1.2 Run the journeys for real.** `LETBUYY_E2E_REQUIRE_REAL_STACK=1 pnpm exec playwright test tests/e2e/federation --project=chromium`. Capture screenshots/attachments per journey. _DoD: J1‑J5 execute (not skip) against staging._
- **P1.3 Fix what breaks.** Staging data will surface real bugs (RLS, missing seed, contract drift). Fix each as a small green increment until J1‑J5 are green. _DoD: J1 SSO, J2 app lifecycle, J3 theme lifecycle, J4 commerce+events, J5 customer SSO all PASS on staging._

**GATE P1:** governance 128/128; J1‑J5 green on the real stack with screenshots in the REAL‑E2E LEDGER.

### P2 — India‑native: make the no‑key flows real

- **P2.1 COD end‑to‑end.** Cash‑on‑Delivery needs no external credentials — implement it fully: COD as a selectable method, order placed in a `pending_cod` state, confirmation, and the order lifecycle/events firing. Prove it in the real checkout journey. _DoD: a real COD order completes end‑to‑end on staging._
- **P2.2 GST verified on a real order.** Confirm CGST/SGST/IGST split + GST invoice generate correctly for a real intra‑state and inter‑state order (the calc already exists in `checkout-core`). _DoD: a correct GST invoice is produced for a real order._
- **P2.3 One real online provider.** Implement **Cashfree OR native UPI** for real against its **test/sandbox** mode (create order → verify → webhook) behind the existing `PaymentProvider` interface. Live keys → `[SKIP — NEEDS HUMAN]`, but the code path must be real, not a `throw "scaffolded"`. _DoD: the chosen provider runs a real test‑mode charge + webhook verify; remaining providers keep honest "configure credentials" UI states (no fake success)._

**GATE P2:** governance 128/128; real COD + GST + one online provider proven on the real stack.

### P3 — Premium UI: self‑hosted fonts + Lucide icons (also fixes build fragility)

- **P3.1 Self‑host fonts (kills the Google‑Fonts build dependency).** Replace all `next/font/google` usage (starting with `apps/merchant-control-plane/src/app/layout.tsx`) with `next/font/local` using **self‑hosted, license‑clean (OFL/Apache) premium fonts**. Pick a tasteful pairing — e.g. a modern grotesque/sans for UI + a slightly characterful display face for headings (e.g. Geist / Inter / Manrope / Plus Jakarta Sans / Sora — all OFL). Commit the font files under the design system; expose font CSS variables/tokens from `@letbuyy/ui`. _DoD: no `next/font/google` or `fonts.googleapis.com` anywhere; `pnpm turbo build` succeeds with no network font fetch._
- **P3.2 Standardize Lucide icons via the design system.** `lucide-react` is already a dependency (66 files). Centralize an icon set/wrapper in `@letbuyy/ui`, migrate all 7 apps to it, and replace emoji or ad‑hoc inline SVGs used as UI affordances with consistent Lucide icons (size/stroke tokens). _DoD: UI icons come from the shared Lucide layer; no emoji/ad‑hoc SVG affordances remain in the 7 apps._
- **P3.3 Visual proof.** With the real stack up, screenshot the admin, storefront, and one marketplace before/after to confirm consistent typography + iconography. _DoD: screenshots recorded; no visual regressions._

**GATE P3:** governance 128/128; build green with no network; icon/font consistency proven by screenshots.

### P4 — Production prerequisites (document precisely, don't fake)

- **P4.1 Env + secrets templating.** Ensure every required secret is templated (`config/env/*`) with placeholders only; list each under SKIP with where to obtain it (Razorpay live, Supabase service‑role, Cloudflare, Vercel, Resend, OAuth provider IDs/secrets). _DoD: templates complete; SKIP list exact._
- **P4.2 Config‑gated real paths.** Social OAuth (currently disabled), Resend email, and Razorpay Route/UPI payout rails must be wired so that *providing the key* turns them on — no code change needed later. Keys themselves → SKIP. _DoD: each path is one config value away from live; documented._
- **P4.3 Deploy readiness note.** In the ledger, record the exact human steps to provision staging/prod from the baseline (apply `000_baseline.sql` to the new DB, set secrets, deploy). Do NOT execute against any real environment. _DoD: human runbook recorded as SKIP._

**GATE P4 (FINAL):** every §0 criterion proven green on the real stack (or precisely SKIP‑recorded for live‑credential‑only items); full typecheck/lint/build(no‑net)/test/governance + real J1‑J5 green.

---

## 6. FINAL REPORT — write `CODEX_PRODUCTION_STATUS.md`

Per‑phase table; §0 criteria with PASS/FAIL + evidence; the full SKIPPED — NEEDS HUMAN list with exact commands; and final results (fresh‑DB provision proof, real J1‑J5, build‑no‑net, governance 128/128). Mark COMPLETE only if criteria 1‑7 are genuinely green on the real stack; otherwise `BLOCKED — AWAITING HUMAN` with exact remaining gaps. Never claim provisioning or end‑to‑end works unless it ran for real.

---

## 7. LAUNCH PROMPT (paste into Codex `/goal`)

```
Read CODEX_PRODUCTION_READINESS_MISSION.md, CODEX_FEDERATION_MISSION.md, and
LETBUYY_DEEP_AUDIT_AND_SHOPIFY_BLUEPRINT.md in full.
Execute CODEX_PRODUCTION_READINESS_MISSION.md, Phases P0→P4, continuously and autonomously.

Hard rules (obey strictly):
- P0 FIRST: make a fresh empty Postgres provision cleanly. Reproduce the replay failure, restore
  retired 004 logic in a THROWAWAY working copy, get one clean 001->072 replay, pg_dump a verified
  000_baseline.sql, prove schema-equivalence, archive 001..072 to docs/archive (never delete).
- DATABASE SAFETY: never mutate production; validate only against disposable staging database targets.
- REAL-E2E LAW: after P0, deploy/seed staging and run J1-J5 against staging Postgres. Mocks are
  forbidden as proof. Do not SKIP staging proof unless staging deploy/secrets are genuinely unavailable.
- Make COD + GST real (no keys needed) and one online provider (Cashfree or UPI) real in test mode.
- Self-host premium fonts (kill next/font/google) and standardize lucide-react icons via @letbuyy/ui.
- Keep all 128 validators green after every commit; full validate:governance at each gate.
- Do NOT stop between tasks. Human-gated items (live keys, prod DB apply, social OAuth, Resend, payout
  rails) -> append to CODEX_PRODUCTION_LEDGER.md under "SKIPPED — NEEDS HUMAN" with exact commands, then continue.
- Small reversible commits; max 3 attempts per task then log BLOCKED and move on.
- No new validators/docs/services or business-logic API routes. No fabrication: every DONE needs
  command+result evidence; self-verify UI in a real browser with screenshots.
- xhigh reasoning for the migration baseline + real-stack work; medium for mechanical edits.

Maintain CODEX_PRODUCTION_LEDGER.md from task P0.1. When the §0 criteria are green on the real stack,
write CODEX_PRODUCTION_STATUS.md. Begin with P0.1 now.
```

---

## 8. ONE‑LINE NORTH STAR

A new environment boots from one clean baseline, the real journeys pass on real data, COD/GST work, and every screen is premium and self‑contained — that is "fundamentally strong."
