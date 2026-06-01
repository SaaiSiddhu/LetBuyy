# CODEX FEDERATION MISSION — LetBuyy "Shopify for India", Phase 2 (Cross-App Federation)

**Driver:** GPT‑5.5 in Codex, reasoning effort `xhigh` for federation/architecture, `medium` for mechanical edits.
**Mode:** Continuous, autonomous, local. Run as long as it takes (designed for a 24h+ session). Never stop while an unblocked task remains.
**Predecessor:** `CODEX_FOUNDATION_MISSION.md` (done — Phases 0‑5) plus the verified state in `LETBUYY_DEEP_AUDIT_AND_SHOPIFY_BLUEPRINT.md`. This mission is **Phase 2**: federate the 5 unmigrated apps and make every surface talk to every other surface the way Shopify does.
**Governance posture (carried forward):** KEEP ALL 128 VALIDATORS GREEN at every commit. Never delete or weaken a validator. You MAY update governance *memory/expectations* (manifests, allowlists, topology) in lockstep with a change. Anything needing a human *policy* decision → `[SKIP — NEEDS HUMAN]` and continue.

---

## 0. PRIME DIRECTIVE

Phase 1 collapsed `merchant-control-plane` and `storefront-runtime` onto one Commerce API. **Five web apps were never migrated and do not properly talk to each other:** `identity-platform`, `app-marketplace`, `theme-marketplace`, `platform-console`, `platform-operations-portal`. Finish the federation so LetBuyy is structurally Shopify‑for‑India: one identity, one API, one event spine, one design system, and Shopify‑equivalent flows between every app — **and prove it end‑to‑end against a REAL local stack, not mocks** (the gap the last run left open).

**SUCCESS CRITERIA — the mission is COMPLETE only when all are proven green with recorded command evidence:**

1. **All 7 web apps** are thin clients of the gateway: zero `@supabase/*` imports under `apps/**`, zero local domain types, all data via `@letbuyy/api-client` with `@letbuyy/shared-types`. (Currently only 2 of 7.)
2. **One identity:** `identity-platform` is the single issuer; every app verifies the same `lb_session` (staff/merchant) and `lb_customer_session` (shopper) through the one `@letbuyy/auth-core` verifier; RBAC roles (store / organization / partner / ops categories) enforced at the gateway. No per‑app auth copies.
3. **They talk to each other** via: (a) the gateway for sync calls, (b) a schema‑enforced **event spine** (`@letbuyy/event-core` + `services/queue-workers`) for async domain events, (c) `services/webhook-service` for outbound webhooks with HMAC + mandatory compliance topics.
4. **App Store federation:** an app can be created in `platform-console`, reviewed/approved in `platform-operations-portal`, installed by a merchant from `app-marketplace` via OAuth, render an app block in the storefront, and bill via the Billing API with a recorded payout ledger entry.
5. **Theme Store federation:** a theme can be submitted in `platform-console`, reviewed/approved in `platform-operations-portal`, listed in `theme-marketplace`, installed into a store, and rendered — zero storefront code change.
6. **One design system:** the 3 UI packages are consolidated into one shared package consumed by all 7 apps; the dead ones are archived.
7. **REAL end‑to‑end:** the cross‑app E2E suite in section 5/F8 runs against a **real local Supabase + real gateway** (no mock Commerce API). If the sandbox truly cannot run a real DB after genuine attempts, the suite still must EXIST and pass its static/contract layer, and the live‑DB execution is the only part allowed to be `[SKIP — NEEDS HUMAN]` with exact run commands.
8. `pnpm turbo typecheck`, `pnpm run validate:governance` (128/128), `pnpm lint`, `pnpm turbo build`, and the full test + Playwright suites pass.
9. `CODEX_FEDERATION_LEDGER.md` shows every task `DONE` (with evidence) or `[SKIP — NEEDS HUMAN]`; `CODEX_FEDERATION_STATUS.md` summarizes the run.

