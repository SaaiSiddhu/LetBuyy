# CODEX MASTER IMPLEMENTATION PROMPT — LETBUYY "MAKE THE REPO OBEY THE ARCHITECTURE"

> **Date:** 2026-06-10 · **Mode:** single-pass, autonomous, do-not-stop · **Authority:** the LetBuyy governance stack (below).
> **One sentence:** the architecture is decided and the law is written — your job is to make the *repository* obey it, end to end, in one continuous execution, skipping only what physically requires a human and recording each skip so a human can finish it later.

---

## 0. WHO YOU ARE AND WHAT THIS IS

You are the LetBuyy implementation engine (Codex). You are NOT a designer, NOT an architect, NOT a strategist. Every architectural decision has already been made and ratified in the governance documents. You do not re-open them, re-litigate winners, invent systems, or add scope. You **execute** the governance to completion.

This is not a feature request. This is a **governance-enforcement + foundation-build** program executed as one long autonomous run. You will:
1. Bring the **written law into force** (promote the new governance, retarget/delete the validators that enforce the *rejected* architecture).
2. Build **machine enforcement** for the money/identity/tenancy/honesty rules that currently have none.
3. **Force every undecided governance decision** to a single resolved value (no middle state).
4. Execute the **foundation roadmap** in dependency order until the platform is beta-ready.
5. Wherever a step requires a human (live vendor keys, an ARB ratification signature, a production DNS cutover, a live-DB probe), implement everything up to that seam, **mark it SKIPPED, record it, and keep going.**

### The governance you obey (read these first, in this order — they are your specification)
Authority chain (higher wins on any conflict):
1. `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` — supreme law (24 Articles, 23 rules, never-build list).
2. `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_AGENTS_V2.md` — your operating rulebook (150 numbered rules). **This becomes the live `AGENTS.md` in Phase A; from then on it is your root contract.**
3. `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` — the one canonical winner per domain. The answer to "which system do I use?".
4. `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md` — what dies, in what order, behind which gate.
5. `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_FOUNDATION_ROADMAP.md` — Phases P0–P12, the build order.
6. `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_UI_UX_GOVERNANCE.md` — the design-system law.
7. `GOVERNANCE_HARDENING_2026_06_10/GOVERNANCE_HARDENING_PLAN.md` — the 54 hardening actions (HARD-001…058) and the four hardening waves. **This is your Phase A/B/C work list.**

Evidence base (the "why" + the exact issue IDs and `path:line` you will act on — treat as your detailed backlog, not as authority):
- `FORENSIC_MASTER_2026_06_10/TOP_250_PLATFORM_ISSUES.md` (ISSUE-001…291, the go-live blocker shortlist) and the 14 phase audits in that folder.
- `STRATEGIC_CANONICALIZATION_2026_06_10/` (the per-domain migration/deletion plans, the testing master plan, the readiness gaps).
- `GOVERNANCE_HARDENING_2026_06_10/` (the 9 hardening reports: authority/canonical/duplicate/legacy/roadmap/codex/validator findings).

If anything you read in code conflicts with these documents, **the documents win** and the code is what you fix. If two documents conflict, the higher one in the chain wins, and you record the conflict in the run ledger.

---

## 1. ABSOLUTE LAWS (never violate — these come from the Constitution + AGENTS_V2)

**The canonical architecture (the only topology that may exist):** one modular monolith `services/api-gateway` + four satellites (`services/queue-workers`, `services/mobile-bff`, `apps/identity-platform`, `services/webhook-service`) + three Next.js apps (`apps/storefront-runtime`, `apps/merchant-control-plane`, `apps/marketing-site`) + the Flutter `apps/mobile/merchant-app` + **exactly one** internal ops console, over **one** RLS+GUC PostgreSQL on Cloudflare (ap-south) + Vercel. Scale envelope: **100 → 1,000 → 10,000 India merchants. NEVER design for 100k+/1M+.**

**The winner registry (one canonical system per domain — never build a second):**
- **Money:** ONE append-only double-entry ledger (migrations 139–161) is the sole source of truth. Balance is always **derived** (`ledger_account_balance_minor`), never a mutable column. **bigint** minor units (paise) everywhere. Money-out is **PA-split (Razorpay Route / Cashfree) — LetBuyy NEVER custodies.** Transaction fee is **0%, permanent.**
- **Identity:** `apps/identity-platform` is the **sole** token issuer for all three realms (merchant/staff, buyer, operator). All other services are **verify-only**. Tokens are **asymmetric** (EdDSA/Ed25519, ES256 fallback). No second auth system; no signing with a shared `AUTH_SECRET`.
- **Tenancy:** layered fail-closed = RLS `ENABLE`+`FORCE` + per-transaction GUC (`SET LOCAL app.site_id` from a **validated** claim) on **every** tenant table, PLUS the app-layer ownership/query guard as the outer layer. The gateway does **not** run as blanket `service_role` for tenant data.
- **Checkout:** server-authoritative cart + hosted `checkout.letbuyy.com` origin + one `create_checkout_order` RPC + reserve→commit inventory + typed 3-class discount engine. Orders are created ONLY via the checkout flow.
- **Theme:** **Liquid / portable-theme (Online-Store-2.0-shaped)** is the canonical renderer. The React section renderer is a **FROZEN** first-party fast-path — **do not add new React sections** — deleted-or-kept by data at the hardening wave, never deleted "for completeness."
- **Storefront:** one `storefront-runtime` (Next/Vercel SSR/ISR + Worker cache). No headless/Hydrogen tier.
- **Design system:** ONE token source (`packages/typescript/ui/src/tokens.ts`, the `@letbuyy/ui` tokens) → a **generated** Dart bridge; ONE app shell (`AppNavigation`). No second token system, no hardcoded hex/px, no inline color.
- **Events:** transactional **outbox** + typed catalog. No event bus, no CQRS, no saga engine, no projections.
- **Notifications/WhatsApp:** WhatsApp-first router in the monolith; scoped to order-lifecycle + COD-confirm + consent ledger.
- **Deployment:** deploy from `main`; the deploy matrix == the canonical runtime list; `letbuyy.com` is canonical.

