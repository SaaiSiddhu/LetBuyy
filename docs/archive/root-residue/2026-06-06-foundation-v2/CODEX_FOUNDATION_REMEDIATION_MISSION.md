# CODEX FOUNDATION REMEDIATION MISSION — LetBuyy "Shopify for India", Foundation Phase (Make It True)

**Driver:** GPT‑5.5 in Codex, reasoning effort `xhigh` for architecture/app‑platform/theme‑runtime/money work, `high` for migrations + tests, `medium` for mechanical edits.
**Mode:** Continuous, autonomous, single run. Work as long as it takes (24h+). Never stop while an unblocked task remains. When only human‑gated tasks remain, record them and finish — do not idle, do not ask mid‑run.
**Branch:** continue on `stream/letbuyy-remediation` (do not branch off; small reversible commits).
**Predecessors (DONE — verify green, DO NOT redo):** `CODEX_FOUNDATION_MISSION.md` (Phases 0‑5), `CODEX_FEDERATION_MISSION.md` (F0‑F8), `CODEX_PRODUCTION_READINESS_MISSION.md` (P0‑P4), and the security stream logged in `CODEX_REMEDIATION_LEDGER.md` (P0‑A customer session primitive, P0‑A.2/.3 gateway customer‑session middleware, P0‑A.4/.6/.7 customer‑route enforcement, P0‑A.5 token‑bound customer reset, P0‑B identity OTP‑intent binding, P0‑C CSRF cookie contract, P0‑D customer‑auth rate‑limit + Turnstile).
**Authority of this mission:** This mission supersedes the open work item in `CODEX_REMEDIATION_LEDGER.md` ("BLOCKED — AWAITING HUMAN"). The security P0 stream is genuinely done locally; the *foundation* is not. The forensic investigation in `FORENSIC_REPORT/00‑17` is the single source of truth for what is broken. This mission closes the **entire** reconciled register — 14 Critical + 17 High + their Medium/Low tails — in one continuous pass.

**Governance posture (carried forward, non‑negotiable):** KEEP ALL 128 VALIDATORS GREEN at every commit (`node scripts/validate-governance.mjs` → 128/128, exit 0). Never delete or weaken a validator to pass. When an architecture change requires it, update governance memory (`AGENTS.md`, `docs/governance/*`, runtime manifests) **in the same commit**. Anything needing a human policy/credential decision → `[SKIP — NEEDS HUMAN]` in the ledger and continue.

---

## 0. PRIME DIRECTIVE

> **Close the distance between what LetBuyy documents/validates about itself and what it actually does.** The code that runs is mostly clean; the danger is the gap between the advertised platform (host third‑party apps, extend themes, move money, run reliably, observe itself) and the system that exists. This is the foundation phase: after it, every Critical finding in `FORENSIC_REPORT/16-critical-findings-summary.md` is either **genuinely real**, **honestly stubbed** (clearly surfaced "not configured / not implemented", never fake success), or **recorded as `[SKIP — NEEDS HUMAN]`** with the exact unblocking step. No finding may remain silently false.

Three rules govern every choice:

1. **Real or honest — never fake.** A subsystem either works end‑to‑end, or it returns an explicit unconfigured/not‑implemented state that a caller and a human can see. Removing a fake success (e.g. the fabricated `rzp_route_test_…` charge reference) is *always* preferred over leaving a lie in place. Fake success is the single worst defect class in this codebase — eliminate it everywhere you find it.
2. **Truth in the docs.** When code and a governance document disagree about topology, schema, or capability, the **code wins** and the document is corrected in the same commit. There must be exactly one readable, correct statement of what the platform is.
3. **Foundation over features.** Prefer correct boundaries, real tests, honest states, and reconciled docs over new surface area. Build a missing subsystem only when a Critical finding requires it (server‑side cart, app token acceptance, theme commerce object model, compliance‑webhook emitters). Do not add features the register does not demand.

---

## 0.1 SUCCESS CRITERIA — COMPLETE only when all are proven with recorded command evidence

