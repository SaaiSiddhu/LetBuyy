# CODEX FOUNDATION-HARDENING MISSION — LetBuyy "Shopify for India", Phase 4 (Make It Honest & Solid)

**Driver:** GPT‑5.5 in Codex, reasoning effort `xhigh` for architecture/ownership/security work, `medium` for mechanical edits.
**Mode:** Continuous, autonomous. Run as long as it takes (24h+). Never stop while an unblocked task remains.
**Predecessors (done):** `CODEX_FOUNDATION_MISSION.md` (Phases 0‑5), `CODEX_FEDERATION_MISSION.md` (F0‑F8), `CODEX_PRODUCTION_READINESS_MISSION.md` (P0‑P4), `CODEX_REMEDIATION_LEDGER.md` (P0‑A security pass).
**Issue source of truth (canonical):** `FORENSIC_REPORT/` — an evidence‑cited forensic investigation of the entire platform (2026‑06‑05). Every finding ID below (`C‑1…C‑14`, `H‑1…H‑17`) maps to `FORENSIC_REPORT/16-critical-findings-summary.md`, with deep evidence in reports `01`–`14` and a verification log in `17-evidence-appendix.md`. **Read `FORENSIC_REPORT/16` and `FORENSIC_REPORT/00-EXECUTIVE-SUMMARY.md` before starting.** Do not re‑investigate from scratch; trust the cited file:line evidence and verify only at the point of edit.
**Governance posture (carried forward, non‑negotiable):** KEEP ALL 128 VALIDATORS GREEN at every commit (`node scripts/validate-governance.mjs`). Never delete or weaken a validator to pass; update governance memory in lockstep when an architecture change legitimately requires it. Anything needing a human *policy / credential / irreversible‑infra* decision → `[SKIP — NEEDS HUMAN]` and continue.

> **This mission is the opposite of the forensic engagement that produced `FORENSIC_REPORT/`.** That engagement was read‑only. **This one changes code.** You are explicitly authorized and required to modify source to close the findings below — under the Operating Contract.

---

## 0. PRIME DIRECTIVE

The forensic investigation found a real, working single‑gateway commerce core wrapped in a much larger layer of self‑referential governance that **passes all 128 of its own validators while the system it describes does not fully exist**. The platform's #1 risk is not broken code — it is the **distance between what the platform documents/validates about itself and what actually runs.**

**Your job: close that distance and make the foundation honest and solid.** For every Critical and High finding:

- If it can be made **real** without a live external credential / money rail / human policy call → **make it real** (working code path, wired, tested).
- If the documentation/manifest **overstates reality** → **reconcile the documentation to the truth** (or implement the missing reality), so no governance artifact asserts something false.
- If it requires a live secret, a payout rail, an irreversible infra/DB action, or a genuine architecture‑direction decision (e.g. "split the monolith", "build the 6 reserved services for real", "open the theme section model to third parties") → implement everything around it that *doesn't* need the human, then record the human‑gated remainder precisely in the ledger as `[SKIP — NEEDS HUMAN]` and continue.

**SUCCESS CRITERIA — COMPLETE only when all are proven with recorded command evidence:**

1. **No governance artifact lies.** `AGENTS.md`, `CLAUDE.md`, `docs/governance/*`, and every `runtime.manifest.json` describe the system that actually exists (or the system has been built to match them). The three runtime inventories agree (C‑12, C‑13, C‑2).
2. **Single‑writer ownership for every core table.** No table is written by two independently deployed runtimes via divergent code paths (H‑1). Ownership is documented and validator‑guarded.
3. **The app platform is honest end‑to‑end.** Compliance webhooks that are subscribed are also published (C‑4); app tokens reach a real (scope‑enforced) app API surface, not one GET proxy (C‑3); OAuth has client authentication (H‑6); Wasm functions enforce their declared limits (H‑5); app billing either moves test‑mode money through a real provider path or surfaces an honest "configure credentials" state — never fake success (C‑5).
4. **Theme/storefront extensibility is real or honestly gated.** The web editor previews real rendered output (C‑6); publish has preview/publish separation and is not last‑write‑wins (C‑8); app embeds inject (C‑9); the Liquid runtime exposes a documented commerce object/filter surface (C‑9); the cart persists server‑side (C‑10); unknown section types degrade documented‑gracefully and the section registry is data‑driven where feasible (C‑7).
5. **Tests prove behavior, not strings.** Every deployable workspace has a real `test` script that runs real tests; package units exist for the security‑critical packages; CI runs at least one behavioral path against a real/staging stack (C‑11). No workspace ships `echo 'No tests yet'`.
6. **Observability emits.** At least one real metrics producer feeds the SLO/alert stack the repo already defines, or the unbacked SLO/dashboard contracts are reconciled to what is actually emitted (C‑14).
7. **Security hardening landed.** Single credential authority for merchant auth (H‑7); per‑operator identity (not a shared static bearer) or an honest SKIP with the exact rotation/runbook (H‑16); storefront customer login rate‑limited (H‑17); credentialed‑CORS scoped; raw DB `error.message` leakage closed behind a shared sanitizer (Medium).
8. **Legacy & dead weight quarantined.** Portfolio/resume surface either removed from the commerce product or explicitly feature‑flagged and documented as legacy (H‑2); `@letbuyy/utils` dead service‑role edge removed (H‑8); duplication collapsed to single sources (crypto, `formatDate`, api‑client wrappers).
9. **Deploy/infra integrity.** One production deploy path (no racing workflows), a migration gate before app deploy, a single migration root, and a driver for the partition lifecycle — or honest SKIPs with exact commands (H‑15, Mediums).
10. **Every gate green on real evidence.** `pnpm turbo typecheck`, `pnpm run validate:governance` (128/128), `pnpm lint`, `pnpm turbo build` (no network fetch), full `node --test`, and the real‑stack journeys all pass. `CODEX_FOUNDATION_HARDENING_STATUS.md` summarizes the run; mark COMPLETE only if 1‑9 are genuinely green.