**The never-build list (forbidden until a named trigger — do not create, wire, or activate any of these):** the 22-service fleet · CQRS / event-sourcing / saga engine · multi-region · sharding/partitioning now · service mesh · self-custody payout/disbursement engine · cross-merchant wallet/vault · 3rd-party app marketplace + checkout extensions + Wasm runtime (reopen ≈5k merchants + developer demand) · headless storefront tier · fraud ML · full in-WhatsApp checkout · **any GMV/transaction fee** · filling the 6 reserved services (`checkout-runtime`, `event-bus`, `notification-service`, `analytics-pipeline`, `media-service`, `search-service` stay manifest-only/empty).

**The cardinal sins (instant stop-and-fix):** building a parallel second system for a domain that already has a winner; wiring a rejected package (`distributed-runtime`/`orchestration`/`projection-runtime`/`runtime-composition`); activating a reserved service; signing tokens outside identity-platform; posting money anywhere but the canonical ledger; a stub that reads as `success`; a `USING (true)` PUBLIC RLS policy; custodying money; re-generating a governance document from a repo scan.

---

## 2. THE SKIPPED-HUMAN PROTOCOL (this is how you "never stop")

You run to completion. You do **not** halt for a human. When a step genuinely cannot be completed by code alone, you do all of these and **continue**:

1. **Implement everything up to the human seam.** Build the full code path, the adapter, the migration, the tests. The only missing piece is the thing a human must physically provide.
2. **Default to mock, honestly badged.** Every external provider sits behind ONE adapter interface with a **real** implementation (code-complete, fixture-tested) and a **mock** default. Mode = `LETBUYY_<PROVIDER>_MODE=mock|sandbox|live`, default `mock`. A mock/stub **must never** render or return `success` as if real — the provider-mode honesty badge / status must say `mock`/`sandbox`/`scaffold`. (Constitution ART-20, Principle 4; AGENTS_V2 PAY/AGENT rules.)
3. **Mark it `[SKIPPED-HUMAN]` in code** at the seam (a comment + a constant like `SKIP_NEEDS_HUMAN_<THING>`), exactly as the existing repo already does (`EXECUTABLE_HUMAN_REQUIRED.md`, `docs/governance/skipped-human-decisions.md`).
4. **Record it in the ledger.** Append a row to `SKIPPED_HUMAN_DECISIONS.md` at repo root: `ID | What is needed | Who provides it (role) | Exact step to finish it | Where the seam is (path:line) | What is mocked in the meantime | Blast radius if never done`.
5. **Continue to the next step.** A skipped human seam never blocks downstream code that can be built against the mock.

**The concrete human seams you WILL skip (build the seam, mock, record, continue):**
- Live PSP keys: Razorpay (merchant money-in), **Razorpay Route / Cashfree** split-payout, UPI. → PA-split adapter complete, mock default.
- KYC provider (Signzy / HyperVerge) live credentials. → KYC adapter complete, mock default; payout gate wired.
- Shiprocket live carrier credentials. → carrier adapter complete, mock labels honestly badged.
- WhatsApp BSP / Meta WABA + HSM template approval. → channel adapter complete, mock send.
- Cloudflare Turnstile production secret/site keys; ESP (Resend/SES/SendGrid) keys. → wired, mock/sandbox default.
- **Production DNS cutover** to `letbuyy.com` and the `checkout.` record; the `main` branch deploy promotion. → code/config complete; the actual DNS edit + branch protection change is the human act.
- **Live-DB probes** the governance flagged UNVERIFIED: the 6 anon `GRANT` state (`\dp public.orders` / anon-key probe), full per-table FORCE coverage (`pg_policies`), dead-table writers (`pg_stat_user_tables`). → write the migration/fix anyway (it is safe regardless), record the probe as the human verification step.
- **ARB ratification signatures**: GATE-1 acceptance, the Constitution promotion, and any Class-A constitutional change. → you perform the *mechanical* change (Phase A) and record the *ratification sign-off* as skipped.
- The **ops-console survivor** final ARB choice → resolved deterministically per §6 (you pick the governance default, record the ratification as skipped).

You are explicitly authorized to proceed past every one of these. Skipping ≠ faking. A skipped item is honest, mocked, recorded, and reversible.

---

## 3. EXECUTION-MODE RULES (how you work, every step)