1. **Every Critical (C‑1…C‑14) and High (H‑1…H‑17) item** from `FORENSIC_REPORT/16-critical-findings-summary.md` is resolved to one of: `DONE` (with evidence), `HONEST‑STUB` (explicit surfaced state + test), or `SKIP — NEEDS HUMAN` (exact unblock). The register in §6 of this mission is the checklist; none may be left untouched.
2. **No fake‑success path remains.** Grep proves zero fabricated provider references, zero hard‑coded `test`/`passed` settlement states presented as real, zero "scaffolded but returns success." (`app-store.ts:1541` `rzp_route_test_`, queue‑workers `payout_provider_mode:'test'` at ~:664, and peers are removed or gated behind real credentials with honest fallback.)
3. **Docs == reality.** `AGENTS.md`, `CLAUDE.md`, and `docs/governance/runtime-boundaries.md` agree with each other and with disk on: migration count/topology, runtime inventory (apps + services, with the 6 code‑free services labeled `reserved/contract-only` not `owning`), and `developer-portal` + `queue-workers` classifications. One canonical runtime map; C‑12 and C‑13 closed.
4. **Tests are behavior‑shaped.** Every deployable workspace's `test` script runs real tests (no `echo 'No tests yet'`). New unit/integration tests cover: customer + merchant auth, cart, checkout/orders, payments idempotency, app OAuth/token acceptance, compliance‑webhook emission, theme publish concurrency. `node --test` and per‑workspace tests pass. (C‑11.)
5. **Observability has producers.** At least the metrics referenced by the shipped Prometheus/SLO contracts are actually emitted by the runtimes that own them (or the unsatisfiable contracts are deleted/marked contract‑only). No alert rule references a metric nothing emits. (C‑14.)
6. **The app platform can host a real app.** App‑scoped OAuth tokens are accepted by the general auth path (not one GET‑only proxy); `/oauth/token` enforces client authentication (client_secret or PKCE); a minimal app **write** capability exists for at least one resource; the three mandatory compliance webhooks have real emit sites. (C‑3, C‑4, H‑5, H‑6.)
7. **Money is real or honestly unconfigured.** App billing + payouts either call a real PSP/payout path behind a credential flag, or return an explicit "payments not configured" state and emit no fake settlement. Live‑key execution is `SKIP — NEEDS HUMAN`. (C‑5, H‑4, H‑11.)
8. **Commerce + theme foundations exist.** Server‑side cart is wired to `public.carts` with cart tokens (C‑10); the web theme editor preview renders real output and publish is two‑step with `base_version` concurrency (C‑6, C‑8); the section registry is data‑drivable and the Liquid runtime exposes a commerce object model + app‑embed seam (C‑7, C‑9 — at minimum a working seam + tests, full object coverage may phase).
9. **The Green Law holds:** `pnpm turbo typecheck`, `pnpm lint`, `pnpm run validate:governance` (128/128), full `node --test`, and `pnpm turbo build` all green at the final commit. Where a build/test genuinely needs live infra, that single step is `SKIP — NEEDS HUMAN` and everything around it is green.
10. **`CODEX_FOUNDATION_REMEDIATION_STATUS.md`** summarizes the run; mark COMPLETE only when 1‑9 are genuinely green and every gap is a recorded human SKIP, not a silent miss.

---

## 1. OPERATING CONTRACT (how you must run)