---

## 1. OPERATING CONTRACT (how you must run)

1. **Continuous execution.** Finish a task → update ledger → immediately start the next unblocked task. Never pause to ask. Never end the session while unblocked tasks remain.
2. **The Green Law.** After every commit the tree is green: run area validators + `pnpm turbo typecheck` + `pnpm lint` each increment, and the full `pnpm run validate:governance` at every phase gate. Never commit red. If a change can't be made green in 3 attempts, revert it, log `BLOCKED` with diagnosis, move on.
3. **The REAL‑E2E Law (new, non‑negotiable).** UI and cross‑app verification must run against a **real local Supabase + real local gateway**, never a mock Commerce API. Before any smoke: bring up a real DB (`supabase start` or local Postgres via Docker), apply `database/supabase/migrations/*`, seed demo data, run the gateway worker against it, then drive Playwright/the browser against that real stack. Mock gateways are forbidden as proof of done. Only if a real DB genuinely cannot run in this environment (after escalation attempts) may you mark the *live execution* `[SKIP — NEEDS HUMAN]` — and you must still commit the runnable real‑stack test code and a `scripts/dev/local-stack-up.mjs` that a human can run.
4. **Small reversible increments.** One logical change → validate → commit. Prefer hundreds of small green commits over one big red one.
5. **Human‑skip ledger (mark and continue).** Anything a local agent can't safely do → append to `CODEX_FEDERATION_LEDGER.md` under `## SKIPPED — NEEDS HUMAN` with the exact command/credential/decision + why, then continue. SKIP triggers: live secrets/keys (Razorpay live, Cloudflare, Supabase service‑role, Vercel, Resend), production DB mutations, remote git, irreversible deletes outside `docs/archive/`, paid 3rd‑party signups, policy/pricing/legal decisions, DNS/Vercel/Cloudflare resource creation.
6. **Anti‑ceremony guardrails.** Do NOT add new validators, new top‑level docs (beyond the two ledger/status files), new runtime services, or new Next.js API routes that contain business logic. This mission REDUCES surface area and consolidates. Reuse existing packages (`event-core`, `notification-core`, `auth-core`, `app-engine`, `billing-core`, `api-client`).
7. **No fabrication.** Every `DONE` needs the command + result as evidence. Never fake a test, never stub‑and‑claim‑done, never write a mock and call it end‑to‑end. Self‑verify UI in a real browser.
8. **Anti‑thrash.** Max 3 attempts per task → log `BLOCKED` with precise diagnosis → next task. Never loop on one error.
9. **Reasoning effort.** `xhigh` for: identity/RBAC design, the event spine, OAuth/billing federation, the real‑stack harness. `medium` for: route migrations, import rewrites, file moves.
10. **Respect existing law.** Obey `AGENTS.md`, `CLAUDE.md`, `docs/governance/`. When the federation changes a governance expectation, update governance memory in the same commit so the suite stays green and honest.

---

## 2. THE SHOPIFY → LETBUYY FEDERATION BLUEPRINT (build THIS)

Reference model from research. Build the LetBuyy‑native, India‑first equivalent — do not bolt on Shopify SDKs.

**Identity (`identity-platform` = Shopify ID / OIDC).** One identity per *user* (staff/merchant/partner), trusted by every app. Short‑lived signed session tokens (`lb_session`) verified by ONE `@letbuyy/auth-core` verifier; shoppers use `lb_customer_session` (passwordless OTP + a Multipass‑style single‑use 15‑min cross‑domain token). RBAC = roles, not raw permissions; role categories: **store**, **organization**, **partner**, **ops**. accounts hub redirects + token exchange for embedded apps.

**One API front door (`api-gateway`).** Every admin surface calls it through `@letbuyy/api-client`. Add **calculated query‑cost rate limiting** (leaky bucket, points/sec) and date‑based API versioning. Storefront keeps its read path.