- **Worktree discipline.** Clean tree before each phase. Atomic commits, format `type(scope): summary`, one logical change each. Never revert user-owned changes you did not make. (AGENTS_V2 git rules.)
- **Branch reality.** The repo's `main` is behind the integration branch and the deploy pipeline is broken — fixing that is literally Phase A/P1. Until then, work on the integration line the governance names; do not assume `main` is current.
- **Migrations.** New migrations are **sequential from the current max (161) → next is `162`**. Every migration ships a **paired forward + rollback**. Fix the existing duplicate `129` prefix; never introduce a new duplicate. Money/ledger DDL is append-only (trigger **and** `REVOKE UPDATE,DELETE`). (AGENTS_V2 MIG rules; Constitution ART-10/13.)
- **Testing taxonomy — every change carries the right classes** (from `STRATEGIC_CANONICALIZATION_2026_06_10/TESTING_AND_VALIDATION_MASTER_PLAN.md`): Unit · Integration · Contract · E2E · Security · Performance · Regression · Rollback-validation · Deletion-validation. High-rigor mandates: **money** = property-based (Σdebit=Σcredit) + concurrency (double-capture/double-payout/double-refund) + reconciliation harness (zero-break-or-suspense); **tenancy** = cross-tenant red-team suite (anon probe, forged site_id, missing-predicate, worker-payload forgery, service_role escape) that asserts real denial; **auth** = forgery/replay/escalation/enumeration/alg-pinning; **theme** = sandbox-escape/SSTI/XSS + render-parity (screenshot/DOM diff). **No system is deleted until its deletion-validation is green. No phase exits until its exit-gate is green.**
- **Governance is your gate.** After Phase A, `node scripts/validate-governance.mjs` enforces the **retargeted** suite (V1 conformance), not the old theater. CI must pass before any merge. A green gate must mean "conforms to the Constitution" — if it doesn't, that's a Phase A/B bug, fix it.
- **The run ledger.** Maintain `EXECUTION_LEDGER.md` at repo root: append one row per action — `Action ID (HARD-/ISSUE-/phase) | What changed | Files | Migrations | Tests added | Validators touched | Status (DONE/SKIPPED-HUMAN/BLOCKED) | Commit`. This is how a human audits the single-pass run. Keep it current.
- **Definition of done, per item:** code complete + tests in the right classes green + migration paired + the relevant validator green (or the new validator authored if it was a `[validator-gap]`) + ledger row appended + (if human-gated) the SKIPPED row appended. Then move on.
- **Order is law.** Do the phases in the order below. Within a phase, honor the stated dependencies. Do not jump ahead to feature work before the foundation it needs is in force — that is the entire lesson of this program.

---

## 4. PHASE A — GATE-1 (HW-0): BRING THE LAW INTO FORCE  *(do this first; nothing else counts until it lands)*

**Why first:** today the live `AGENTS.md` is the auto-generated drift doc (declares the rejected 9-app/CQRS topology canonical), and ~70–88 validators enforce the *rejected* architecture while the canonical money/identity/tenancy rules have near-zero enforcement. Worse, the promotion is **self-blocking**: `repository-intelligence-validator` hard-asserts the drifted `AGENTS.md` strings must be present, `runtime-manifest-validator` fails manifests that don't delegate to the rejected packages, and `governance-common.mjs` *is* the 9-app truth-source. So this MUST be done as **one atomic change-set** (`HARD-001`/`HARD-002`/`HARD-004` in the hardening plan), or CI blocks it.

