# Decisions to protect — constitutional, owner-made, founder-open, and superseded

Read before writing any phase contract. Classification tags are binding. Where a document in the
repository contradicts a newer verified decision here, keep the newer decision and record the
supersession — never silently reopen a closed question. **Authority order:** Constitution → root
`AGENTS.md` → local `AGENTS.md` → `LETBUYY_CANONICAL_SYSTEMS.md` → `CLAUDE.md` → this file → memory.
`CURRENT` facts below were measured 2026-09-04 at `develop` = `823aa5ee`; re-measure before quoting.

## 1. Owner decisions of 2026-09-04 (GOV-3) — OWNER_DECISION unless marked

| ID | Decision | Status |
|---|---|---|
| **D-ID** | Commit identity (name/email) and `Co-Authored-By` trailer policy | **OPEN_OWNER_DECISION** — "I am going to create a new account and do it, so leave this and mark it as pending." Until then: repo-local config (`SaaiSiddhu <saaisiddu@gmail.com>`), no hand-edited trailers, verify after the first commit. History spread today: 776 SaaiSiddhu · 700 SiddhuSaai · 282 trailers across refs. |
| **D-HOME** | The skill lives at `.claude/skills/letbuyy/`, tracked | Decided. `.gitignore` narrowed to `.claude/*` + `!.claude/skills/letbuyy/`; `whole-repo-end-state-validator` asserts that exact shape; personal `~/.claude/skills/letbuyy` is a symlink to the develop-worktree copy. |
| **D-BRANCH** | `develop → staging → main`, fast-forward only; all three levelled to `823aa5ee` | Decided and executed locally (`docs/active/BRANCH_DISPOSITIONS.md` § Promotions). `stepup/main` = preserved alias. The owner pushes. |
| **D-DEPLOY** | `production-deploy.yml` and `deploy-staging.yml` become `workflow_dispatch`-only until DEPLOY-1 retargets them; `staging-runtime-deployment.yml` keeps its plan-only push; `ci.yml` gains `staging` | Decided and executed. Validators amended to encode the invariant, not the temporal state. |
| **D-UIUX** | uiux lane scope = canonical apps only (`customer_web`, `merchant_web`, `admin_web`, `identity-platform`, `merchant_app` via the token bridge); donor apps, `phase_2/*`, `marketing-site` and FROZEN apps are HOLD. **Canonical first:** if no proper canonical system exists for a surface, make it canonical (references + gates) before rolling it out across the codebase. | Decided. `references/uiux.md` + `references/uiux/*.md` are the canonical set; `uiux/CANONICALIZATION_PROGRAMME.md` is the rollout plan (phases, not this GOV-3 phase). |
| D-AGRIMORE-STANDALONE | Is the standalone `Projects/Clients/Agrimore*` in scope? | Default **NO** (different programme, `agrimore-cto-handoff`). Not asked; assumption stated. |

## 2. Founder decisions D-0…D-7 — OPEN_FOUNDER_DECISION (never resolve silently)

State each as **open**, **provisionally recommended**, or **owner-approved with evidence**. Isolate
decision-dependent work, let unrelated work proceed, recommend a safe default, never decide money,
legal, custody, commission or merchant-of-record policy. Full option analysis:
`docs/migration/repository_consolidation/11_backend_consolidation.md` (every row `D0_DEPENDENT`) and
the retired handoff skill's `unified-product-architecture.md` (kept beside the personal stub).

| ID | Question | Status · safe default while open |
|---|---|---|
| **D-0** | Canonical backend: (A) canonical commerce OS extended with a marketplace channel — audit-recommended, gated on a verification spike · (B) new build on the Agrimore schema · (C) extend Firebase — rejected on client-authoritative money | **OPEN — gates architecture.** Say so in every architecture verdict. Default: build nothing that assumes A or B; `services/compatibility/*` stays inert; no data migration script targets a schema. |
| **D-1** | 0% transaction fee (Constitution, `commission-bps-zero-validator`) vs the ≤10% + platform fee the live marketplace charges today | **OPEN — a real contradiction.** Default: the repository stays at 0%; a change is Constitution-amendment territory; no ledger posting work that assumes a fee. |
| **D-2** | Is LetBuyy merchant-of-record? | **OPEN** (today split by plan as an emergent property). Needs counsel. Default: no GST-invoicing or refund-liability design that assumes an answer. |
| **D-3** | Multi-merchant cart at Phase 1 launch | **OPEN.** Recommended default: build the parent purchase + child order model, launch single-merchant-per-checkout behind a flag. The model exists in **none** of the three lineages. |
| **D-4** | Admin survivor (`admin_web` vs `admin_app` vs the retired `admin-web`) | **OPEN**, contingent on D-0. `platform-operations-portal` → `admin_web` is constitutionally pre-decided (ART-24) but its smoke gate is uncleared. |
| **D-5** | Campaign credits prepaid vs postpaid | **OPEN.** Default: prepaid only at launch. |
| **D-6** | Subscription plan → channel entitlement mapping | **OPEN.** Default: grandfather existing subscribers into storefront, price marketplace separately, offer a bundle. |
| **D-7** | KYC provider and operating model (only OCR exists; extraction ≠ verification) | **OPEN.** Default: licensed KYC/AML vendor before onboarding at scale; documents private with signed reads. |