**Event spine (Monorail‑on‑Kafka → `event-core` + `queue-workers`).** Schema‑enforced, versioned domain events with explicit producer→consumer contracts: `order.*`, `product.*`, `app.installed/uninstalled`, `app.charge.*`, `theme.submitted/approved/installed`, `store.created`. Consumers drive notifications, analytics, search indexing, payouts.

**Webhooks (`webhook-service`).** Outbound delivery to apps/partners over HTTPS with `X-LetBuyy-Hmac-SHA256` (raw‑body HMAC), plus optional queue destination. **Mandatory compliance topics** every installed app must receive: `customers/data_request`, `customers/redact`, `shop/redact` (return 401 on bad HMAC).

**App Store (`app-marketplace`).** OAuth authorization‑code grant for standalone + token‑exchange for embedded; space‑separated scopes (`read_products write_orders` …); App Bridge embed (extend the Phase 4.4 bridge); **Billing API** (recurring + usage, merchant approve → activate → revenue‑share payout); app blocks + theme app extensions + (future) functions; declarative app config; a "Built‑for‑LetBuyy" quality gate (perf + reviews + installs).

**Theme Store (`theme-marketplace`).** Submit → automated checks → human review → list; install into shop; portable bundle from Phase 3 (no storefront code change).

**Partner console (`platform-console` = Partner Dashboard + Partner API).** Manage app/theme listings, **payouts** (India: Razorpay Route/RazorpayX, UPI, INR, with GST on partner earnings), development stores, **collaborator access** (request codes, "managed stores"), and analytics (installs/uninstalls/charges/earnings). Expose a Partner API for headless management.

**Ops portal (`platform-operations-portal` = internal staff / Trust & Safety).** App + theme **review queues**, policy enforcement, store/merchant moderation, payout operations, and scoped impersonation/support access. Ops actions emit events and are RBAC‑gated to the `ops` role category.

**Consistency layer (Polaris → one design system).** Consolidate `packages/ui`, `packages/ui-system`, `packages/typescript/ui` into ONE shared design‑system package consumed by all 7 apps; archive the losers. Framework‑agnostic tokens; consistent admin shell across merchant + the 5 federated apps.

---

## 3. ARCHITECTURE INVARIANTS (never violate)

- One backend: `services/api-gateway`. One contract: `@letbuyy/shared-types` (+ generated `@letbuyy/api-client`). Apps are thin clients only.
- One identity verifier in `@letbuyy/auth-core`; no per‑app session logic.
- Async cross‑app communication goes through the event spine, not direct app‑to‑app calls.
- Outbound webhooks only from `webhook-service`. Inbound provider webhooks only land there too.
- Themes stay data‑only (Phase 3). Apps extend storefront only via app blocks.
- One design system package. No app may fork UI primitives.
- INR‑first money everywhere; partner payouts and GST are India‑native.

---

## 4. LEDGER — create and maintain `CODEX_FEDERATION_LEDGER.md`

```
# CODEX FEDERATION LEDGER — started <ISO ts>

## BASELINE (F0)
- typecheck / governance(128) / lint / build / test : <results>
- real local stack up? supabase+gateway+apps : <yes/no + evidence or SKIP reason>

## PROGRESS LOG (newest first)
- <ts> [F#.#] <task> — DONE — evidence: <cmd> -> <result> — commit <sha>
- <ts> [F#.#] <task> — BLOCKED — tried A/B/C — error — hypothesis

## SKIPPED — NEEDS HUMAN   (append-only)
- [SKIP] <task> — requires <exact cmd/cred/decision> — unblocks <tasks>

## VALIDATOR LEDGER   (append-only)
- <ts> validate:governance -> 128/128 PASS after <sha>

## REAL-E2E LEDGER   (append-only)
- <ts> <journey> against REAL stack -> PASS (screenshots/paths) | SKIP(live-exec) with run cmds
```