---

## 1. OPERATING CONTRACT (how you must run)

1. **Continuous execution.** Finish a task → update ledger → start the next unblocked task. Never pause to ask. Never end while unblocked tasks remain.
2. **The Green Law.** The tree is green after every commit: area validators + `pnpm turbo typecheck` + `pnpm lint` each increment; full `pnpm run validate:governance` (128/128) at every phase gate. Never commit red. Can't go green in 3 attempts → revert, log `BLOCKED` with diagnosis, move on.
3. **The Honesty Law (this mission's prime law).** Never make a governance artifact pass by asserting something that isn't true, and never make a feature "pass" by faking it. A manifest that claims an unbuilt capability must be corrected, not satisfied with a stub that pretends. A provider that needs live keys shows an honest "configure credentials" state — never fake success. A test must exercise real behavior — never assert a string to look covered.
4. **The Single‑Writer Law.** When you consolidate table ownership, the owning runtime is the *only* writer; other runtimes call the owner (or emit an event the owner consumes). Document the owner in `docs/governance/` and add/extend a validator that fails if a second writer appears.
5. **DATABASE SAFETY (critical).** NEVER mutate a production database. New migrations are **append‑only, forward‑safe, fresh‑replay‑safe** (continue the `073+` sequence on top of `000_baseline.sql`). Never edit historical migration intent destructively — archive, don't delete. Applying anything to an already‑provisioned environment is human‑gated.
6. **The REAL‑Evidence Law.** UI / cross‑app / behavioral proof runs against the staging Supabase + staging gateway, or a disposable local Postgres for DB‑replay proofs. Mocks are forbidden as proof. If staging is not credentialed/deployed, produce the code + local/throwaway‑DB proof and record only the *live* proof as `[SKIP — NEEDS HUMAN: staging deploy + secrets]` with exact run commands.
7. **Small reversible increments.** One logical change → validate → commit. Hundreds of small green commits beat one big red one. Prefer behavior‑preserving refactors (especially for the `storefront.ts` god‑file split) proven by tests written *before* the move.
8. **Human‑skip ledger (mark and continue).** Anything needing live secrets (Razorpay/Cashfree live, Supabase service‑role, Cloudflare, Vercel, Resend, OAuth provider creds, Gemini key), production DB apply, remote git, paid signups, payout rails, or a policy/pricing/legal/architecture‑direction decision → append to `CODEX_FOUNDATION_HARDENING_LEDGER.md` under `## SKIPPED — NEEDS HUMAN` with the exact command/decision and which findings it unblocks, then continue.
9. **No fabrication.** Every `DONE` needs command + result evidence. Never fake a test, never claim a provider works when it throws, never call a mock run "end‑to‑end." Self‑verify UI in a real browser with screenshots.
10. **Anti‑thrash.** Max 3 attempts per task → log `BLOCKED` + diagnosis → next task. Never loop on one error.
11. **Respect existing law.** Obey `AGENTS.md`, `CLAUDE.md`, `docs/governance/`, the Deprecated Runtime Policy, migration governance, and the architecture invariants in §3. When a change legitimately requires updating governance memory/manifests, do it **in the same commit**.
12. **Anti‑ceremony.** No new top‑level docs beyond this mission's ledger + status files. No new validators unless they enforce a real invariant this mission establishes (Single‑Writer, compliance‑publish, no‑`echo-no-tests`). No new microservices unless a phase explicitly authorizes it. Reuse existing packages.
13. **Traceability.** Every Critical/High finding ID in §6 must end the mission as `DONE` or `SKIPPED — NEEDS HUMAN` in the ledger. No finding may silently disappear.

---

## 2. ARCHITECTURE‑DIRECTION FORKS (decide once, record, then proceed)

Three findings imply architecture decisions larger than a code fix. **Do not stall on them.** For each, this mission's default is the *non‑destructive, honest* path; the larger direction is human‑gated:

- **C‑1 Monolith (one Worker is the whole backend).** DEFAULT: **Do not split the monolith in this mission.** Instead (a) modularize the god files behind it for safety (H‑9), (b) enforce Single‑Writer ownership (H‑1), and (c) record `[SKIP — NEEDS HUMAN: decision — extract checkout/search/media/notification/analytics into the 6 reserved service roots vs. keep modular‑monolith]` with the trade‑off. The 6 reserved services are addressed by C‑2 (reconcile their manifests to "reserved/not‑implemented" honesty), not by building them, unless the human chooses extraction.
- **C‑7 Section vocabulary compiled into the storefront.** DEFAULT: make the registry **data‑driven where feasible** (manifest‑declared section types resolved through a registry with a documented graceful fallback for unknown types), but **do not** build a third‑party section‑upload runtime here. Record `[SKIP — NEEDS HUMAN: decision — third‑party section runtime scope]`.
- **C‑9 Liquid commerce object model / App Embeds.** DEFAULT: implement a **documented, bounded** commerce drop set (product, collection, cart, customer, shop) + the embed injection points (`content_for_header/footer`) **with the existing security posture preserved** (sanitization, no arbitrary `<script>` unless a reviewed allowlist exists). Anything that would relax the sandbox is human‑gated.

State each decision once at the top of the ledger, then execute the default.

---

## 3. ARCHITECTURE INVARIANTS (never violate)

- One backend (`api-gateway`), one contract (`shared-types`/`api-client`), one identity verifier (`auth-core`), async via the event spine, **outbound webhooks only from `webhook-service`**, themes data‑only, one design system (`@letbuyy/ui`) consumed by all apps.
- **Single‑Writer per table.** Every table has exactly one writing runtime. Cross‑runtime mutation goes through the owner or an event the owner consumes.
- **Every subscribed event/webhook topic has a producer; every produced topic has a contract.** No dangling subscriptions, no uncontracted emissions.
- **Migrations fresh‑replay** on an empty DB with no manual steps; append‑only `073+`.
- **No runtime network at build time.** Fonts self‑hosted; assets repo/deployment‑owned.
- **No fake success.** Honest "configure credentials" states for anything needing live keys.
- INR‑first money; COD and GST are first‑class.

---

## 4. LEDGER — create and maintain `CODEX_FOUNDATION_HARDENING_LEDGER.md`

```
# CODEX FOUNDATION-HARDENING LEDGER — started <ISO ts>

## ARCHITECTURE-DIRECTION DECISIONS (from §2, recorded once)
- C-1 monolith: DEFAULT modular-monolith; extraction -> [SKIP — NEEDS HUMAN]
- C-7 section runtime: DEFAULT data-driven registry; 3p runtime -> [SKIP — NEEDS HUMAN]
- C-9 liquid/embeds: DEFAULT bounded drops + embed points, sandbox preserved

## BASELINE (capture BEFORE any change)
- typecheck / governance(128) / lint / build / full node --test : <results>
- forensic finding count ingested: 14 Critical + 17 High + mediums (list)

## PROGRESS LOG (newest first)
- <ts> [F#.#] <finding-id> <task> — DONE — evidence: <cmd> -> <result> — commit <sha>
- <ts> [F#.#] <finding-id> <task> — BLOCKED — tried A/B/C — error — hypothesis

## SKIPPED — NEEDS HUMAN   (append-only; each line names the findings it unblocks)
- [SKIP] <task> — requires <exact cmd/cred/decision> — unblocks <finding-ids>

## SINGLE-WRITER LEDGER   (append-only)
- <ts> table <name> -> sole writer <runtime>; second-writer validator added <sha>

## TRACEABILITY MATRIX   (every C/H id must resolve)
- C-1 .. C-14, H-1 .. H-17 -> DONE | SKIP(reason) | phase ref

## VALIDATOR LEDGER   (append-only)
- <ts> validate:governance -> 128/128 PASS after <sha>
```

Also maintain `CODEX_FOUNDATION_HARDENING_STATUS.md` (short: phase, % findings resolved, gates, what's human‑gated).

---

## 5. THE WORK — F0 → F8 (in order; don't start a phase until the prior gate is green)

### F0 — TRUTH & TOPOLOGY RECONCILIATION (master unblock — do first)
*Closes the governance‑vs‑reality gap so nothing else is built on a lie. Findings: C‑2, C‑12, C‑13; Mediums: manifest drift, 73 root ledger files, FEATURE‑flag honesty.*

- **F0.1 Single canonical runtime inventory.** Reconcile `CLAUDE.md` Canonical Runtime Map, `docs/governance/runtime-boundaries.md`, and on‑disk reality into **one** authoritative list. `developer-portal` and `queue-workers` exist → they must appear, correctly categorized (`queue-workers` is a real worker, not `reserved-service` — fix its `runtime.manifest.json`). Update whichever docs are wrong; keep the validator that checks them green. _DoD: all three sources agree; a validator asserts the agreement; 128/128._
- **F0.2 Reserved‑service honesty.** The six code‑free services (`checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline`) currently assert domain *ownership* in their manifests. Rewrite each manifest to state honestly that it is **reserved / not‑implemented**, and that the capability currently lives in `api-gateway`/`queue-workers`. Do **not** build them (see §2 C‑1). _DoD: no manifest claims an unbuilt capability as owned; governance green._
- **F0.3 `AGENTS.md` schema truth.** `AGENTS.md` claims 65 migrations / 228 tables and cites relocated migration `065`. Correct it to the real topology (one `000_baseline.sql` + `073+`, real table count from the baseline). _DoD: `AGENTS.md` DB section matches `database/` reality; no dangling migration citation._
- **F0.4 FEATURE‑flag honesty.** Three prod‑dark flags (GraphQL / Extensions / Liquid) ship code that prod never runs. For each: either document it as intentionally staged (in governance) with the enable path, or mark `[SKIP — NEEDS HUMAN: flip <flag> in prod]`. No flag silently hides a whole subsystem without a record. _DoD: every prod‑dark flag has a documented status._
- **F0.5 Root‑residue quarantine.** 73 root `CODEX_*`/`LETBUYY_*` ledger `.md` files (~1.4 MB) + `Audit/` are process residue mixed with source of truth. Move historical ones under `docs/archive/` (don't delete), keeping only the active mission + ledger + status + the canonical `AGENTS.md`/`CLAUDE.md`/`README.md` at root. Keep the stale‑artifact validator green. _DoD: root holds only active governance + this mission's files; archive preserves history._

**GATE F0:** 128/128; one runtime inventory; no manifest/`AGENTS.md` asserts an unbuilt capability; root de‑cluttered.

### F1 — BACKEND INTEGRITY: ownership, events, queues, god‑files
*Findings: H‑1, H‑9, H‑10, H‑11, H‑12; supports C‑1, C‑14.*

- **F1.1 Single‑Writer for `orders` & `products`.** Today both `api-gateway` (execution adapters) and `webhook-service` (`src/index.ts:412/430/468/503/1010` via `patchRows`) write these tables. Make `api-gateway` the **sole writer**: `webhook-service` must call a gateway internal endpoint (or emit an event the gateway consumes) to transition order/stock state — it must not `patchRows("orders"/"products")` directly. Add a validator that fails if `webhook-service` writes owned tables. _DoD: webhook‑service performs zero direct writes to `orders`/`products`; gateway owns the transition; second‑writer validator green; payment‑webhook → order‑update path covered by a test._
- **F1.2 Sweep remaining dual‑writers.** Grep every table written from more than one runtime (`subscriptions`, `sites`, others flagged in `FORENSIC_REPORT/11`). For each, assign a sole owner and route the rest. _DoD: Single‑Writer ledger lists every multi‑written table now single‑owned; validator green._
- **F1.3 Dangling subscriptions → producers.** `NOTIFICATION_QUEUE`, `SEARCH_QUEUE`, `RUNTIME_QUEUE` have consumers but no producers (H‑10). Either wire the real producer send‑sites (preferred where the feature is real — notifications/search) or, if the feature is genuinely not ready, document the consumer as reserved and `[SKIP]`. _DoD: no queue has a consumer with zero producers without a recorded reason._
- **F1.4 Emitters for contracted payout events.** `payout.released` / `payout.failed` have contracts + notification templates but no emitter (H‑11) — dead consumer code. Wire the emit at the real payout state transition (coordinate with F2.3), or `[SKIP — NEEDS HUMAN: payout rail]` and mark the consumer reserved. _DoD: contracted events are emitted or explicitly reserved; no silent dead consumer._
- **F1.5 Contracts for uncontracted emissions.** `theme.purchase.*`, `theme.draft.*` are emitted with no registered domain‑event contract (H‑12) so they skip validation and never reach `webhook-service`. Register their contracts in the event registry; route through the spine. _DoD: every emitted topic has a contract; envelope validation covers them._
- **F1.6 God‑file split (behavior‑preserving).** `services/api-gateway/src/routes/storefront.ts` (~4,900 lines / ~60 handlers, incl. inline customer auth) (H‑9) and the other 7 files >1,500 lines. Split by domain into cohesive route modules **without changing behavior**. Write characterization tests for the hot handlers *first*, then move. _DoD: no route file >1,500 lines for the split set; tests green before and after; no behavior change._

**GATE F1:** 128/128; Single‑Writer proven for all core tables; no dangling subscription/uncontracted emission without a recorded reason; god‑files split under test.

### F2 — APP PLATFORM MADE HONEST
*Findings: C‑3, C‑4, C‑5, H‑5, H‑6, H‑13.*

- **F2.1 Real app API surface + scope enforcement (C‑3).** Today app‑scoped tokens are accepted at exactly one GET proxy (`app-store.ts:1253`); `authMiddleware` never accepts app JWTs. Define a bounded, **scope‑enforced** app API (the read set today, plus the minimal writes the product needs), accept app JWTs in the middleware behind explicit scope checks, and enforce per‑scope authorization at each route. Do **not** open blanket write access — each new write scope is a deliberate, documented entry. _DoD: an installed app can call a documented set of scope‑guarded endpoints; a token missing a scope is rejected; tests cover allow + deny._
- **F2.2 OAuth client authentication (H‑6).** `/oauth/token` accepts code + client_id + redirect_uri with no client_secret/PKCE. Add client authentication (client_secret for confidential apps and/or PKCE for public apps) and a refresh‑token grant. _DoD: token exchange requires proof of client identity; refresh works; replay of a used code fails; tests cover each._
- **F2.3 Compliance webhooks must publish (C‑4).** `customers/data_request`, `customers/redact`, `shop/redact` are force‑subscribed at install (`app-engine/src/index.ts:151-153`) but never emitted. Wire real producers: when a merchant/customer triggers data‑request/redaction (and on app uninstall where Shopify parity expects it), publish these topics through the spine to subscribed apps. Add the merchant‑facing trigger if absent. _DoD: each compliance topic has a real emit path proven by a test; an installed app receives them._
- **F2.4 App billing: real path or honest state (C‑5).** Charge approval fabricates `rzp_route_test_…` and the payout ledger is hard‑coded `test/pending`. Implement the **real provider path in test/sandbox mode** (create charge → verify → ledger entry reflecting real provider state) behind the existing interface; live keys + payout *release* → `[SKIP — NEEDS HUMAN: live PSP + payout rail]`. No fabricated success references remain in code paths that imply money moved. _DoD: billing runs a real sandbox charge or shows an honest unconfigured state; no fake `rzp_route_test_` success; payout release is the only human‑gated remainder._
- **F2.5 Enforce Wasm function limits (H‑5).** `app-functions-runtime.ts:203` calls `WebAssembly.instantiate(module, {})` and never reads `memory_limit_kb`; only a ms timeout + 64 KB output cap apply, so a synchronous CPU loop can stall public checkout. Enforce the declared memory bound (provide a bounded `WebAssembly.Memory({ maximum })` and reject modules importing their own unbounded memory) and harden the timeout against synchronous loops (e.g. execute in a constrained context / subrequest budget). _DoD: a function exceeding memory or spinning CPU is terminated without stalling checkout; tests cover both._
- **F2.6 Developer tooling (H‑13).** No CLI/SDK/scaffold/API‑key issuance. Implement the **no‑credential** parts: an app‑manifest upload/validate path and API‑key issuance UI in `developer-portal` wired to the existing tables; a minimal TS SDK over `@letbuyy/api-client`. A full CLI is `[SKIP — NEEDS HUMAN: scope]` if it can't land green. _DoD: a developer can register an app, get keys, and call the SDK against staging — or the exact remainder is a recorded SKIP._

**GATE F2:** 128/128; an app can authenticate, hold scoped tokens, call a real scoped API, receive compliance webhooks, and bill in sandbox; Wasm limits enforced. Live‑key/payout‑release items recorded as SKIPs.

### F3 — THEME & STOREFRONT: real editing, publishing, extensibility, cart
*Findings: C‑6, C‑7, C‑8, C‑9, C‑10, H‑4, H‑14; orphan theme tables.*

- **F3.1 Wire the web editor live preview (C‑6).** `CenterPanel.tsx` (iframe + postMessage) has zero importers; the editor previews a hardcoded `PREVIEW_PRODUCTS` mock. Mount the real preview: editor → `/api/themes/[id]/preview-session` → storefront `/preview` postMessage bridge (the Flutter app already does this). Remove the mock from the proof path. _DoD: editing a section updates the real rendered iframe on web; proven with a screenshot._
- **F3.2 Preview/publish separation + concurrency safety (C‑8).** Web `editor/route.ts PUT` does save‑then‑`publish({make_store_live:true})` and omits `base_version` (last‑write‑wins). Split into explicit *save‑draft* and *publish* actions, and send `base_version` so the existing server‑side conflict detection engages. _DoD: a draft can be saved without going live; two concurrent saves conflict instead of clobbering; tests cover both._
- **F3.3 Data‑driven section registry + graceful unknowns (C‑7, default per §2).** Unknown section types render `null`. Make the registry resolve manifest‑declared types and render a documented, safe fallback (not silent null) for unknown types; keep first‑party renderers. Third‑party section runtime stays `[SKIP — NEEDS HUMAN]`. _DoD: unknown section type degrades visibly+safely; adding a first‑party section type doesn't require touching the renderer switch by hand; behavior tested._
- **F3.4 App Embeds + Liquid commerce drops (C‑9, default per §2).** `content_for_header/footer` are hardwired empty; Liquid scope lacks product/cart/customer. Implement embed injection points (sanitized) and a **bounded, documented** commerce drop set (`product`, `collection`, `cart`, `customer`, `shop`) + the safe filters themes need, preserving the current sandbox/sanitization posture. _DoD: an app embed renders into head/footer; a Liquid theme can read product/cart/customer through documented drops; sandbox tests still pass; no arbitrary script execution introduced._
- **F3.5 Server‑side cart (C‑10).** The cart lives only in `localStorage['lb_cart']`; a `public.carts` table exists but is unwired. Wire cart persistence to the gateway (`carts` table) with a cart token, so carts survive devices and apps can mutate them; keep the localStorage path as a fast client cache that syncs. _DoD: a cart persists server‑side across sessions/devices; cart API is scope‑guarded; tested end‑to‑end in checkout._
- **F3.6 Theme‑marketplace checkout (H‑4).** The "Pay" button is a `<Link href="/checkout/success…">` with no payment intent. Wire it to the real theme‑purchase flow (Razorpay test mode already exists) or surface an honest unconfigured state; remove the fake success link. _DoD: theme purchase creates a real (test‑mode) intent or shows honest state; no fake success navigation._
- **F3.7 De‑hardcode the demo store (H‑14) + orphan tables.** Remove the `urban-kicks-demo` short‑circuit (`store-service.ts:54-57`) from the real tenant path (keep it behind an explicit demo flag only). Decide the 7 orphaned theme tables + write‑only `theme_draft_patches` + unreachable `theme_reviews` write path: wire or archive‑document each. _DoD: real tenants never hit demo fixtures; every theme table is either used or documented reserved._

**GATE F3:** 128/128; real web editor preview + publish separation; embeds + cart server‑side; no fake checkout; demo store isolated.

### F4 — SECURITY & AUTH HARDENING
*Findings: H‑7, H‑16, H‑17; Mediums: CORS, error‑leakage, dev bypasses.*

- **F4.1 Single merchant credential authority (H‑7).** Merchant password verify runs in the Next app with `password_hash` shipped over HTTP each login; two bcrypt costs (12 vs 10) and no shared hashing impl. Move verification server‑side (gateway/`auth-core`), stop shipping the hash to the client, unify the cost factor in one shared hashing module. _DoD: the hash never leaves the gateway; one hashing impl; login covered by a test; governance green._
- **F4.2 Ops‑plane identity (H‑16).** A single static bearer token is the only credential for the super‑admin/ops API; audit actor is self‑asserted. Implement per‑operator identity (reuse identity‑platform/SSO) or, if that needs human IdP setup, implement what's local and record `[SKIP — NEEDS HUMAN: ops SSO/IdP]` with the exact rotation runbook. _DoD: ops actions are attributable to a real operator, or the precise human remainder is recorded with an interim rotation runbook._
- **F4.3 Storefront login abuse controls (H‑17).** Storefront customer login lacks the rate‑limit + Turnstile identity‑platform has; and internal storefront endpoints trust requests with no secret when `ENVIRONMENT !== 'production'` (`storefront.ts:1693`). Add rate limiting/bot protection to customer login; require the internal secret in all environments. _DoD: customer login is rate‑limited; internal endpoints reject unsigned requests in every env; tests cover both._
- **F4.4 Scope credentialed CORS (Medium).** `credentials:true` for every wildcard tenant subdomain. Constrain to the resolved tenant origin set. _DoD: CORS allows only known tenant origins with credentials; tested._
- **F4.5 Stop raw DB error leakage (Medium).** 121 sites can return raw `error.message` past a 3‑code denylist sanitizer (with a known miss at `employee.ts:60`). Route all error responses through a single allowlist sanitizer; add a validator that fails on raw `error.message` in responses. _DoD: no route returns raw DB errors; sanitizer validator green._
- **F4.6 Remove/》guard dev bypasses (Low).** Dev MFA‑bypass code and dev OTP echo are `NODE_ENV`‑guarded today; ensure they're impossible in production builds (compile‑out or hard assert) and documented. _DoD: no bypass reachable in a production build; documented._

**GATE F4:** 128/128; single credential authority; ops identity (or recorded SKIP + runbook); storefront login hardened; CORS scoped; no raw DB error leakage.

### F5 — TESTING REALITY (turn certification into proof)
*Finding: C‑11; supports every other phase.*

- **F5.1 Kill `echo 'No tests yet'`.** Every one of the 12 deployable workspaces' `test` script must run real tests (`node --test` / `vitest` / `playwright` as appropriate). No workspace keeps the no‑op. _DoD: `pnpm turbo test` runs real tests in all 12; none is a no‑op._
- **F5.2 Package units for security‑critical packages.** Add real unit tests to `auth-core`, `billing-core`, `payments`, `checkout-core`, `theme-engine`, `app-engine`, `event-core` (0 today). Prioritize the invariants this mission establishes (single‑writer, scope enforcement, GST, signature verify, Wasm limits). _DoD: each listed package has meaningful unit coverage of its core invariants._
- **F5.3 Behavioral CI gate.** Wire CI to run at least the J1‑J5 federation journeys + the new app‑platform/theme/cart paths against a real/staging or ephemeral‑Postgres stack — not plan mode, not string asserts. _DoD: CI fails if a real behavioral journey breaks; evidence in the REAL‑Evidence ledger._
- **F5.4 Reconcile "certification" language.** Where load/chaos/cert suites are plan‑mode contracts, ensure their naming/labels don't imply live certification; keep `mode: "governance-contract-not-live-evidence"` honest and surfaced. _DoD: no suite name overstates what it proves._

**GATE F5:** 128/128; `pnpm turbo test` runs real tests everywhere; behavioral CI gate live; no no‑op test scripts remain.

### F6 — OBSERVABILITY, DEPLOY & INFRA INTEGRITY
*Findings: C‑14, H‑15; Mediums: migration roots, partition lifecycle, base URLs, error tracking.*

- **F6.1 Emit real metrics (C‑14).** Prometheus rules/Grafana/SLOs reference metrics no runtime emits (`http_requests_total`, `letbuyy_queue_dead_letter_total`, `letbuyy_replay_lag_seconds`); no OTel/prom‑client; `writeDataPoint` never called. Wire a real producer (Workers Analytics Engine `writeDataPoint` and/or an OTel/prom exporter) for at least request, queue‑DLQ, and replay‑lag metrics; OR reconcile the SLO/dashboard contracts to what is actually emitted. Error tracking (Sentry or equivalent) wired where it needs no paid plan, else `[SKIP — NEEDS HUMAN: error‑tracking DSN]`. _DoD: the SLO stack is fed by a real producer, or its contracts match emitted reality; no dashboard references a metric nothing emits._
- **F6.2 One production deploy path + migration gate (H‑15).** Two workflows fire on push to `main` with different concurrency groups (race); `deploy-production.yml` has no migration job/staging gate and `echo "SKIP"`s on missing creds. Collapse to a single gated production pipeline: migrate (gated) → smoke staging → promote. Credential‑dependent live steps → `[SKIP — NEEDS HUMAN]` with exact commands, but the pipeline structure (gate, ordering, single concurrency group) lands now. _DoD: exactly one prod deploy path; app deploy cannot precede its migration; no racing workflows._
- **F6.3 Single migration root + partition driver.** Two roots exist (`supabase/` PG15 vs `database/supabase/` PG17). Make one canonical, archive the other (don't delete), document the choice. Add the missing driver/scheduler for migration 079's `ensure/detach…hot_table_partitions` (a cron in `queue-workers` or gateway scheduled handler), or `[SKIP — NEEDS HUMAN]` with the exact external scheduler command. _DoD: one migration root; partition lifecycle has a driver or a recorded SKIP._
- **F6.4 Environment honesty.** Web apps default base URLs to `*.staging.letbuyy.store`; marketing‑site hardcodes `accounts.staging…` link hrefs; mobile uses `GEMINI_API_KEY` with no template/default. Make prod base URLs come from env with safe prod defaults (or fail‑loud if unset), de‑hardcode marketing links, add missing mobile env to the template (`[SKIP — NEEDS HUMAN: GEMINI key]` for the value). _DoD: no production surface silently points at staging; missing env is loud, not silent._

**GATE F6:** 128/128; metrics emitted (or contracts reconciled); one gated prod deploy path; one migration root; environment honest.

### F7 — LEGACY, DEAD CODE & DUPLICATION
*Findings: H‑2, H‑8; reports `09` (dead code), `10` (duplication).*

- **F7.1 Legacy portfolio/resume surface (H‑2).** Portfolio/resume/ATS pages, gateway `/portfolio`+`/resume` routers, and 5+ schema tables ship in the commerce admin. Decide with the product framing: remove from the commerce product, or feature‑flag + document as legacy and hide from default nav/acquisition surface. Schema → archive‑document, don't drop. _DoD: the commerce product no longer surfaces portfolio/resume by default; code/schema status documented._
- **F7.2 Remove the `@letbuyy/utils` dead edge (H‑8).** Declared by 8 apps, imported by 0 files, and it exports a service‑role admin DB client into those graphs. Remove the dependency from the 8 manifests; if the package is fully unused, archive it; ensure no service‑role client is reachable from app graphs. _DoD: 0 apps depend on `@letbuyy/utils`; no service‑role client in any app dependency graph; validator guards it._
- **F7.3 Collapse duplication (report `10`).** Single‑source the security‑critical crypto (`hmacSha256Hex`/`timingSafeEqual`/`sha256Hex` duplicated across `auth-core`, `api-gateway`, payment adapters, and re‑declared inside `storefront.ts:1656-1682`) into one shared module; collapse the 6 per‑app `getApiBaseUrl`/api‑client wrappers, the 27 `formatDate` and 6 `formatCurrency` copies, and 3 `slugify` copies into shared utilities. Remove the dead marketing/theme‑editor twin component sets. _DoD: one implementation each for crypto/date/currency/slug/api‑base; dead twins removed; tests green._
- **F7.4 Documented dead‑code sweep.** Work `FORENSIC_REPORT/09`: remove or archive the ~40 unused TS + ~34 unused Dart files, 8 unused `VERCEL_PROJECT_ID_*` env vars, and unused scripts — **only** where 0 inbound references are re‑confirmed at edit time. Never delete anything still referenced. _DoD: confirmed‑dead files archived/removed with evidence; governance green._

**GATE F7:** 128/128; legacy surface handled; no dead service‑role edge; single‑source utilities; confirmed dead code archived.

### F8 — MOBILE PARITY HONESTY
*Finding: H‑3.*

- **F8.1 `operator-app` & `shopper-app` truth.** `operator-app` is the unmodified Flutter counter demo; `shopper-app` is empty. Either remove them from the governed runtime topology (so the map stops counting demos as real runtimes) or implement a real first screen wired to the gateway. Default: **reconcile topology** (mark them explicitly pre‑implementation in governance) and `[SKIP — NEEDS HUMAN: build operator/shopper mobile scope]`; do not ship a counter demo as a governed runtime. _DoD: no governed runtime is a starter demo; status recorded._

**GATE F8:** 128/128; mobile topology honest.

---

## 6. TRACEABILITY MATRIX (every finding must resolve)

| ID | Finding (short) | Phase | Default disposition |
|----|------------------|-------|---------------------|
| C‑1 | Single‑worker monolith | F1 (+§2) | Modularize + Single‑Writer; **extraction = SKIP/human** |
| C‑2 | 6 declared services don't exist | F0.2 | Reconcile manifests to "reserved" honesty |
| C‑3 | App tokens hit one GET proxy only | F2.1 | Real scope‑enforced app API |
| C‑4 | Compliance webhooks never published | F2.3 | Wire real producers |
| C‑5 | App billing moves no money | F2.4 | Real sandbox path; **live payout = SKIP** |
| C‑6 | Web editor preview unwired | F3.1 | Wire real preview |
| C‑7 | Sections compiled into storefront | F3.3 (+§2) | Data‑driven registry; **3p runtime = SKIP** |
| C‑8 | One‑step publish, last‑write‑wins | F3.2 | Preview/publish split + base_version |
| C‑9 | No embeds / Liquid commerce model | F3.4 (+§2) | Bounded drops + embed points |
| C‑10 | No server‑side cart | F3.5 | Wire `carts` table + token |
| C‑11 | Tests are document‑shaped | F5 | Real tests everywhere |
| C‑12 | AGENTS.md describes dead DB | F0.3 | Correct to reality |
| C‑13 | 3 runtime inventories disagree | F0.1 | One canonical inventory |
| C‑14 | Observability has no producer | F6.1 | Emit real metrics |
| H‑1 | Dual write‑ownership orders/products | F1.1 | Single‑Writer + validator |
| H‑2 | Legacy portfolio/resume live | F7.1 | Remove/flag + document |
| H‑3 | operator/shopper mobile are demos | F8.1 | Reconcile topology; **build = SKIP** |
| H‑4 | Theme‑marketplace fake checkout | F3.6 | Real intent or honest state |
| H‑5 | Wasm memory limit unenforced | F2.5 | Enforce limits |
| H‑6 | No client auth at /oauth/token | F2.2 | client_secret/PKCE + refresh |
| H‑7 | Merchant password verify in app | F4.1 | Server‑side, single hashing impl |
| H‑8 | `@letbuyy/utils` dead service‑role edge | F7.2 | Remove edge |
| H‑9 | `storefront.ts` god file | F1.6 | Behavior‑preserving split |
| H‑10 | Queues: consumers, no producers | F1.3 | Wire producers or reserve |
| H‑11 | payout events no emitter | F1.4 | Emit or reserve (+SKIP) |
| H‑12 | Uncontracted theme/payout events | F1.5 | Register contracts |
| H‑13 | No dev CLI/SDK/keys | F2.6 | No‑cred parts real; **CLI = SKIP if needed** |
| H‑14 | Hardcoded demo store | F3.7 | Isolate behind demo flag |
| H‑15 | Racing prod deploys, no migration gate | F6.2 | One gated pipeline |
| H‑16 | Static bearer ops plane | F4.2 | Per‑operator identity (or SKIP+runbook) |
| H‑17 | Storefront login unprotected | F4.3 | Rate‑limit + internal secret all envs |

Mediums/Lows (CORS, error‑leakage, FEATURE‑flags, migration roots, partition driver, env honesty, dev bypasses, duplication, orphan tables, root residue) are folded into F0/F4/F6/F7 as noted and must each end DONE or SKIP in the ledger.

---

## 7. FINAL GATE (mark COMPLETE only when all true)

- `pnpm turbo typecheck` — PASS
- `pnpm run validate:governance` — **128/128 PASS** (or higher if this mission adds Single‑Writer / compliance‑publish / no‑raw‑error / no‑no‑op‑test validators — never fewer)
- `pnpm lint` — PASS
- `pnpm turbo build` — PASS with **no network fetch**
- `pnpm turbo test` — real tests pass in **all 12** deployable workspaces; security‑critical packages have units
- Behavioral journeys (J1‑J5 + new app/theme/cart paths) — PASS on the real/staging or ephemeral‑Postgres stack (live‑only remainder = recorded SKIP)
- **Traceability matrix:** every `C‑*` and `H‑*` id resolved as DONE or SKIPPED — NEEDS HUMAN, with evidence
- **Honesty audit:** no `runtime.manifest.json`, `AGENTS.md`, `CLAUDE.md`, SLO/dashboard, or test name asserts a capability that doesn't exist
- `CODEX_FOUNDATION_HARDENING_STATUS.md` summarizes the run and lists every human‑gated remainder with exact commands

Mark COMPLETE only if the foundation is **honest** (nothing overstated) and **solid** (single‑writer, scope‑enforced, tested, observable). Everything that genuinely needs a human is recorded — not faked, not skipped silently.