Lower-blast-radius open items: marketplace web in Phase 1 · which loyalty/deals/reels/AI-chat features
survive · search provider · storefront theme survivor · domain strategy · retention periods ·
quick-commerce launch city and dark-store model · the `00b_topology_amendment_draft.md` Signature
Block (all 7 items unsigned; the six-app rename was applied under the brief's apply-anyway instruction).

## 3. Constitutional rules that bind every phase — CONSTITUTIONAL_DECISION

- **Money.** One append-only double-entry ledger; balance derived, never a mutable column; money
  mutations only through the canonical `SECURITY DEFINER` RPCs via `db.rpc`; `idempotency_key` +
  advisory lock before the existence check; `bigint` minor units; **never custody** (self-custody
  payout rails are dead); **`commission_bps = 0` permanent**; step-up is real cryptography; reconcile
  to zero-break-or-explained-suspense; server-authoritative amounts; provider signatures verified
  over the raw body with constant-time comparison; a client payment id is never proof of payment.
- **Tenancy.** `sites`/`site_id` is the tenant root ("store" is a UI/URL term); RLS `ENABLE` +
  `FORCE` with a policy on the transaction-local GUC `app.site_id`; unset GUC ⇒ zero rows and no
  mutation; the GUC is set only from a validated claim (`withTenantTx`, `SET LOCAL ROLE app_tenant`);
  `verifySiteOwnership` is defence in depth; no `service_role` for tenant data; no `USING (true)` to
  PUBLIC/anon/authenticated; the generated tenant registry is regenerated by the phase that changes it.
- **Identity.** `apps/identity-platform` is the sole asymmetric issuer (ES256/EdDSA; private JWK
  only there); every other runtime verifies against `LETBUYY_IDENTITY_PUBLIC_JWKS`; realms strictly
  separated; no shared symmetric secret across trust domains (the customer-realm HS256 session is a
  known deviation to collapse, never to extend); Turnstile + rate limiting on registration/login,
  fail-closed; consent ledger append-only and fail-closed.
- **Topology.** Exactly eight active runtimes; six reserved service roots and the reserved mobile
  roots stay manifest-only and empty; FROZEN apps are never deploy targets; deprecated aliases never
  return; apps never import apps, services never import apps, packages never import apps or services;
  `services/lcis-api` and `packages/lcis-*` are dev-time tooling (`toolingRoots`); `apps/phase_2/*`
  and `services/compatibility/*` hold real source but authorise no backend; the auxiliary tier is a
  directory grouping, not an authority tier.
- **Never build** (without a named trigger and ARB approval): a microservice fleet · CQRS/event
  sourcing/saga/replay/projection · multi-region · sharding/partitioning now · service mesh · a
  self-custody payout engine · a cross-merchant wallet/vault · a third-party app marketplace with
  checkout extensions/Wasm · a headless commerce tier · fraud ML · full in-WhatsApp commerce · any
  GMV or transaction fee · filling a reserved service. Rejected packages never imported:
  `app-engine`, `application-services`, `extension-host`, `projection-runtime`, `orchestration`,
  `distributed-runtime`, `runtime-composition`.
- **Envelope.** 100 → 1,000 → 10,000 India merchants, ≈30,000 orders/month. "10M concurrent" is an
  evolvability requirement, never infrastructure without a defined workload. Scaling stages 1–7 in
  order; never skip ahead.
- **Deletion.** Nothing load-bearing is deleted without a green deletion-validation gate;
  `SAFE_DELETE` vs `DELETE_AFTER_MIGRATION`; retarget the asserting validator first, then delete;
  paired rollback; never blind-drop a table (RPC/ops-script writers are invisible in code).
- **Honesty.** Mock/sandbox providers never read as `success`; `ProviderModeBadge` on every money and
  fulfilment surface; human seams marked `[HUMAN-REQUIRED]` and never marked done without a real
  implementation plus validation; governance documents are hand-authored law, never generated from a
  scan; a green gate over a known S0 is governance theatre.
- **Theme.** Liquid/OS-2.0-shaped portable themes canonical; React frozen at 20 sections by
  validator; sanitizer locked; Liquid default OFF in production, flip per theme, canary'd, ARB-gated.
- **Design system** (DOC 06): one token source `tokens.ts`; `--lb-*` only; one shell
  (`AppNavigation`); one theme controller; nine states; WCAG 2.1 AA floor; ratchet blocks new drift
  and repays old drift; never `--update` to silence a regression.

## 4. Target product shape — TARGET_IMPLEMENTATION (never report as CURRENT)

Phase 1: five surfaces — LetBuyy customer app (the shipped UI on the canonical API), LetBuyy
Business (one merchant app, entitlement-driven), one admin (D-4), the storefront runtime, one
marketing site. Unified customer principal keyed by mobile number + OTP (global, not site-scoped);
`merchant_principal → org_membership → organization → {legal_entity, site → location,
channel_entitlement, subscription}`; one product source with `channel_listing` rows; one inventory
truth with reservations; quote → intent → confirm checkout; parent purchase + child orders; one
ledger. Phase 2: quick commerce (Instant mode, Store Ops, Rider) on the same backend with Agrimore
as the UX/schema donor. Target infrastructure: Supabase Postgres, identity-platform or Supabase Auth
with a server-side SMS adapter, Cloudflare Workers/R2/Queues, Turnstile. **Nothing in this section
is evidence that code exists.**

## 5. Superseded assumptions — SUPERSEDED_DECISION (must not return)

- Three LetBuyy repositories on disk (`Projects/Ecommerce/LetBuyy` + nested `Agrimore` + this one)
  — superseded 2026-09-02 (Phase M); one repository, three lineages; bundles under
  `~/LetBuyy-history-preservation-2026-08-29/`.
- `stepup/main` as the integration/staging branch and `main` fast-forwarded from it
  (MERGE_RUNBOOK, DEPLOY-R1 literal, BRANCH_STRATEGY) — superseded by D-BRANCH.
- `develop` as a retired name that must stay stale — superseded; it is the integration branch.
- The CTO/Worker two-session split and "generated Worker prompts in chat only" as the operating
  model — superseded by this single-session skill (prompts still never enter the tree).
- Agrimore as a complete quick-commerce backend — 47 of 57 declared routes unimplemented, mocked
  Razorpay; a design donor only.
- The live Razorpay/Gemini secret exposure as an open rotation item — the owner **deleted** all four
  values at the providers on 2026-09-02; dead values remain in history and in contained files.
- The `105 PASS / 6 FAIL` gate baseline — superseded by `106 / 6` at Phase S, and re-measured by
  GOV-3 (the branch-lag guard and one new validator change the count).
- DOC 06's dated counts (`tokens.ts` 1,388 lines, badge absent, bridge colours-only) — the rules
  bind; the numbers aged (`uiux/EVIDENCE_LEDGER.md`).
- `Projects/Ecommerce/...` and `/Users/saai_sidd/Git/Letbuyy_Store` paths in any document.
- "CI is blocked" / "Actions is billing-blocked" — never established; the account cannot read it.

## 6. Open owner decisions raised by GOV-3 (do not resolve silently)

| ID | Question | Safe default while open |
|---|---|---|
| D-ID | identity + trailer policy | repo-local config, no hand-edited trailers |
| D-CI-ACCOUNT | which GitHub account reads `SaaiSiddhu/Letbuyy_Store`; is the remote renamed? | CI stays `UNKNOWN_LIVE_STATE`; no claim either way |
| D-PRESERVED | the four `PRESERVED_REFERENCE` branches (`claude/infallible-mendeleev-7db258`, `claude/integration-reconciliation-2026-08-15`, `claude/intelligent-euclid-61b310`, `claude/production-governance-gate-ci-fix-2026-08-15`) — merge, archive-tag or keep? | keep; never merge |
| D-WORKTREES | the 6 legacy `.claude/worktrees/*` + 11 orphan `agent-*` dirs (9.1 GB) | never remove without the owner |
| D-MIGRATIONS-208 | migrations 208–210 are untracked in the primary checkout (another session's stale-FK cleanup) and red the gate for everyone | the migration owner commits them with rollbacks; GOV-3 does not touch them |
| D-DEPLOY-1 | when the deploy lanes are retargeted to `staging`/`main` with verified cloud targets and secrets | dispatch-only until then |
| D-UX-DONORS | when `customer_app`/`admin_app` leave HOLD (after D-0/D-4) | HOLD; a11y/safety regressions reviewed, never re-skinned |
| D-AGENTS-DEPLOY-R1 | `AGENTS.md` DEPLOY-R1/TEST-R8 now read `staging`; the surrounding prose still describes the 30-commit lag history — rewrite the rule text? | literal retarget only (GOV-3); prose is historical |
| D-CODEOWNERS | `.github/CODEOWNERS` names four retired app paths | CI-1 |