---

## 5. THE WORK — PHASES F0 → F8 (in order; don't start a phase until the prior gate is green)

### F0 — Baseline + the REAL local stack (no mocks ever again)

- **F0.1 Baseline.** `pnpm install`; record `typecheck`, `validate:governance` (128), `lint`, `build --dry-run`, `test` in the ledger. _DoD: baseline recorded._
- **F0.2 Real local stack harness.** Create `scripts/dev/local-stack-up.mjs` and `local-stack-down.mjs` that: start a real Supabase (`supabase start`, or Postgres via Docker), apply `database/supabase/migrations/*` (incl. `067`), seed demo data (≥1 store, products, ≥2 themes, a demo partner + app), then boot the `api-gateway` worker against that DB and all 7 apps on their local ports. _DoD: one command brings up a real, seeded stack; `/health` 200; a real product query returns seeded data — NOT a mock._ If a real DB cannot run here after genuine attempts (incl. escalation), `[SKIP — NEEDS HUMAN]` the live boot but still commit the scripts and seeds.
- **F0.3 Kill mock harnesses.** Remove/neutralize any `.codex/*mock*` or mock‑Commerce‑API smoke helpers from Phase 1 so no future task can "pass" against a mock. _DoD: grep shows no mock gateway used by tests._

**GATE F0:** governance 128/128; real stack boots (or live‑boot SKIP recorded with scripts committed).

### F1 — Identity federation (the spine of "talk to each other")

- **F1.1 Issuer + verifier.** Make `identity-platform` the single issuer; confirm ALL apps verify `lb_session`/`lb_customer_session` via the one `@letbuyy/auth-core` verifier (extend Phase 1.7 to the 5 apps). Delete any per‑app cookie/JWT logic. _DoD: one verifier; cross‑app auth test covers all 7 apps._
- **F1.2 RBAC role categories.** In `auth-core` + gateway middleware, implement roles with categories **store / organization / partner / ops**, multiple roles per user, predefined roles (Administrator, Merchandiser, Support, Partner, Ops‑Reviewer). Gateway enforces per‑route. _DoD: a partner token cannot hit ops routes; test proves it._
- **F1.3 SSO across the 5 apps.** `app-marketplace`, `theme-marketplace`, `platform-console`, `platform-operations-portal` redirect unauthenticated users to `identity-platform` and accept the shared session. _DoD: logging in once grants all 5 (real‑stack browser proof)._
- **F1.4 Shopper federation.** Implement the Multipass‑style single‑use 15‑min token so a customer session can be federated into the storefront from another origin. _DoD: token mints, redeems once, expires; test._

**GATE F1:** governance 128/128; real‑stack SSO journey passes across all surfaces.

### F2 — Migrate the 5 apps to the typed client (thin clients)

For EACH app — `identity-platform`, `app-marketplace`, `theme-marketplace`, `platform-console`, `platform-operations-portal` — do a bounded slice per domain:

- **F2.x** Replace direct Supabase / bespoke `worker-client.ts` calls with `@letbuyy/api-client`; add missing client methods + `shared-types` contracts in the gateway where gaps exist; delete local domain types; keep the app as presentation only. Run the **real‑stack** smoke for that app after each slice. Remove the app from the ESLint boundary baseline once clean (flip to ERROR). _DoD per app: 0 `@supabase/*`, 0 local domain types, real‑stack smoke green._
- Special: `theme-marketplace` still imports Supabase directly (`src/lib/supabase/client.ts`) — that must go.

**GATE F2:** all 7 apps clean against the boundary rule; governance 128/128; each app's real‑stack smoke green.

### F3 — The async event spine