1. **Continuous execution.** Finish a task → update ledger → start the next unblocked task. Never pause to ask. Never end while unblocked tasks remain. Phases run in order; do not open a phase until the prior phase gate is green.
2. **The Green Law.** Tree is green after every commit: touched‑area typecheck + `pnpm lint` each increment; full `pnpm run validate:governance` at every phase gate. Never commit red. Can't reach green in 3 attempts → revert, log `BLOCKED` with diagnosis, move to the next task.
3. **The Honest‑State Law.** Replacing a fake‑success with an explicit unconfigured/error state is a valid `DONE` and is always allowed — even when the "real" implementation is human‑gated. A surfaced honest failure beats a hidden lie. Honest states must be observable by the caller (typed result/HTTP status) AND covered by a test.
4. **The No‑Fabrication Law.** Every `DONE` carries a command + its real result. Never fake a test, never claim a provider/flow works when it throws, never call a mock run "end‑to‑end," never hard‑code a `passed`/settled status. Self‑verify UI changes in a real browser with a screenshot where feasible.
5. **The Human‑Skip Law (mark and continue).** Anything requiring live secrets (Razorpay/Cashfree/Stripe/PayPal live keys, Supabase service‑role, Cloudflare, Vercel, Resend, OAuth provider creds), production DB apply, real payout rails, remote git, paid signups, or policy/pricing/legal/brand decisions → append to the ledger under `## SKIPPED — NEEDS HUMAN` with the exact command/credential/decision and what it unblocks, then continue. Build the code path up to the credential boundary; gate it behind an env flag; leave an honest state when the flag is off.
6. **Do‑Not‑Redo Law.** The P0‑A…P0‑D security work in `CODEX_REMEDIATION_LEDGER.md` is DONE. Verify it still typechecks and is governance‑green; do not reimplement it. If a foundation change touches it, extend — don't rewrite.
7. **Do‑Not‑Break‑What‑Works Law.** The verified positives in §2.2 (no committed secrets, timing‑safe PSP signature verification, clean app→app/Supabase boundaries, 128/128 governance) must remain true. Re‑verify them at the final gate. Do not "fix" them.
8. **Small reversible increments.** One logical change → validate → commit. Hundreds of small green commits beat one big red one.
9. **Anti‑ceremony.** No new top‑level process docs beyond this mission's ledger + status file. No new validators. **No new `services/*` roots** (foundation decomposition happens *inside* `api-gateway` as routers/modules, not as new deployable services). No new business‑logic Next.js API routes — thin clients call the gateway. Reuse existing packages.
10. **Anti‑thrash.** Max 3 attempts per task → log `BLOCKED` + diagnosis → next task. Never loop on one error.
11. **Respect existing law.** Obey `AGENTS.md`, `CLAUDE.md`, `docs/governance/`, the Deprecated Runtime Policy, and migration governance. Migrations are **append‑only and fresh‑replayable**; never destructively edit historical migration intent (archive, don't delete); never mutate a provisioned DB (staging targets only; prod apply is human‑gated).

---

## 2. GROUND TRUTH (read before touching anything)

### 2.1 Source‑of‑truth documents (read first)
- `FORENSIC_REPORT/16-critical-findings-summary.md` — the reconciled C‑1…C‑14 + H‑1…H‑17 register (severities normalized, 14 headline items re‑verified). **This is the master checklist.**
- `FORENSIC_REPORT/15-production-readiness.md` — readiness scorecard (deploy, DB, testing, observability, security, scaling).
- `FORENSIC_REPORT/17-evidence-appendix.md` — independent re‑verification verdicts (✅ confirmed / PARTIAL / contradicted) for the headline items.
- Domain detail as needed: `03` apps, `04` theme, `05` storefront, `06` apps‑ecosystem, `07` integration, `08` error/misconfig, `09` dead‑code, `11` violations, `12` shopify‑compat, `13` debt, `14` risk.

### 2.2 VERIFIED POSITIVES — do not "fix", must stay true at the final gate
- No committed live secrets (`sk_live_`, `rzp_live_`, `service_role` JWT, PEM) in tracked source.
- Timing‑safe webhook signature verification for all four PSPs (Razorpay/Stripe/PayPal/Cashfree).
- Clean app‑layer boundaries: 0 app→app imports, 0 direct Supabase `.from()` in web apps, 0 deprecated‑alias references in code.
- `node scripts/validate-governance.mjs` → 128/128, exit 0.
> Implication: every Critical/High below is something the validators **don't** measure, a cross‑authority disagreement, or a prose‑only rule. Fixing them must not regress these four positives.

### 2.3 ALREADY DONE (verify, don't redo) — from `CODEX_REMEDIATION_LEDGER.md`
Customer session primitive + gateway middleware + customer‑route enforcement; token‑bound customer password reset (`077`); identity OTP‑intent binding (`078`); CSRF cookie contract (`letbuyy_csrf`); customer‑auth rate‑limit + Turnstile. These close most of the customer‑auth surface of H‑17 and the customer half of H‑7. Confirm green; extend for the merchant half of H‑7 in Phase F2.

---

## 3. ARCHITECTURE INVARIANTS (never violate)

- **One backend** (`services/api-gateway`), **one contract** (`@letbuyy/shared-types` + `@letbuyy/api-client`), **one identity verifier** (`@letbuyy/auth-core`), **async via the event spine** (`event-core` → outbox → Cloudflare Queues → `queue-workers`), **outbound webhooks only from** `services/webhook-service`, **themes are data**, **one design system** (`@letbuyy/ui`) for all web apps.
- Decomposition of god‑files (`storefront.ts`, `app-store.ts`) is **internal**: split into Hono sub‑routers/modules within `api-gateway`. Do **not** spawn new deployable services; the 6 code‑free service roots stay code‑free and get relabeled `reserved/contract-only`, OR are documented as the future home without pretending they run today.
- **Migrations fresh‑replay** on an empty Postgres with zero manual steps; append‑only; forward‑safe. Two migration roots must be reconciled to one truthful lineage (or the divergence documented and the dead root archived).
- **No runtime network at build time.** No new `next/font/google`; fonts self‑hosted.
- **INR‑first money; COD + GST first‑class.** New money code is provider‑abstracted and credential‑gated; honest "not configured" when keys absent.
- **Every domain event has a registered contract** in `event-core` before it is emitted; emitters and consumers are paired (no contract without emitter, no consumer without producer).

---

## 4. LEDGER — create and maintain `CODEX_FOUNDATION_REMEDIATION_LEDGER.md`

```
# CODEX FOUNDATION REMEDIATION LEDGER — started <ISO ts>

## BASELINE (captured before any change)
- typecheck / governance(128) / lint / build / node --test : <results>
- grep proofs: rzp_route_test_ sites, payout test-mode sites, echo 'No tests yet' workspaces : <counts+paths>
- fresh-DB replay status BEFORE fix : <PASS|FAIL at migration> (evidence)

## REGISTER STATUS  (mirror of mission §6; update as items close)
- C-1 … C-14 : <DONE|HONEST-STUB|SKIP|IN-PROGRESS> — phase — evidence/sha
- H-1 … H-17 : <…>

## PROGRESS LOG (newest first)
- <ts> [F#.#] <task> — DONE — evidence: <cmd> -> <result> — commit <sha>
- <ts> [F#.#] <task> — HONEST-STUB — surfaced state <what> + test <name> — sha
- <ts> [F#.#] <task> — BLOCKED — tried A/B/C — error — hypothesis

## SKIPPED — NEEDS HUMAN   (append-only)
- [SKIP] <C/H-id> <task> — requires <exact cmd/cred/decision> — unblocks <ids>

## VALIDATOR LEDGER   (append-only)
- <ts> validate:governance -> 128/128 PASS after <sha>
```

---

## 5. THE WORK — Foundation phases F0 → F8 (in order; gate must be green to advance)

### PHASE F0 — Truth & Safety baseline (docs↔reality, observability producers, deploy safety)
Goal: make the platform describe itself correctly and stop the two unsafe operational races, before changing behavior.
- **C‑12 / C‑13 — One true topology.** Reconcile `AGENTS.md` (claims 65 migrations/228 tables/migration `065`), `CLAUDE.md` (13 runtimes), and `docs/governance/runtime-boundaries.md` (adds developer‑portal + 7 reserved services) with disk (10 apps + 9 services, 6 of them 2‑file). Produce one canonical runtime map; correct the migration count to the real squashed lineage; classify `developer-portal` (governed, docs‑plane) and `queue-workers` (implemented, not `reserved-service`). Update all three docs + affected `runtime.manifest.json` in lockstep. Keep governance green.
- **C‑2 — Honest service manifests.** Relabel the 6 code‑free services (`checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline`) manifests from ownership language to `reserved / contract-only — implemented in api-gateway today`. The runtime map must point a reader to where each capability actually executes.
- **C‑14 — Observability producers or honest deletion.** For each metric referenced by `infrastructure/**` Prometheus rules / Grafana / SLOs (`http_requests_total`, `letbuyy_queue_dead_letter_total`, `letbuyy_replay_lag_seconds`, …): either wire a real emitter (Analytics Engine `writeDataPoint` and/or a `/metrics` exposition the runtime actually serves) or remove/mark the rule `contract-only`. No alert rule may reference a metric nothing emits. Prefer wiring the cheap ones (request counter, queue DLQ counter) and honestly marking the rest.
- **H‑15 — Deploy race.** Reconcile the two production deploy workflows that both fire on push to `main`. One production path, one concurrency group; add the missing migration/staging gate to `deploy-production.yml` (or merge it into the gated workflow). Steps that `echo "SKIP"` on missing creds must fail‑loud or be explicitly human‑gated, not silently no‑op a "green" prod deploy. Live execution stays `SKIP — NEEDS HUMAN`.
- **08/14 — Migration roots + partition driver + tsc paths.** Reconcile the two migration roots (`supabase/` PG15 vs `database/supabase/` PG17) to one truthful lineage (archive the dead root). Give migration 079's `ensure/detach hot_table_partitions` a real scheduled caller (cron‑driven, like the outbox dispatch) or mark the partition lifecycle `SKIP — NEEDS HUMAN` with the exact operational hook. Fix `webhook-service`/`queue-workers` standalone `tsc --noEmit` failures (tsconfig `paths` asymmetry vs api‑gateway).
- **Gate F0:** governance 128/128; docs mutually consistent; no metric‑without‑emitter in active alert rules; one prod deploy path; `tsc --noEmit` green for all three workers.

### PHASE F1 — Boundaries & monolith seams (internal, no new services)
Goal: remove dual‑ownership and the worst god‑file/coupling risks without changing the deploy topology.
- **H‑1 — Dual write‑ownership of `orders`/`products`.** `webhook-service` currently inserts/updates `orders`/`products` directly via `patchRows()` (`webhook-service/src/index.ts:412/430/468/503/1010`). Route those writes through an api‑gateway internal endpoint (service binding) or a shared, RPC‑locked write module so there is a single writer of record per table. Preserve timing‑safe PSP verification. Add a test proving webhook‑driven status transitions go through the single writer.
- **H‑9 — `storefront.ts` god‑file (~4,900 lines / 60 handlers).** Split into cohesive Hono sub‑routers/modules **inside** api‑gateway (e.g. `storefront/products`, `storefront/customer`, `storefront/checkout`, `storefront/content`, `storefront/theme`) mounted under the same `/storefront` base. No behavior change; pure structural decomposition with typecheck + existing `__tests__` green. Same treatment is optional for `app-store.ts` if time permits after F3.
- **H‑8 — Dead `@letbuyy/utils` admin‑client edge.** It's declared by 8 apps, imported by 0 source files, and exports a service‑role admin DB client into app graphs. Remove the dependency edge from the 8 app `package.json`s (and/or stop exporting a service‑role client into app‑reachable code). Governance green; no app loses a real import (verified 0 importers).
- **11/14 — CORS + error‑message leakage.** Tighten credentialed CORS (`credentials:true` for every wildcard tenant subdomain) to the actual allow‑list pattern; replace the 3‑code denylist error sanitizer (121 raw `error.message` sites, ≥1 known miss) with an allow‑list/typed‑error sanitizer so raw DB errors can't surface. Add a test for the known‑miss case.
- **Gate F1:** single writer per core table (test); storefront router decomposed (typecheck + tests green); utils edge removed; no raw DB error leakage on the known path; governance 128/128.

### PHASE F2 — Commerce core integrity
Goal: the shopper data model is server‑authoritative.
- **C‑10 — Server‑side cart.** Wire the existing `public.carts` table: gateway cart endpoints (create/get/add/update/remove/merge) issuing a cart token; storefront cart context backed by the server cart (keep `localStorage` only as an offline cache that syncs), so carts are cross‑device, app‑mutable, and abandoned‑cart‑recoverable. Add tests for cart token issuance + server mutation + guest→customer cart merge.
- **H‑7 — Unify merchant credential authority.** Merchant password verification currently runs in the Next app with `password_hash` shipped over HTTP each login, with two bcrypt cost factors (12 vs 10). Move verification into the gateway behind `auth-core` (single hashing impl, single cost), so the hash never leaves the gateway. Reuse the customer‑session patterns already built in P0‑A. Test: forged‑body identity rejected; hash never returned.
- **H‑17 (remainder) — Storefront internal‑trust gap.** Internal storefront endpoints trust requests with no secret when `ENVIRONMENT !== 'production'` (`routes/storefront.ts:1693`). Require the signed internal header in all environments (or a test‑only injected secret), so non‑prod isn't a softer trust boundary. Customer‑auth rate‑limit/Turnstile from P0‑D already covers the abuse half — verify.
- **Gate F2:** server cart proven by test; merchant hash never leaves gateway (test); no env‑conditional internal trust; governance green.

### PHASE F3 — App platform made real (the headline credibility fix)
Goal: a third‑party app can authenticate, be authorized broadly, write something, and receive the compliance webhooks the platform forces it to subscribe to.
- **C‑3 — App tokens accepted platform‑wide + app write API.** App‑scoped OAuth tokens are currently accepted at exactly one GET‑only proxy (`app-store.ts:1253`); `authMiddleware` never accepts app JWTs. Teach the general auth path to accept app‑scoped tokens (scope‑checked per route), and add at least one real app **write** capability (e.g. app‑authored metafield/draft/resource write) gated by a declared scope. A partner with a valid token must be able to do more than read five prefixes for one hour.
- **H‑6 — `/oauth/token` client authentication.** Add `client_secret` (confidential apps) or PKCE (public apps) to the token exchange; the authorization code must not be the sole credential. Add refresh‑token issuance/rotation. Tests: code‑only exchange rejected; PKCE happy‑path; refresh rotation.
- **C‑4 — Mandatory compliance webhooks get emitters.** `customers/data_request`, `customers/redact`, `shop/redact` are force‑subscribed at install (`app-engine/src/index.ts:151‑153`) with zero emit sites. Add real emit sites: a data‑request/redact trigger (admin action or scheduled), routed through the outbox → `webhook-service` delivery path with HMAC. Tests: each topic emits, is signed, and is delivered (against a local sink).
- **H‑5 — Wasm function memory enforcement.** `memory_limit_kb` is stored but never enforced (`app-functions-runtime.ts:203` instantiates with `{}`); a CPU loop can stall the public checkout path. Enforce memory (WebAssembly.Memory `maximum`) and keep/strengthen the time + 64KB‑output caps; verify a hostile function is bounded, not fatal, on the checkout path. Test with a deliberately abusive module.
- **H‑11 / H‑12 — Event contract/emitter hygiene.** `payout.released`/`payout.failed` have contracts + templates but no emitter (dead consumers); `theme.purchase.*`/`theme.draft.*` are emitted with no registered `event-core` contract (skip validation, never reach webhook‑service). Pair every event: register missing contracts; add emitters or remove dead consumers. (Payout emitters may be `HONEST‑STUB` until F4's money path is real.)
- **Gate F3:** app token accepted by general auth + one write path (test); `/oauth/token` client‑auth + refresh (test); 3 compliance webhooks emit+sign+deliver (test); wasm memory bounded (test); every emitted event has a contract; governance green.

### PHASE F4 — Money honesty (real path behind credentials, honest state otherwise)
Goal: no fabricated settlement anywhere; real code path exists up to the credential boundary.
- **C‑5 — Remove fake app‑charge success + test‑mode payout.** Delete the fabricated `rzp_route_test_…` reference (`app-store.ts:1541`) and the hard‑coded `payout_provider_mode:'test'` + `pending` ledger writes (`queue-workers …:664`). Implement the real charge → approval → settlement and payout‑release code path behind a credential flag (`APP_BILLING_PROVIDER` / Razorpay Route or chosen rail). When the flag/keys are absent, return an explicit "app billing not configured" state and emit **no** settlement event. Wire `payout.released/failed` emitters into the real path (closing H‑11's stub).
- **H‑4 — theme‑marketplace checkout is a dead link.** "Pay" is a `<Link href="/checkout/success">` firing a toast with no payment intent (`theme-marketplace/.../checkout/page.tsx:206‑217`). Replace with a real payment‑intent call to the gateway, or an honest "checkout not available" state — never a success page without a charge.
- **Live execution = SKIP — NEEDS HUMAN.** Real PSP/payout keys, payout‑rail onboarding, GST/legal/pricing decisions → ledger SKIPs with exact creds. The code path must be complete and tested up to the key boundary (mock provider in tests).
- **Gate F4:** zero fabricated‑settlement greps; honest unconfigured states (tested); real path tested with a mock provider; live keys SKIP‑logged; governance green.

### PHASE F5 — Theme platform foundation
Goal: merchants preview real output, publish safely, and the section/Liquid model stops being closed.
- **C‑6 — Wire the web editor live preview.** The iframe+postMessage preview (`CenterPanel.tsx`) has zero importers; the editor renders a hardcoded `PREVIEW_PRODUCTS` mock (`editor/page.tsx:174`). Wire the editor to the **real** preview‑session bridge that already exists (gateway + storefront `/preview`, currently only the Flutter app uses it). Merchants must see real rendered output before publish. Screenshot evidence.
- **C‑8 — Two‑step publish + concurrency.** Split save‑draft from publish (no `make_store_live:true` on save); include `base_version` on the web save path so the existing server‑side conflict support actually prevents last‑write‑wins. Tests: concurrent edit conflict surfaced; draft≠live.
- **C‑7 — Data‑drivable section registry seam.** The JSON‑contract registry statically imports ~20 React renderers (`renderer-registry.tsx`); unknown types render `null`. Introduce a registration seam so section types can be added without editing the storefront (manifest/registry‑driven), and make unknown types render a visible, safe fallback (not silent `null`). Full open‑section ecosystem may phase; the seam + fallback + test ship now.
- **C‑9 — Liquid commerce object model + app‑embed seam.** `content_for_header/footer` are hardwired to empty strings (`theme-renderer.ts:246‑249`); the Liquid scope exposes only `shop/request/settings/routes/section/block` with no product/cart/customer objects and no Shopify filters. Add a commerce object model (product/cart/customer) and the core filters (`money`, `image_url`, …) to the Liquid runtime, and a real app‑embed injection point for `content_for_header/footer`. Minimum bar: a working seam + the highest‑value objects/filters + tests; full Shopify filter parity may phase (log the remainder).
- **H‑14 — De‑hardcode the demo store.** "Urban Kicks" short‑circuits the tenant/theme pipeline before any network call (`store-service.ts:54‑57`; fixture `lib/demo/urban-kicks-demo.ts`). Drive the demo from the same data path as real stores (seed it in the DB; remove the in‑code short‑circuit) so the flagship demo exercises the real pipeline.
- **Gate F5:** editor previews real output (screenshot); two‑step publish + conflict (test); section seam + safe fallback (test); Liquid commerce objects/filters + embed seam (test); demo store de‑hardcoded; governance green.

### PHASE F6 — Legacy domain disposition (decision‑gated)
Goal: the off‑domain portfolio/resume product stops masquerading as commerce.
- **H‑2 — Portfolio/resume/ATS quarantine (DECIDED: reversible quarantine, keep data).** Admin pages (`[store]/{experience,education,certifications,skills,projects,testimonials}`), gateway `/portfolio` + `/resume` routers (`index.ts:215‑216`), and 5+ tables. **Action (locked by the user):** feature‑flag the surface off by default and move the routers/pages behind the flag (data preserved, not deleted), and remove the legacy section type (`PortfolioGrid`) from the storefront theme vocabulary. Do **not** drop tables or delete data. The final keep‑vs‑permanently‑remove call stays the user's later decision — this phase only makes it off‑by‑default and reversible. No SKIP needed; the quarantine itself is the deliverable.
- **H‑3 — operator‑app honest placeholder.** `apps/mobile/operator-app` is the unmodified Flutter counter demo yet is governed as a real runtime. Either replace `main.dart` with an honest "operator app — not yet implemented" shell wired to `letbuyy_*` packages, or reclassify its manifest as `reserved/scaffold` so governance stops implying it's real. (Full operator app = `SKIP — NEEDS HUMAN` / future phase.)
- **Gate F6:** legacy domain flagged‑off or SKIP‑logged with data intact; operator‑app honest; governance green.

### PHASE F7 — Test & observability reality (the regression net)
Goal: deployable code has a real safety net; "certification" stops being document‑shaped.
- **C‑11 — Real test scripts.** Replace every `"test": "echo 'No tests yet' && exit 0"` across the 12 deployable workspaces with a runner that executes real tests. Add unit/integration tests for the subsystems touched in F1‑F5: customer+merchant auth, server cart, checkout/orders, payments idempotency (extend existing `__tests__`), app OAuth/token acceptance + write, compliance‑webhook emission, theme publish concurrency, Liquid commerce objects. Wire the 30 workspace packages to at least typecheck‑test. Keep the existing 149 governance `.test.mjs` + 128 validators green, but they are no longer the *only* tests.
- **Keep certification honest.** Load/chaos stay plan‑mode by default and keep `governance-contract-not-live-evidence` labels; do not let any new script claim live evidence it didn't gather. Live load/chaos execution = `SKIP — NEEDS HUMAN`.
- **Gate F7:** no `echo 'No tests yet'` remains; new behavior tests pass; `node --test` green; governance 128/128.

### PHASE F8 — Human‑gated proof & closeout
Goal: everything that needs a human is recorded precisely; everything else is green.
- Consolidate the `SKIPPED — NEEDS HUMAN` ledger: live PSP/payout keys, Supabase service‑role + prod DB apply, Cloudflare/Vercel/Resend creds, staging deploy for real‑stack E2E, payout‑rail + GST/legal/pricing decisions, keep‑vs‑remove legacy domain, full operator/shopper mobile apps, full Shopify Liquid filter parity remainder. Each with the exact command/credential/decision and what it unblocks.
- Final gate run: `pnpm turbo typecheck` · `pnpm lint` · `pnpm run validate:governance` (128/128) · full `node --test` · `pnpm turbo build`. Re‑verify the §2.2 positives still hold. Update the REGISTER STATUS so every C/H is `DONE | HONEST‑STUB | SKIP`.
- Write `CODEX_FOUNDATION_REMEDIATION_STATUS.md`: per‑item outcome, evidence pointers, and the human SKIP list. Mark COMPLETE only if §0.1 criteria 1‑9 are genuinely green and every remaining gap is a recorded human SKIP.

---

## 6. THE FULL ISSUE REGISTER (authoritative checklist — every row must reach DONE / HONEST‑STUB / SKIP)

> Evidence columns are abbreviated; full evidence + ✅ verification verdicts live in `FORENSIC_REPORT/16` and `FORENSIC_REPORT/17`. Codex must update each row's status in the ledger's REGISTER STATUS block.

### Critical
| ID | Finding | Key evidence | Phase | Target outcome |
|----|---------|--------------|-------|----------------|
| C‑1 | Entire backend is one Worker (SPOF); `storefront.ts` ≈4,900 LOC | `api-gateway/src/index.ts`, `routes/storefront.ts` | F1 | Internal decomposition (no new services) + single‑writer; topology documented honestly. Full multi‑service split = SKIP/future |
| C‑2 | 6 declared services are code‑free | `services/*/runtime.manifest.json` (2‑file dirs) | F0 | Manifests relabeled reserved/contract‑only; map points to real execution site |
| C‑3 | App platform can't host a real app (tokens at 1 GET proxy) | `app-store.ts:1253`; `authMiddleware` | F3 | App tokens accepted platform‑wide + one write capability |
| C‑4 | Mandatory compliance webhooks never emitted | `app-engine/src/index.ts:151‑153`; 0 emit sites | F3 | Real emitters + signed delivery + tests |
| C‑5 | App billing moves no money (fake `rzp_route_test_`; test‑mode payout) | `app-store.ts:1541`; `queue-workers…:664` | F4 | Fake removed; real path behind creds; honest state off; live=SKIP |
| C‑6 | Web theme editor preview unwired (mock products) | `CenterPanel.tsx` 0 importers; `editor/page.tsx:174` | F5 | Editor wired to real preview bridge (screenshot) |
| C‑7 | Section vocabulary compiled into storefront | `renderer-registry.tsx`; unknown→null | F5 | Registration seam + safe fallback + test |
| C‑8 | Web publish one‑step to live, last‑write‑wins | `editor/route.ts`; no `base_version` | F5 | Two‑step publish + base_version concurrency + test |
| C‑9 | No app embeds; Liquid has no commerce object model | `theme-renderer.ts:246‑249` | F5 | Commerce objects + core filters + embed seam + test (parity remainder phased) |
| C‑10 | No server‑side cart (localStorage only) | `cart-context.tsx:28/43`; `public.carts` unwired | F2 | Server cart + tokens + merge + test |
| C‑11 | Tests/certification are document‑shaped (`echo 'No tests yet'`) | all 12 deployable `test` scripts | F7 | Real test scripts + behavior tests |
| C‑12 | `AGENTS.md` describes a DB that no longer exists (65 mig/228 tbl/`065`) | `AGENTS.md` vs disk | F0 | Docs corrected to real lineage |
| C‑13 | 3 governance sources disagree on runtime inventory | `CLAUDE.md` / `runtime-boundaries.md` / disk | F0 | One canonical map; portal+queue‑workers classified |
| C‑14 | Observability contract with no producer | Prom/Grafana/SLO metrics; no `writeDataPoint` | F0 | Emit referenced metrics or mark contract‑only |

### High
| ID | Finding | Key evidence | Phase | Target outcome |
|----|---------|--------------|-------|----------------|
| H‑1 | Dual write‑ownership of `orders`/`products` | `webhook-service/src/index.ts:412/430/468/503/1010` | F1 | Single writer of record + test |
| H‑2 | Legacy portfolio/resume/ATS live in commerce admin | `[store]/…/page.tsx`; `index.ts:215‑216` | F6 | Flag‑off/quarantine (data kept) or SKIP decision |
| H‑3 | operator‑app is Flutter counter demo, governed as real | `operator-app/lib/main.dart:15,57,107` | F6 | Honest placeholder / reclassify manifest |
| H‑4 | theme‑marketplace checkout is a dead link | `…/checkout/page.tsx:206‑217` | F4 | Real intent or honest unavailable state |
| H‑5 | Wasm `memory_limit_kb` stored, never enforced | `app-functions-runtime.ts:203` | F3 | Enforce memory+time caps + hostile‑module test |
| H‑6 | No client auth at `/oauth/token` (code‑only) | `app-store.ts` OAuth flow | F3 | client_secret/PKCE + refresh rotation + test |
| H‑7 | Merchant password verified in Next app; hash over HTTP; 2 cost factors | identity vs gateway | F2 | Verify in gateway via auth‑core; single cost; hash never leaves |
| H‑8 | `@letbuyy/utils` dead edge exporting service‑role client to apps | 8 `package.json` vs 0 imports | F1 | Remove edge / stop exporting admin client to apps |
| H‑9 | God file `storefront.ts` (~4,900 LOC/60 handlers) | `routes/storefront.ts` | F1 | Decompose into sub‑routers (no behavior change) |
| H‑10 | Queues with consumers but no producers (NOTIFICATION/SEARCH/RUNTIME) | wrangler vs send sites | F0/F3 | Add producers or mark consumer dormant honestly |
| H‑11 | `payout.released/failed` contracts but no emitter | event registry vs emit | F3→F4 | Emitters wired in real money path |
| H‑12 | Theme/payout events emitted with no registered contract | gateway emit sites | F3 | Register contracts; route through spine |
| H‑13 | No theme/app developer tooling (CLI/check/scaffold/SDK key) | absence in `packages/`,`scripts/` | F8 | Mostly SKIP/future; ship manifest‑upload seam if cheap |
| H‑14 | Demo "Urban Kicks" hardcoded, bypasses pipeline | `store-service.ts:54‑57` | F5 | DB‑seeded demo; remove short‑circuit |
| H‑15 | Two prod deploy workflows race on push to main | `.github/workflows/*` | F0 | One gated prod path; live deploy=SKIP |
| H‑16 | Static shared bearer token sole auth for ops/admin plane | ops/admin auth path | F2/F8 | Per‑operator identity (design) ; live rotation=SKIP |
| H‑17 | Storefront login abuse + non‑prod internal trust gap | `routes/storefront.ts:1693` | F2 | Internal secret required all envs (customer abuse done P0‑D) |

> Medium/Low tails (CORS credentialed wildcard, 121 raw‑error sites, base‑URL defaults pointing at staging, unused `VERCEL_PROJECT_ID_*`, stale root `.md` residue, etc.) are addressed opportunistically inside the owning phase or logged in the ledger; they do not gate COMPLETE but must not regress governance.

---

## 7. WHAT "FUNDAMENTALLY STRONG" MEANS AT THE END (definition of done, in prose)

After this mission, a reader of `AGENTS.md`/`CLAUDE.md` gets the *true* topology; a partner can OAuth, hold a real token, write something, and receive the compliance webhooks they're forced to subscribe to; a merchant previews real theme output and publishes safely without clobbering a colleague; a shopper has a server‑side cart; no code path fabricates a settled charge; every deployable workspace runs real tests; the alert stack is fed by real metrics or is honestly marked contract‑only; and every remaining gap is a single, precise `SKIP — NEEDS HUMAN` line with the exact key, deploy, or decision that unblocks it. The governance suite is still 128/128 — but now it sits on top of a system whose documents tell the truth and whose money, apps, themes, cart, and tests are real.

**Begin with F0. Do not stop until every unblocked item in §6 is DONE or HONEST‑STUB and every blocked item is a recorded human SKIP.**