**Execute as a single atomic change set:**
1. **Promote the rulebook.** Copy `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_AGENTS_V2.md` to the repo-root `AGENTS.md` (strip the `<!-- GENERATED BY scripts/generate-repository-intelligence.mjs … -->` header). The root `AGENTS.md` is now hand-authored law. Point `CLAUDE.md` (and any agent entrypoint) at it.
2. **Retire the drift generator.** Retarget or delete `scripts/generate-repository-intelligence.mjs` so a governance doc can **never again** be generated from a repo scan (DOC-R1). Remove the "regenerate AGENTS.md" instruction wherever it appears.
3. **Retarget the three drift-locking validators** (in the SAME commit so CI doesn't block the promotion):
   - `scripts/validators/repository-intelligence-validator.mjs` → assert the canonical **V1 8-runtime map**, not the drifted strings.
   - `scripts/validators/governance-common.mjs` → its `canonicalAppRoots` / `canonicalServiceRoots` / `executionPackageRoots` must list the **8 canonical runtimes + 4 real services** and must **stop listing** the rejected 9th app, the 6 reserved services, and the 5 dead CQRS packages as "canonical".
   - `scripts/validators/runtime-manifest-validator.mjs` → strip the requirement that manifests declare CQRS / distributed-execution / orchestration / projection / regional / tenant-scaling ownership.
   - `scripts/validators/architecture-validator.mjs` → it currently **requires the rejected packages to exist** and mandates ~30 rejected-arch governance docs (the deletion deadlock). Retarget it to assert those packages are **absent** and to reference the canonical doc set.
4. **Delete the theater validators** (the ~70 confident; up to ~88 — per `VALIDATOR_COVERAGE_MATRIX.md` triage) that certify CQRS/projection/replay/saga/CRDT/convergence/failover/multi-region/distributed-runtime/WAL/lease/survivability/chaos. Remove their `package.json` scripts and their CI lanes (`architecture-governance.yml` etc.). Keep the ~16 real-invariant validators (the dependency/import set, tenant-isolation, session-security, single-writer-ownership, single-source-crypto, foundation-antifabrication, dev-auth-bypass, committed-secret, fail-closed-internal-routes, currency/date lints). The exact DELETE-vs-RETARGET list is the P7 matrix; where a file is borderline, record the call in the ledger.
5. **Fix the deploy matrix + topology truth.** Retarget `production-deploy.yml` to the canonical runtime list; de-deploy `apps/app-marketplace` + `apps/developer-portal` (keep their code + the OAuth2/PKCE seam — they are FROZEN, not deleted); collapse the duplicate staging workflow to one. Regenerate `production-topology.json` so the 6 reserved services are marked `reserved`, not `production`; remove the k8s/Helm/Firebase fantasy infra from the active topology.
6. **Add the 5 new V1-conformance gates** the hardening plan names: migration rollback-pairing (≥138), deploy-manifest↔V1-topology contract, `letbuyy.store` literal ban, `commission_bps == 0`, topology-JSON anti-fabrication.

**Exit gate (Phase A):** `node scripts/validate-governance.mjs` runs the **retargeted** suite green; the live root `AGENTS.md` is AGENTS_V2; no validator references the rejected architecture; the deploy matrix == the canonical runtime list. **Record as SKIPPED-HUMAN:** the ARB ratification signature for the promotion, and the branch-protection/deploy-promotion change if it requires a privileged human (do the YAML/config; the human flips the switch).

---

## 5. PHASE B — HW-1: BUILD THE MISSING ENFORCEMENT  *(the platform-killer rules currently have NO machine behind them)*

Money/identity/tenancy/honesty rules are written but unenforced. Author the validators (these are static lints unless noted; they **can ship before the ARB ratification** and are the cheapest large risk cut). For each: name it, assert it, wire it into the gate, add a failing-then-passing test fixture. (Per `VALIDATOR_COVERAGE_MATRIX.md` VAL-G-* and `GOVERNANCE_HARDENING_PLAN.md` HARD-042…049.)

- **`commission-bps-zero-validator`** — fails if any default/config/code sets a non-zero transaction/GMV fee. (0%-fee wedge; Constitution ART-12.)
- **`canonical-ledger-only-validator`** — fails any money mutation that does not post to the canonical `ledger_transactions`/`ledger_entries` via the settlement writer; fails reads of a mutable balance column as truth.
- **`no-self-custody-rail-validator`** — fails the hardcoded `razorpayx` own-account payout rail; payout must be PA-split.
- **`stepup-crypto-validator`** — fails a refund/payout step-up that is a string/length check instead of a real cryptographic challenge.
- **`identity-sole-issuer-validator`** — fails token *signing* anywhere outside `apps/identity-platform`; fails use of a shared `AUTH_SECRET` for signing.
- **`no-blanket-service-role-validator`** — fails tenant queries issued under a `service_role`/BYPASSRLS client outside the narrow audited escape hatch.
- **`no-public-using-true-validator`** — fails any RLS policy that is `USING (true)`/`WITH CHECK (true)` granted to PUBLIC/anon.
- **`rls-force-coverage-validator`** — fails if a tenant table lacks `ENABLE`+`FORCE` RLS + a GUC policy.
- **`provider-mode-badge-validator`** — fails a money/fulfillment surface that lacks the honesty badge or where a mock path can read as `success`.
- **`one-system-per-domain-validator`** — fails a second canonical system for a domain that has a winner (the cardinal-sin lock; backs `WIN-R2` escalation).
- **`no-rejected-package-imports-validator`** — fails any import of `distributed-runtime`/`orchestration`/`projection-runtime`/`runtime-composition`/extension-host/app-engine.
- **`no-reserved-service-activation-validator`** — fails source/deploy added to a reserved service.
- **`no-new-react-sections-validator`** — fails adding a section to the React renderer once frozen (Liquid enforcement).
- **`token-source-single-validator` / `shell-single-validator`** — fail a second token system / a hand-rolled nav after `AppNavigation` adoption; fail hardcoded hex/px.
- **`meta-no-theater-validator`** — fails any gate validator that certifies a never-build capability (so "green" can only ever mean "conforms").

**Exit gate (Phase B):** every Constitution money rule (R-5…R-10), the identity sole-issuer rule, the tenancy rules, and the honesty-badge rule have a wired, failing-on-violation validator in the gate; the gate is green on the current (compliant-after-Phase-D) tree and red on injected violations (prove each with a fixture).

---

## 6. PHASE C — FORCE EVERY UNDECIDED DECISION  *(no middle state; resolve, record, continue)*

The governance left a handful of decisions in a "tentative / UNVERIFIED / ARB-decision" limbo. A conditional fate is no fate. Resolve each to **one** value using the governance's own stated default, record the ARB ratification as SKIPPED-HUMAN, and proceed.

- **Ops-console survivor (the big one — flagged in 4 reports).** Decision rule: **exactly one** internal ops console may exist. Per the governance's tentative call, **`apps/platform-console` is the survivor; `apps/platform-operations-portal` is folded into it then deleted** (`DELETE_AFTER_MIGRATION`, gated: the thin-ops-sliver capabilities — refund, maker-checker payout, dispute log, KYC queue — must live in the survivor and pass `V-SMOKE` before the non-survivor is removed). Also **fix the contradicted rationale**: the survivor is chosen on ops-task fit, not on "adopts AppNavigation" (both do). Add the `GATE-OPS-SURVIVOR` forcing record. Record the *final* ARB confirmation as SKIPPED-HUMAN — but implement the consolidation now against the default so nothing stalls.
- **The single-source-of-truth + consistency edits** (`HARD-020` + the DUP-G-*/CANON-G-*/AUTH-G-* fixes): make the Constitution own each fact **once** (the scale envelope, the 8-runtime list, the never-build list, the canonical-architecture sentence, the authority chain, the honesty-badge mode triad) and change the other documents to **cite** it rather than re-state it. Fix `services/identity-platform` → **`apps/identity-platform`** everywhere (only the app exists). Fix the Constitution header that says "RATIFIED" to "SUPREME BY DIRECTIVE; operative-ratification pending GATE-1" (now satisfied by Phase A). Resolve the honesty-badge triad to ONE value set (`mock|sandbox|live`) across the component, the validator, and the docs. These are doc edits inside `GOVERNANCE_REWRITE_2026_06_10/` — make them; they remove the ambiguity that lets a future agent drift.
- **The missing legacy rows** (`LEGV-G-007/008/011/012` etc.): add the absent dispositions to the legacy plan so **every** loser has a gated, reversible fate — the client React cart, the inventory direct-decrement side-doors, the scalar single-code discount RPC, the `AdminShell`/`Sidebar`/`HeaderBar` shell fork, the web token-source collapse. (These become real deletions in Phase D once their winners are live.)
- **The roadmap dependency fixes** (`ROAD-G-001/002`): provision the `checkout.` DNS record inside the checkout phase (P8) on the already-canonical `.com` zone so P8 does not depend on a later phase; bind the money-bridge deletions to P3's reconciliation harness (zero-drift) before any legacy money path is removed.

**Exit gate (Phase C):** zero `UNVERIFIED`/`tentative`/conditional fates remain in the governance for items code can resolve; every remaining UNVERIFIED is a genuine live-DB or vendor-key probe recorded in `SKIPPED_HUMAN_DECISIONS.md`; the consistency edits are applied; `GATE-OPS-SURVIVOR` is recorded with `platform-console` as survivor.

---

## 7. PHASE D — FOUNDATION EXECUTION (the build, in roadmap order)

Now that the law is in force (A), enforced (B), and unambiguous (C), build the platform to beta-ready. **Follow the Foundation Roadmap's dependency order exactly** (`LETBUYY_FOUNDATION_ROADMAP.md`). Your earlier mental order "Identity → Ledger → Tenant → Checkout → Liquid → Mobile → Marketplace → Production" is honored, with two corrections the ratified roadmap requires and the hardening review confirmed: (1) **deploy-unblock + the anon-leak security S0s come first** (nothing is safe or shippable otherwise); (2) **tenancy completes *with* identity** (the GUC reads a *validated* claim that only the identity issuer can mint). "Marketplace" stays **FROZEN** — you keep the seam, you do not build it. Each sub-phase below: build the canonical winner, delete its loser only after the winner is live + validated, carry the right tests, pair every migration, keep the gate green.

### D1 · P1 — DEPLOYMENT UNBLOCK  *(meta-blocker; ISSUE-002, ISSUE-001)*
- Fast-forward the integration branch into `main` (execute `MERGE_RUNBOOK.md`); fix `production-deploy.yml` so it actually deploys the canonical runtimes from `main`; collapse the two racing staging workflows to one; add the branch-lag CI guard.
- **Commit + wire the `/api/auth/switch` account-takeover fix** (it exists only as an uncommitted working-tree edit today): the handler MUST validate the caller's session AND `lb_accounts` membership before minting a session for a target; add the regression test (anonymous/cross-account switch returns 401).
- **SKIPPED-HUMAN:** the privileged branch-protection / deploy-promotion toggle and any GitHub/Cloudflare/Vercel secret provisioning — do the config, record the toggle.
- **Exit:** `main` is current; pipeline deploys the canonical matrix; switch-takeover test green.

### D2 · P2(emergency) — CLOSE THE LIVE DATA LEAKS  *(the 6 S0 anon leaks + privilege table; ISSUE-003…008)*
- Migration `162`: **drop every `USING (true)` PUBLIC policy** on `products`, `product_variants`, `product_options`, `orders`, `sites`, `store_customers`/activity/wishlists, `subscriptions`, `billing_history`; replace with `TO service_role` + a real tenant policy. **Lock `super_admin_allowlist`** (no anon INSERT). Add `REVOKE` where the schema over-grants. Pair the rollback.
- Add the **cross-tenant red-team suite** (RT-1…RT-9) asserting anon/forged-site_id denial; it must fail before the migration and pass after.
- **SKIPPED-HUMAN:** the live anon-`GRANT` probe (`\dp public.orders` / anon-key) — the migration is safe regardless; record the probe as the human verification.
- **Exit:** no PUBLIC `USING(true)` policy exists; red-team suite green; `no-public-using-true-validator` green.

### D3 · P4 — IDENTITY: ONE ISSUER, ASYMMETRIC TOKENS  *(A1; ISSUE-027 + the auth-collapse set)*
- Make `apps/identity-platform` the **sole** issuer for all three realms. Migrate token signing from shared-`AUTH_SECRET` HS256 to **asymmetric** (EdDSA/Ed25519; ES256 fallback); all other services become **verify-only** with the public key; pin the algorithm. Use the **dual-verify cutover** (accept old+new, drain, then drop old + alg-pin); rollback = re-widen the verifier, never revert the issuer.
- Collapse the four parallel auth implementations into the issuer: gateway `routes/auth.ts` minting → verify-only; retire the `identity-foundation` shadow stack and the legacy Supabase `/auth/*` surface (mark LEGACY → delete in D-legacy once the issuer serves). Build the **claims→GUC bridge** (a validated claim → the tenant GUC) — this is the input D4 needs.
- Build the **OIDC provider** and **WebAuthn passkeys** to the seam but leave them **deferred/flag-off** (canonical-but-deferred); do not block on them.
- Cap the `lb_accounts` cookie lifetime; cookie flags HttpOnly/Secure/SameSite; host-scoped buyer cookies.
- Tests: auth forgery/replay/escalation/enumeration/alg-pinning; the dual-verify contract across services.
- **SKIPPED-HUMAN:** live OIDC client registrations, passkey RP production config, Turnstile prod secrets.
- **Exit:** one issuer; forging with the public key fails; zero HS256 verifications after drain; `identity-sole-issuer-validator` green.

### D4 · P2(completion) — TENANCY LOAD-BEARING  *(A2; ISSUE-009 + FORCE-all-tables)*
- Stop the gateway connecting as blanket `service_role` for tenant data: introduce the `app_tenant` non-BYPASSRLS role + a `withTenantTx()` helper that does `SET LOCAL app.site_id` from the **validated** identity claim (D3). Stage it: shadow/audit → enforce reads → enforce writes → narrow the `service_role` escape hatch to explicit audited cross-tenant jobs.
- Add `ENABLE`+`FORCE` RLS + the GUC policy to **every** tenant table (today ~41/261). Normalize `store_id`↔`site_id` toward `site_id` (TD-7); fix worker tenancy (queue-workers must not derive scope from a forgeable payload).
- Tests: the RT-1…RT-9 red-team now runs under `app_tenant` (real denial, not bypass); RLS/GUC overhead perf check.
- **SKIPPED-HUMAN:** the live `pg_policies` FORCE-coverage probe.
- **Exit:** gateway off blanket service_role; FORCE+GUC on all 261 tenant tables; `no-blanket-service-role-validator` + `rls-force-coverage-validator` green.

### D5 · P3 — MONEY: ONE LEDGER, NEVER CUSTODY, 0%  *(A3; ISSUE-010/011/012/014/015/018/019/020)*
- Make the canonical double-entry ledger (139–161) the **only** money truth. Wire the legacy/webhook **capture**, the returns **refund**, and **COD** remittance to post balanced entries to the canonical ledger (today they post none). Credit `pa_clearing` on capture so reconciliation is possible.
- Close **reconciliation** to zero-break-or-explained-suspense (`recon_breaks`); the reconciliation harness must be green before any payout is trusted.
- Replace the hardcoded `razorpayx` self-custody rail with the **PA-split mirror** (Razorpay Route / Cashfree adapter, mock default); payout gated on the derived ledger balance + KYC. Replace the forgeable string step-up with a **real cryptographic** challenge. Fix `post_settlement_ledger_transaction` deriving the tenant GUC from its own parameter (derive from ownership).
- Set **`commission_bps = 0`** (kill the 3% rake + GST-on-fee). Migrate all money columns to **bigint paise** (expand→backfill→verify→contract, zero-loss proof); backfill legacy balances onto the canonical ledger (per-site `variance_minor = 0` before any compat table is retired). Append-only enforced by trigger **and** `REVOKE UPDATE,DELETE`.
- Tests (highest rigor): property-based Σdebit=Σcredit; concurrency (double-capture/payout/refund); reconciliation harness; reversing-entry coverage; the bigint cutover zero-loss proof.
- **SKIPPED-HUMAN:** live Razorpay/Route/Cashfree keys, live KYC keys — adapters complete, mock default, honesty-badged.
- **Exit:** every rupee is captured→ledgered→reconciled; payout is PA-split + gated; commission is 0; `canonical-ledger-only` + `commission-bps-zero` + `no-self-custody-rail` + `stepup-crypto` validators green.

### D6 · P8 — CHECKOUT: SERVER-AUTHORITATIVE + HOSTED ORIGIN  *(A4; ISSUE-030 + cart/inventory set)*
- Stand up the hosted **`checkout.letbuyy.com`** origin served from the storefront read-path; **provision the `checkout.` DNS record on the already-canonical `.com` zone inside THIS phase** (so P8 doesn't depend on the later domain migration). The signed `checkout_url` handoff MUST be **bound to cart contents** + expiry (not just cart id) — re-derive price/discount/inventory server-side at confirm.
- Finish the server-authoritative cart as the single authority; demote the client React cart to a thin view. Unify inventory onto the one reserve→commit lifecycle (`version` optimistic concurrency); **schedule the stale-reservation sweeper** (exists as DDL, never scheduled); close the order-edit add-item and direct-decrement side-doors. Activate the typed 3-class `combines_with` discount engine; demote the scalar RPC. Wire GST place-of-supply + immutable invoice.
- Tests: checkout forgery (mutated cart rejected), oversell concurrency (exactly one winner on the last unit), order idempotency, coupon concurrency, E2E signed-handoff→origin→confirm.
- **SKIPPED-HUMAN:** the production `checkout.` DNS edit (do the Terraform/config; human applies) and Shiprocket live keys (carrier adapter mock).
- **Exit:** orders only via `create_checkout_order`; hosted origin serves; mutated-cart handoff rejected; sweeper scheduled; oversell closed.

### D7 · P6 — THEME: LIQUID TO PARITY, REACT FROZEN  *(A5; THEME set)*
- Unify the theme **schema/draft/compose** to one source. Replace the brittle regex output-sanitizer with **DOMPurify** (and Liquid auto-escape). Build the Liquid/portable-theme renderer to **parity** with the React registry (port the ~20 live sections; un-orphan the engine renderer classes). **Freeze the React renderer**: `no-new-react-sections-validator` blocks new React sections; do not delete React — its delete-or-keep is a **data-driven** decision at the hardening wave, never "for completeness".
- The Liquid default-flip is **per-theme + canary**, gated on: tenancy live (D4), schema/draft/compose unified, sanitizer replaced, sections ported, and the **render-parity + sandbox-escape/SSTI/XSS + perf** suites green.
- Keep both editors (web + Flutter) — the differentiator, protected.
- **SKIPPED-HUMAN:** none structural; the platform-wide flip past canary is a data/ARB call — implement the canary, record the wide-flip decision.
- **Exit:** Liquid at parity behind the per-theme canary; React frozen; theme security suite green.

### D8 · P9 — MERCHANT OS + MOBILE  *(A7; mobile + bff set)*
- Make `services/mobile-bff` a **real composite/fan-in BFF** (it is a pass-through stub today; the dashboard N+1 it should kill is live). Ship the **provider-mode honesty badge** (`ProviderModeBadge`, value set `mock|sandbox|live`) on **every** money/fulfillment surface, web + Flutter, bound to the real backend `provider_mode`.
- Flutter `apps/mobile/merchant-app`: fix **release signing** (it ships with the debug keystore) + a real signed release CI lane; add a double-submit/idempotency guard on money screens; **delete the parity catalog** `merchant_feature_screen.dart` + `merchant_feature_definitions.dart` (TD-5) and its orphan read-only stubs. Keep `apps/mobile/shopper-app` + `operator-app` reserved-empty.
- **SKIPPED-HUMAN:** the production signing keystore/secret + Play/App Store credentials — build the lane, record the secret.
- **Exit:** dashboard is one composite round-trip; honesty badge everywhere; signed release lane; parity catalog gone.

### D9 · P7 — UI/UX UNIFICATION  *(A8; UX set)*
- Collapse to ONE token source (`packages/typescript/ui/src/tokens.ts` → DTCG `tokens.json` → a **generated** Dart bridge that `ThemeData` consumes); delete the bypassed bridge + the 4 competing mobile color classes. Roll the ONE shell `AppNavigation` to **9/9** apps (start with merchant-control-plane); add a first-class **Money** nav node (operator-first IA). Make dark mode **reachable** (a toggle) in the 7 apps that only support system. Hit **WCAG 2.1 AA** (contrast/focus/keyboard/touch-targets/labels). Install **stylelint** + wire `lint:css` to CI; the design-system **ratchet must BLOCK** new drift (not baseline it) and repay old drift on a clock.
- Tests: token snapshot, shell-adoption, web↔Dart token-bridge parity, visual-regression per app, a11y, dark-mode, deletion-validation before removing any shell/token source.
- **Exit:** one token source + one shell 9/9; dark reachable; AA floor; `token-source-single` + `shell-single` + `provider-mode-badge` validators green; ratchet blocks drift.

### D10 · P10 — WHATSAPP (SCOPED)  *(A; WhatsApp set)*
- Build the `channel=whatsapp` module: order-lifecycle utility messages on `order.paid|shipped|delivered` via the outbox, COD-confirm (reply-to-confirm, fail-closed: no-confirm ⇒ auto-cancel/hold), and the DPDP **consent ledger** governing all sends (withdrawn consent blocks send). BSP/Meta adapter mock default. Broadcasts/inbox/catalog/in-thread checkout stay **deferred** — do not build.
- **SKIPPED-HUMAN:** WhatsApp BSP/Meta WABA + HSM template approval — adapter complete, mock send.
- **Exit:** order-lifecycle + COD-confirm + consent fail-closed; mock send honestly badged.

### D11 · P5 — PLATFORM SIMPLIFICATION + LEGACY ELIMINATION  *(execute deletions now that winners are live)*
Now the winners are live, execute `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md` in its gated order. **Nothing is deleted until its deletion-validation is green (zero-importer + build + test + governance + winner-live), behind a rollback.**
- **SAFE_DELETE (zero-importer, no winner needed):** the ~13.3k-LOC CQRS/saga/extension package cluster (`distributed-runtime`, `orchestration`, `projection-runtime`, `runtime-composition`, `app-engine`, `extension-host`, `application-services`) — delete **atomically with their ~70 theater validators** (the validator-liveness loop); `legacy/firebase` → ARCHIVE to `docs/archive/`; the parity catalog; the duplicate `provider_payment_id` index; the ~37 product-dead tables (after the `pg_stat` writer probe — SKIPPED-HUMAN if unverifiable).
- **DELETE_AFTER_MIGRATION (winner now live):** legacy auth paths (D3), un-ledgered money paths + compat ledger tables + mutable balances + `razorpayx` rail (D5), the client React cart + inventory side-doors + scalar discount RPC (D6), the `AdminShell`/`Sidebar`/`HeaderBar` fork + per-app token redefs (D9), `runtime-composition` (unwire from storefront first), the non-survivor ops console (C, gated on the sliver landing in `platform-console`), `sessions_v2`, `users`/`users_custom` + `store_id`/`site_id` duplication.
- Finish the domain migration: replace every `letbuyy.store` literal with `letbuyy.com`; the `letbuyy.store`-ban validator green. Archive the 60+ root governance docs + the ~120 `docs/governance/` theater files + the maximalist `LETBUYY_CHECKOUT_PLATFORM_ARCHITECTURE.md` to `docs/archive/`.
- **Exit:** the dead packages + theater validators are gone; every loser is deleted-or-archived behind a green gate; `no-rejected-package-imports` + `letbuyy.store`-ban green; root + governance doc sprawl collapsed.

### D12 · P11 — PRODUCTION READINESS  *(beta gate)*
- Backups + a **tested restore drill** (PITR); structured logging + PII/PAN redaction; the append-only **audit relay** (atomic); **alerting** on security/abuse + money-correctness (pa_clearing drift, reconciliation variance, stranded payouts, stale-reservation bloat); basic tracing/latency metrics. Load + security + lightweight chaos tests. DPDP DSR export/erasure path.
- **Exit (THE BETA GATE):** restore drill executed; monitoring/alerting live; **0 open S0/S1**; the beta-readiness checklist signed. Record the live-infra provisioning (backup bucket, alert routing) as SKIPPED-HUMAN where it needs a privileged human.

### D13 · P12 — FIRST 100 MERCHANTS  *(launch readiness; Marketplace stays FROZEN)*
- Final launch checklist on `letbuyy.com`: onboarding, KYC gate (mock until live keys), payments-connect (mock until live keys), the operator-first OS, WhatsApp order updates. The demand-gated Shopify-class layer (Liquid platform-wide flip, OIDC, passkeys, theme **marketplace seeding**, reseller links) is **deferred** — seam kept, **not built** (reopen at ≈5k merchants + developer demand).
- **Exit:** the platform is beta-launch-ready against mocks; every live-vendor seam is recorded in `SKIPPED_HUMAN_DECISIONS.md` with the exact step to go live.

---

## 8. WHOLE-REPO END STATE (your definition of done for the entire run)

When you stop, ALL of the following are true (this is the acceptance test for "the codebase obeys the architecture"):
1. **The law is live:** root `AGENTS.md` IS AGENTS_V2; no governance doc is scan-generated; the Constitution owns each fact once and the others cite it; zero `services/identity-platform` references; the ops-console survivor is resolved (`platform-console`).
2. **The gate means conformance:** `node scripts/validate-governance.mjs` is green on the **retargeted** suite; the ~70+ theater validators are gone; the ~25 new canonical validators (money/identity/tenancy/honesty/topology/theme/UI) are wired and provably fail on injected violations; no validator references the rejected architecture.
3. **Topology is canonical:** only the canonical runtimes deploy from `main`; reserved services are empty + marked `reserved`; no rejected package is imported; `app-marketplace`/`developer-portal` are FROZEN (de-deployed, code+OAuth seam kept).
4. **Money is correct:** one ledger SSOT; capture/refund/COD all ledgered; reconciliation closes to zero/suspense; PA-split (no custody); commission 0; bigint paise; append-only enforced; every money surface honesty-badged; live keys SKIPPED + recorded.
5. **Identity + tenancy are load-bearing:** one asymmetric issuer; gateway off blanket service_role; FORCE+GUC on all 261 tenant tables; the 6 anon leaks + `/api/auth/switch` closed; red-team suite green.
6. **Commerce is server-authoritative:** server cart; hosted `checkout.letbuyy.com`; cart-bound handoff; reserve→commit + scheduled sweeper; orders only via the RPC; GST invoice.
7. **Theme:** Liquid at parity behind a per-theme canary; React frozen (not deleted); DOMPurify sanitizer; theme security suite green.
8. **UI/mobile:** one token source + one shell 9/9; dark reachable; AA; honesty badge everywhere; mobile-bff composites; signed release lane; parity catalog deleted.
9. **Legacy eliminated:** dead packages + theater validators + `legacy/firebase` + parity catalog + duplicate schemas gone or archived behind green gates; `letbuyy.com` canonical; doc sprawl collapsed to `docs/archive/`.
10. **Honesty + auditability:** `EXECUTION_LEDGER.md` records every action; `SKIPPED_HUMAN_DECISIONS.md` records every human seam with the exact finishing step; no mock anywhere reads as `success`; every migration is paired; every phase exit-gate is green.

## 9. HOW TO BEGIN (right now, single pass)
Read the seven governance docs + the hardening plan. Open `EXECUTION_LEDGER.md` and `SKIPPED_HUMAN_DECISIONS.md`. Then execute **Phase A in one atomic change-set** (it is self-blocking — promotion + validator-retarget + theater-deletion must land together or CI rejects it). Then B, then C, then D1→D13 in order. Do not pause for confirmation, do not ask which to do first, do not stop at a human seam — implement to the seam, mock, badge, record, continue. The architecture is decided; make the repository obey it.

*End of CODEX_MASTER_IMPLEMENTATION_PROMPT — every instruction here is subordinate to `LETBUYY_CONSTITUTION.md`; on any conflict, the Constitution wins.*