- **F3.1 Event contracts.** In `@letbuyy/event-core`, define schema‑enforced, versioned domain events with explicit producer→consumer contracts: `store.created`, `product.*`, `order.*`, `app.installed/uninstalled`, `app.charge.created/activated`, `theme.submitted/approved/installed`, `payout.*`. _DoD: events validate; registry typed._
- **F3.2 Producers.** Gateway emits these events on the relevant mutations (outbox pattern already present). _DoD: a real install/charge/order emits the event to the outbox._
- **F3.3 Consumers.** `services/queue-workers` consumes and fans out to `notification-core`, analytics, search, payouts. _DoD: a real‑stack order produces a notification + analytics record via the worker, proven end‑to‑end._

**GATE F3:** governance 128/128; real‑stack event flow (produce→consume→side‑effect) proven.

### F4 — Webhooks + compliance

- **F4.1 Outbound webhooks.** `webhook-service` delivers app/partner webhooks over HTTPS with raw‑body HMAC (`X-LetBuyy-Hmac-SHA256`) + retry; subscriptions declared per app. _DoD: signed delivery + verification test._
- **F4.2 Mandatory compliance topics.** Every installed app must be subscribed to `customers/data_request`, `customers/redact`, `shop/redact`; invalid HMAC → 401. _DoD: compliance webhook test green; install flow auto‑subscribes._

**GATE F4:** governance 128/128; webhook delivery + compliance tests green.

### F5 — App Store federation

- **F5.1 OAuth.** Authorization‑code grant (standalone) + token‑exchange (embedded) with scopes; consent screen; per‑app scoped tokens (extend Phase 4.2). _DoD: real OAuth install issues a scoped token._
- **F5.2 App Bridge embed.** Extend the Phase 4.4 bridge so any installed app renders embedded in `app-marketplace`/admin with a session‑token JWT verified on every call. _DoD: example app embeds + calls gateway via bridge on the real stack._
- **F5.3 Billing + payouts (India).** Billing API (recurring + usage) → merchant approve → activate → **payout ledger** with revenue share; India payout rails (Razorpay Route/RazorpayX/UPI, INR, GST on earnings) scaffolded with one real path; live keys → SKIP. _DoD: charge→approve→activate→payout‑ledger entry on the real stack (test mode)._
- **F5.4 Extensions + quality gate.** App blocks (Phase 4.1) + a "Built‑for‑LetBuyy" check (perf/reviews/installs) before listing. _DoD: an app block renders; quality gate blocks a failing app._

**GATE F5:** governance 128/128; full app lifecycle (create→review→install→embed→bill→payout) proven on the real stack.

### F6 — Theme Store + Partner console + Ops portal federation

- **F6.1 Submission pipeline.** `platform-console` submits an app/theme → automated checks → status reflected to the partner. _DoD: submit creates a review record + event._
- **F6.2 Review queues (ops).** `platform-operations-portal` lists pending app/theme submissions, approves/rejects with reasons (RBAC `ops`), emitting `*.approved/rejected` events that publish to the marketplaces. _DoD: ops approval lists the item in the marketplace on the real stack._
- **F6.3 Partner console surfaces.** Listings management, payouts view (INR/GST), development stores, collaborator access (request codes + managed stores), analytics (installs/uninstalls/charges/earnings) — all via the gateway + Partner API. _DoD: a partner sees real analytics + payout ledger for their app._
- **F6.4 Theme install.** Approved theme → listed in `theme-marketplace` → installed into a store → rendered with zero storefront code change (Phase 3 bundle). _DoD: real‑stack theme submit→approve→install→render journey green._

**GATE F6:** governance 128/128; both marketplace lifecycles proven end‑to‑end on the real stack.

### F7 — Consistency: one design system + one API discipline

- **F7.1 Consolidate UI.** Merge `packages/ui`, `packages/ui-system`, `packages/typescript/ui` into ONE design‑system package; migrate all 7 apps to it; archive the losers to `docs/archive/`. _DoD: one UI package; all apps import it; governance green._
- **F7.2 Rate limiting + versioning.** Add calculated query‑cost rate limiting + date‑based API versioning to the gateway. _DoD: over‑cost query is throttled; version header honored; tests._

