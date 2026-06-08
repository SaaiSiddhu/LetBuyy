# CODEX MISSION — Domain Phase Finalization (Production Hardening + Buy-a-Domain)

> **You are Codex operating on the LetBuyy monorepo, locally, in one continuous mission.**
> The domain-split foundation (DS-1…DS-11) is already implemented in the working tree. This mission
> **finishes the domain phase to production-grade** and builds the remaining features we committed to,
> end to end, in a single run. Where a step needs an account, secret, registrar, DNS/Vercel, or other
> human/external action, **do NOT stop** — implement the code so it is ready, mark that step
> `SKIPPED — NEEDS HUMAN`, record it in the ledger + status punch-list with the exact future proof
> command, and continue. Keep the governance gate green throughout.

---

## 0. Canonical sources (read first, in order)

1. `AGENTS.md` (root) — engineering constitution. Obey it first; on conflict, it wins.
2. `DOMAIN_PHASE_DECISIONS.md` — the **locked decisions D1–D4** this mission implements.
3. `docs/governance/domain-topology-governance.md` — canonical topology.
4. `CODEX_DOMAIN_SPLIT_STATUS.md` — what DS-1…DS-11 already did + the existing SKIPPED list + the
   **branch-collision blocker** (the prior mission left work uncommitted on `stream/letbuyy-ui-v2`).
5. `LETBUYY_STOREFRONT_ACCESS_V1.md` — access/preview model.
6. Local `AGENTS.md` in each `apps/*`, `services/*`, `infrastructure/*` you touch.

---

## 1. Locked decisions this mission must honor (from DOMAIN_PHASE_DECISIONS.md)

- **D1** Shopper accounts = **per-store, host-only cookie**, with a swap-later **seam in `@letbuyy/auth-core`**; reserve **`id.letbuyy.store`** (NOT `accounts.letbuyy.store`). Shopper identity stays in the `.store` realm; never grants a `.com` platform session.
- **D2** Custom-domain CNAME target = **`connect.letbuyy.store`** (LetBuyy-owned; → Vercel for now). This **replaces** `cname.vercel-dns.com` in code + merchant instructions. **Front-load the chained-CNAME validation (DF-1).**
- **D3** Vercel domain attach = **automate via the Vercel Domains API** (token is human-gated; code is env-driven, fail-loud).
- **D4** Buy-a-domain = build it **last** in this mission (registrar account + live purchase are human-gated; build the full code path behind a pluggable provider).

---

## 2. Non-negotiable repo idioms (unchanged — this is how the gate stays green)

- **Branch & commit (READ DF-0 — this is delicate this time).** Never stash/reset/force user-owned dirty work.
- **Mission bookkeeping:** create `CODEX_DOMAIN_FINALIZATION_LEDGER.md` (ARCHITECTURE-DIRECTION DECISIONS, BASELINE, timestamped PROGRESS LOG with exact commands + pass counts) and `CODEX_DOMAIN_FINALIZATION_STATUS.md` (current phase, gate state, consolidated `SKIPPED — NEEDS HUMAN` punch-list with exact future proof commands). Mirror the existing CODEX_* files' style.
- **Every structural change ships a validator + a contract test**, wired into `scripts/validate-governance.mjs`. A change without regression enforcement is incomplete.
- **Single-writer:** only `services/api-gateway` writes domain/site tables; storefront, merchant UI, and mobile call gateway endpoints — never the DB. Extend `single-writer-ownership-validator.mjs` for any new owned tables.
- **Naming:** DB table is **`sites`** (never `stores`). **No hardcoded `.com`/`.store`/`vercel-dns.com` literals in source** — all hosts come from env (`environment-honesty-validator` will fail you); the only literal target string allowed is what env templates document.
- **Generated artifacts:** before every `validate:governance`, clean workspace-local `node_modules/.turbo/dist/.next`, then regenerate intelligence where required.
- **Sandbox flakes:** registry DNS `ENOTFOUND`, tsx IPC `EPERM`, port-bind — retry/escalate and record; a real error after escalation must be fixed.
- **Baseline gate is `163/163` PASS** (DS mission end state, after artifact clean). New validators must raise this; end ≥ 163, all PASS.