**GATE F7:** governance 128/128; all apps on one design system; build green.

### F8 — REAL end‑to‑end suite (the proof) + final gate

Author cross‑app journeys under `tests/e2e/federation/*` that run against the **real local stack** (F0.2), no mocks:

- **J1 Identity SSO:** one login → access merchant + all 5 federated apps; RBAC denies cross‑category access.
- **J2 App lifecycle:** partner creates app (console) → ops approves → merchant installs via OAuth (marketplace) → app embeds via bridge → renders app block in storefront → bills → payout ledger entry → uninstall fires compliance webhook.
- **J3 Theme lifecycle:** partner submits theme → ops approves → lists → merchant installs → storefront renders it (2nd theme, no code change).
- **J4 Commerce + events:** create order on storefront → event spine → notification + analytics + (Razorpay test) payment + GST invoice.
- **J5 Customer SSO:** passwordless OTP + Multipass federation into storefront.

Each journey: run on the real stack, capture screenshots, record in the REAL‑E2E LEDGER. Then run the FINAL gate: `typecheck`, `lint`, `pnpm turbo build`, full `node --test`, full Playwright incl. `tests/e2e/federation/*`, and `validate:governance` 128/128.

**GATE F8 (FINAL):** every success criterion in §0 proven green on the real stack, or precisely marked `[SKIP — NEEDS HUMAN]` (live‑exec only).

---

## 6. FINAL REPORT — write `CODEX_FEDERATION_STATUS.md`

Per‑phase completion table; the §0 success criteria with PASS/FAIL + evidence; the full `SKIPPED — NEEDS HUMAN` list; and the final validator/typecheck/build/test/real‑E2E results. Mark the mission `COMPLETE` only if all §0 criteria are proven green on the real stack; otherwise `BLOCKED — AWAITING HUMAN` with the exact remaining gaps. Do not claim end‑to‑end unless it ran against a real DB.

---

## 7. LAUNCH PROMPT (paste into Codex `/goal`)

```
Read CODEX_FEDERATION_MISSION.md, CODEX_FOUNDATION_MISSION.md, and
LETBUYY_DEEP_AUDIT_AND_SHOPIFY_BLUEPRINT.md in full.
Execute CODEX_FEDERATION_MISSION.md, Phases F0→F8, continuously and autonomously.

Hard rules (obey strictly):
- REAL-E2E LAW: bring up a real local Supabase + real gateway and test against it.
  Mock Commerce APIs are forbidden as proof. If a real DB truly cannot run here,
  commit the runnable test code + local-stack scripts and mark only the live
  execution [SKIP — NEEDS HUMAN].
- Keep all 128 validators green after every commit; full validate:governance at each gate.
- Do NOT stop between tasks. Do NOT ask me. Human-gated steps (live keys, prod DB,
  remote git, paid signups, pricing/policy) → append to CODEX_FEDERATION_LEDGER.md
  under "SKIPPED — NEEDS HUMAN" with exact commands, then continue.
- Small reversible commits; max 3 attempts per task then log BLOCKED and move on.
- Do NOT add new validators/docs/services or business-logic Next.js API routes. Consolidate.
- No fabrication: every DONE needs command+result evidence; self-verify UI in a real browser.
- xhigh reasoning for identity/RBAC/event-spine/OAuth/billing/real-stack; medium for mechanical.

Maintain CODEX_FEDERATION_LEDGER.md from task F0.1. When the §0 criteria are all green on
the real stack, write CODEX_FEDERATION_STATUS.md. Begin with F0.1 (baseline) now.
```

---

## 8. ONE‑LINE NORTH STAR

One identity, one API, one event spine, one design system — every app a thin client, every cross‑app flow a Shopify‑grade journey, all of it proven against a **real** database.