---

## 3. DF-0 — Branch hygiene + baseline (do first; be careful)

1. Record the actual branch state. The DS work is currently uncommitted in the worktree (likely on `stream/letbuyy-ui-v2`, intermingled with UI-v2 dirty files).
2. **Goal: get the domain-split + finalization work onto `stream/domain-split-foundation` without losing any user-owned changes.** Preferred safe path:
   - Identify the domain-split/finalization files (the DS deliverables + this mission's new files). Commit **those** onto `stream/domain-split-foundation` (create it at the current HEAD if needed), leaving unrelated UI-v2 dirty files untouched.
   - If git cannot do this without overwriting dirty user files, **do not force it** — instead commit a labeled WIP snapshot on the current branch so nothing is lost, and record a `SKIPPED — NEEDS HUMAN` to finish branch isolation + PR. Never stash/reset/checkout-over dirty files.
3. Capture the baseline gate verbatim in the ledger:
   ```
   pnpm install --frozen-lockfile --force
   pnpm turbo typecheck --output-logs=errors-only --log-order=grouped
   pnpm lint
   pnpm turbo test --output-logs=errors-only --log-order=grouped
   pnpm run test:contracts
   pnpm run test:behavioral
   flutter analyze apps/mobile/merchant-app packages/dart/core packages/dart/models
   # clean generated artifacts, then:
   pnpm run validate:governance
   ```

---

## 4. Phases — implement all, in order. End each green; log evidence.

### DF-1 — D2: switch custom-domain target to `connect.letbuyy.store` + chained-CNAME smoke test (FRONT-LOADED RISK)
- **Goal:** merchants point at `connect.letbuyy.store`; prove Vercel still issues a cert through the chain before anything else depends on it.
- **Do:**
  - In `infrastructure/dns/dns.tf` (storefront zone), add a `connect` record → Vercel target (`cname.vercel-dns.com`), proxied=false. Keep the wildcard untouched.
  - Replace `cname.vercel-dns.com` with the env-driven custom-domain target (`NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET` / worker env, default documented as `connect.letbuyy.store`) in `services/api-gateway/src/routes/custom-domains.ts`, the merchant settings UI instructions, and the mobile screen. No hardcoded literal in source.
  - Keep `www` canonical; for apex, surface an ALIAS/flattening instruction (apex cannot CNAME).
  - Write `docs/runbooks/custom-domain-cname-smoke-test.md`: the exact steps to validate one real domain end-to-end (add via Vercel API → cert issues → serves) and the fallback (revert to `cname.vercel-dns.com` or stand up the Phase-2 Worker behind `connect.letbuyy.store`).
- **SKIPPED — NEEDS HUMAN:** create the `connect.letbuyy.store` DNS record (apply Terraform) and run the live smoke test with one real domain. Proof: `terraform apply` + add a test domain + `curl -I https://<test-host>`.
- **Enforce:** `tests/contracts/custom-domain-target.test.ts` (target is env-driven, equals the documented value in templates, no `vercel-dns` literal in source).

### DF-2 — D3: Vercel Domains API automation + status source-of-truth
- **Goal:** verified custom domains attach to the storefront Vercel project automatically; cert/config status drives `custom_domain_status`.
- **Do (in `services/api-gateway`):** add a Vercel API client (`src/lib/vercel-domains.ts`) reading `VERCEL_API_TOKEN` + `VERCEL_STOREFRONT_PROJECT_ID` (env, fail-loud). On TXT-verify success → `POST /v10/projects/{id}/domains`; expose a status read (`GET .../domains/{domain}/config`) consumed by the reconciler (DF-6). Map Vercel states → `pending|verifying|active|error`. Idempotent; handle already-attached + rate limits with backoff.
- **SKIPPED — NEEDS HUMAN:** create the Vercel team token + project id; store as gateway secrets. Proof: set secrets, then attach a domain via the verify endpoint and confirm Vercel issues the cert.
- **Enforce:** `tests/contracts/vercel-domain-attach.test.ts` (attach called on verify; env fail-loud; idempotent; no token in source). Add the Vercel env names to worker schema/templates/secret-matrix (names only).

### DF-3 — #4: surface the apex/MX email-clobber warning (web + mobile)
- **Goal:** the merchant is warned before an apex CNAME kills their email.
- **Do:** the gateway already returns `apex_mx_warning`. Surface it prominently in `apps/merchant-control-plane/.../settings/domains/page.tsx` and the mobile `domain_settings_screen.dart` (e.g. "Your domain has email (MX) records — use `www` or an ALIAS at the apex, or your email may stop working").
- **Enforce:** `tests/contracts/apex-mx-warning.test.ts` (UI renders the warning when the flag is set).

### DF-4 — #5: wire password brute-force lockout to `site_gate_attempts`
- **Goal:** the shared store password cannot be brute-forced.
- **Do (gateway):** on each `POST /v1/internal/store-access/verify`, record an attempt in `site_gate_attempts`; enforce per-IP + per-site rate limit with backoff/lockout (reuse `middleware/rateLimit.ts` patterns); return a generic throttle error; keep verification constant-time.
- **Enforce:** `tests/contracts/store-password-lockout.test.ts` (N failures → lockout; success resets; constant-time path).

### DF-5 — #6: abuse / phishing screening on custom-domain claims
- **Goal:** block obvious brand-impersonation domains before issuance.
- **Do (gateway, on `POST /v1/custom/domains`):** add a screening step — homoglyph/edit-distance against a curated **protected-brand list** (banks/UPI/govt/large retail) + static blocklist; optional reputation provider (Safe Browsing / Spamhaus / urlhaus) behind `ABUSE_REPUTATION_*` env. **Risk tiers:** low → allow; medium → status `review` + persist to a manual-review queue; high → reject. **Fail-safe:** if no reputation key configured, default medium-risk matches to the review queue (never silently allow). Add a `site_domain_reviews` table (gateway-owned) and an internal endpoint for a human to approve/deny.
- **SKIPPED — NEEDS HUMAN:** reputation API keys; staffing the review queue. Proof: set `ABUSE_REPUTATION_*`, submit a known-bad domain → expect block/review.
- **Enforce:** `scripts/validators/custom-domain-abuse-screening-validator.mjs` + wire in; `tests/contracts/custom-domain-abuse-screening.test.ts` (lookalike → review/reject; clean → allow; no-key → fail-safe to review).

### DF-6 — #7: custom-domain status-drift + cert reconciler
- **Goal:** detect when a live domain breaks (CNAME/TXT removed, cert lapsed, Vercel config invalid) and react.
- **Do (in `services/queue-workers` + a scheduled trigger):** periodically re-check each `active` custom domain — TXT presence, CNAME → target, and Vercel cert/config status (via DF-2 client). On drift → flip `custom_domain_status` to `error` (or `verifying`), emit an alert/event, and surface it to the merchant; never auto-delete. Respect beta free-tier scheduling conventions already in the repo (no churny crons).
- **Enforce:** `scripts/validators/custom-domain-reconciler-validator.mjs` + wire in; `tests/contracts/custom-domain-reconciler.test.ts` (drift → error + alert; recovery → active).

### DF-7 — D1: shopper-auth seam + reserve `id.letbuyy.store`
- **Goal:** lock per-store shopper identity behind a swappable interface; reserve the future central host.
- **Do:** define a `ShopperIdentityProvider` interface in `@letbuyy/auth-core` (issue/verify shopper session token), with the current per-store host-only implementation behind it; storefront `session.ts` consumes the interface. Reserve `id.letbuyy.store` in `infrastructure/dns/dns.tf` (commented/placeholder) + env docs + `DOMAIN_PHASE_DECISIONS.md` cross-ref. Do **not** build central OIDC now.
- **Enforce:** `scripts/validators/shopper-identity-seam-validator.mjs` + wire in; `tests/contracts/shopper-identity-seam.test.ts` (storefront uses the interface; cookie stays host-only; no `.com` session reachable from shopper path).

### DF-8 — D4: buy-a-domain (registrar resale) — full code path, live calls human-gated
- **Goal:** a merchant with no domain can search, buy, and auto-connect a domain inside LetBuyy.
- **Do:**
  - Gateway: a pluggable `DomainRegistrarProvider` interface (`src/lib/registrar/`) with a **ResellerClub** (default) and an **OpenSRS** adapter, behind `REGISTRAR_*` env (fail-loud). Endpoints: `GET /v1/domains/search` (availability + price), `POST /v1/domains/purchase` (create order → register), and on success **auto-configure** DNS to LetBuyy-controlled nameservers/records and mark the site's `custom_domain` active (reusing DF-2 attach + the access state machine) so there are zero merchant DNS steps. Persist orders in a gateway-owned `domain_orders` table. Payment reuses the existing Razorpay path.
  - Merchant UI (`settings/domains`) + mobile: a "Buy a domain" search→price→checkout→auto-connect flow.
- **SKIPPED — NEEDS HUMAN:** registrar reseller account + API credentials (ResellerClub Mumbai or OpenSRS); pricing/markup policy. Proof: set `REGISTRAR_*`, search a domain, complete a sandbox purchase.
- **Enforce:** `scripts/validators/registrar-provider-validator.mjs` + wire in; `tests/contracts/buy-a-domain.test.ts` (search/purchase/auto-connect happy path with a mock provider; no-credential → fail-loud, no silent purchase; single-writer ownership of `domain_orders`).

### DF-9 — Governance finalize
- Regenerate intelligence (`node scripts/generate-repository-intelligence.mjs`); ensure all new validators are wired; clean artifacts; run the full DF-0 gate block to green (≥ baseline+new). Update the finalization ledger (final evidence) and status (final count + consolidated SKIPPED punch-list). Open/update the PR on `stream/domain-split-foundation` summarizing DONE vs SKIPPED — NEEDS HUMAN (or record the branch blocker if isolation could not complete in DF-0).

---

## 5. Consolidated `SKIPPED — NEEDS HUMAN` (carry forward + new; record each with a proof command)

Carried from `CODEX_DOMAIN_SPLIT_STATUS.md`: Cloudflare zone + nameservers; Vercel host attach; env cutover flip; 301s + Worker-route move + `cloudflare-topology.json`; run migration 090; PR/branch isolation.
New this mission: create `connect.letbuyy.store` record + live chained-CNAME smoke test (DF-1); Vercel API token + project id (DF-2); abuse reputation API keys + review-queue staffing (DF-5); registrar reseller account + credentials + markup policy (DF-8).

---

## 6. Definition of done

- DF-1…DF-8 implemented in code; each with a validator + contract test wired into the gate.
- `pnpm run validate:governance` green at ≥ baseline+new; `typecheck`, `lint`, `turbo test`, `test:contracts`, `test:behavioral`, `flutter analyze` all pass (sandbox flakes excepted + recorded).
- Invariants intact: no hardcoded host literals in source; no storefront/mobile DB writes; `sites` naming; host-only shopper cookies; live `COOKIE_DOMAIN` default still `.letbuyy.store`; custom-domain target env-driven = `connect.letbuyy.store`.
- Ledger + status complete with the SKIPPED punch-list + exact future proof commands.
- PR opened on `stream/domain-split-foundation` (or branch-isolation blocker recorded if unavoidable).

---

## 7. Decision defaults (already locked in DOMAIN_PHASE_DECISIONS.md — do not re-litigate)

D1 per-store + seam + reserve `id.letbuyy.store`; D2 `connect.letbuyy.store`; D3 Vercel API automate now; D4 buy-a-domain last (ResellerClub default, OpenSRS adapter). Store password = Argon2id; preview = 30 min / 7 days; abuse screening fail-safe = route to manual review when uncertain.
