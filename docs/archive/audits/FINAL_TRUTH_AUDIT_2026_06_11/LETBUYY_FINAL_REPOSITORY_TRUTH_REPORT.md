# LETBUYY FINAL REPOSITORY TRUTH REPORT

**Date:** 2026-06-11 · **HEAD audited:** `3da1416c` (`main` == `stepup/main`, clean tree) · **Remote:** `origin/main` == `origin/develop` == `c2547049` (2026-06-09, 127 commits behind)
**Method:** 10 parallel forensic agents (architecture, governance, payments, identity, themes, validators, docs/prompt-drift, dead-runtime, infra/deploy/mobile, archaeology) + independent cross-verification of every headline claim. Evidence = file:line, executed commands, executed validators, executed tests, and 6 mutation probes (all reverted, tree verified clean).
**Location note:** this report lives in a dated directory, not at repo root, because `scripts/validators/whole-repo-end-state-validator.mjs:16-38` allowlists exactly 9 root markdown files — a root-level report would fail the repository's own governance gate.

---

## THE ANSWER

**LetBuyy is now ONE honest repository reality — and TWO product realities.**

The convergence cleanup genuinely executed (127 linear commits, verified ledger discipline, 92-validator gate green, zero stranded wave-branch work). Inside the committed tree there is one architecture, one governance chain, one merchant identity issuer, one backend. That is a real, verified transformation from the June 9–10 state.

But three splits survive, in descending severity:

1. **Temporal split (worst):** `origin/main` — the only reality the remote, CI, and production have ever seen — is 127 commits behind and still ships the account-takeover `/api/auth/switch` (verified: 0 ownership checks), the 3% commission rake (verified: `commission_bps: 300` at origin `commission.ts:202`), no migrations 160–167 (no RLS leak fix, no tenant GUC, no ledger authority), and `letbuyy.store`-bound worker routes. Every safety gate built in the last two days protects only the unpushed copy.
2. **Money split:** the canonical ledger is real and append-only, but it governs only the settlement side. The entire shopper capture surface (6 call sites including all provider webhooks) and a refund path post **zero** ledger entries, while checkout stamps a false `capture_posted_to_ledger: true` into data. Five money stores coexist.
3. **Theme split:** the ratified winner (Liquid) renders 0% of storefront traffic; the frozen loser (React) renders 100%, and the governance gate itself mandates Liquid stay OFF.

---

## 1. EXECUTIVE SUMMARY

The repository went through Architecture Freeze → V1 → Strategic Winner Selection → Governance Rewrite/Hardening → Truth Audit → Convergence Audit → Cleanup. This audit set out to determine whether the result is one reality. Findings, evidence-first:

**What is genuinely converged (verified, not claimed):**

- **Cleanup execution is real.** 127 linear commits (18 wave + freeze `72e80c2b` committing 1,250 files + 108 granular cleanup commits, 108/108 touching `EXECUTION_LEDGER.md`). All 9 sampled ledger claims verify against git history and code substance. The ledger's alarming "not committed" column is a stale pre-freeze artifact (true when written, frozen verbatim by design), not fabrication.
- **Architecture is single.** Deprecated app aliases gone as dirs and imports. All 8 reserved roots are exactly 2 files (AGENTS.md + manifest). All 7 rejected CQRS-era packages deleted from disk with zero importers. No domain has two live implementations. BFF layers proven to be credential-less proxies (storefront-runtime: zero supabase references; merchant-control-plane: 62 route files, zero service-role usage).
- **Governance is one chain.** Root `AGENTS.md` is the hand-authored AGENTS_V2 (no scan-drift residue); the regeneration generator is a tombstone that exits 1; GATE-1 is inverted — validators now *pin* the law instead of pinning the drift (mutation-proven: corrupting AGENTS.md fails two validators).
- **Merchant identity has one issuer.** Only `apps/identity-platform` contains `new SignJWT` (non-test). Gateway verification is ES256/EdDSA alg-pinned and rejects a genuinely-minted HS256 token — proven by executing the D3 test (5/5 pass). The `/api/auth/switch` takeover fix is committed (session + proven-device + rate-limit; test 4/4).
- **Validators have teeth.** 9/9 mutation probes behaved correctly (injected ledger violation, 300-bps default, new React section, rejected-package import, reserved-service activation, AGENTS.md corruption — all caught; clean tree passes).
- **Docs are quarantined.** 1,191 markdown files: 9 root (allowlist-enforced), 777 archived, 52 historical-audit, one prompt-perimeter validator enforcing a prompt registry.

**What is not converged (verified):**

- **Production runs the condemned code.** `origin/main` diff to local: 2,042 files, +76,344/−253,383. Old workflow has no branch-lag guard, deploys to `.store`, and `workflow_dispatch` is enabled with no branch protection found in-repo — anyone with write access can redeploy the vulnerable build today.
- **The promotion path is booby-trapped.** The branch-lag guard fetches `refs/heads/stepup/main` from origin — a branch that does not exist remotely — so following `MERGE_RUNBOOK.md` (which says push `main` only) fail-closed-blocks the first guarded production deploy.
- **The deploy pipeline never runs the governance gate.** `production-deploy.yml` contains zero references to `validate-governance` (verified) — only branch-lag-guard + migration-safety. And a probe untracked migration containing `DROP TABLE payouts;` was invisible to every validator while `supabase db push --include-all` would apply it to production. The exact "gate blind to untracked migrations" defect from the prior audit survives, now with a live path to the production DB.
- **Money is multiple realities.** `confirm_order_payment_with_ledger` (`000_baseline.sql:1590`) contains zero ledger references (verified) and is reached from 6 capture call sites including all webhooks. `complete_order_refund` likewise. The canonical-ledger validator cannot see this: it never scans `database/`, accepts a ledger token *in a comment* as evidence (mutation-proven loophole), and exempts the 9 files that mutate the app-store payout ledger. Gift cards and AI credits are mutable stored value outside everything.
- **Themes are strategic fiction.** Liquid default OFF (`theme-governance.ts:14`), no write path for the canary key anywhere in the codebase, bundles exist only as test fixtures, `lb-*` classes have no CSS, the rendered `layoutHtml` is discarded at the call site, and `theme-governance-validator.mjs:60-64` fails the build if the default is flipped. React renders 100% of merchant pages and both theme editors preview React.
- **Merchants cannot use it.** Login fails closed without identity JWKs (by design, unprovisioned). Mobile login is triple-blocked (missing secret + no in-app Turnstile challenge + single-use token double-spent). Payouts have no provider client. 18 self-admitted capability gaps, 19 human-required items, 53 SKIP seams (52 unique IDs, one duplicated).

---

## 2. REALITY SCORE — 5 / 10

Composite of "is there one truth?" across layers. Repository-internal reality: **7.5/10** (one architecture, one law, honest labels). Repo-vs-production reality: **2/10** (the deployed world has none of it). Domain-level: money and themes still split. The prior audits' "temporal triplication" (main / HEAD+30 / uncommitted worktree) is collapsed to **two** realities — local-converged vs remote-stale — which is real progress, but the stale one is the one with users.

| Layer | One reality? | Score |
|---|---|---|
| Active code topology | Yes (verified single ownership per domain) | 8/10 |
| Governance/law | Yes, one chain, minor stale articles | 7/10 |
| Merchant identity | Yes (one issuer, crypto-proven) | 7/10 |
| Money | **No** — ledger + 4 other stores | 4/10 |
| Theme runtime | **No** — winner renders 0% | 3/10 |
| Repo vs deployed | **No** — 127 commits apart | 2/10 |

## 3. ARCHITECTURE DUPLICATION SCORE — 8 / 10

One active architecture. Verified: deprecated aliases absent; reserved services manifest-only (2 files each, validator-enforced); rejected packages gone + unimported; storefront-runtime and merchant-control-plane are credential-less BFFs; one ops console active (`platform-console`). Deductions: 3 frozen apps retain functional `vercel.json` and all 4 frozen manifests still declare `deploymentAuthority.platform: "Vercel"` (if Vercel projects exist server-side, a push can deploy them — unrecorded seam); an 18-file dormant `identity-foundation` shadow stack inside the active gateway (recorded seam); near-identical twin `queue-projection-plans.ts` files (~460 lines, formatting-only diff) in gateway and queue-workers (unrecorded drift risk); ghost `packages/typescript/utils` reference in `tsconfig.workspace.json:68`; stale `"branch": "develop"` entries in `config/vercel/projects.json`.

## 4. GOVERNANCE DUPLICATION SCORE — 7 / 10

One operative authority chain (Constitution → AGENTS.md/V2 → Canonical Systems), validator-pinned, generator retired. Deductions, all verified: the Constitution's own text predates the promotion it authorized — ART-21 still calls AGENTS.md "a map, not law" and ART-24 still calls the ops survivor "tentative (UNVERIFIED)" while the operative rulebook declares it resolved; `CLAUDE.md` states the precedence order backwards (AGENTS.md first, Constitution second — both law docs say the reverse); two diverged copies of DOC 02 exist (root AGENTS.md vs `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_AGENTS_V2.md`, 4 hunks apart, and the Constitution's pointer names the stale copy); six reserved-service `AGENTS.md` stubs still read "Status: Incubating" — forward guidance toward forbidden activation, unchecked by any validator; a second root-level "Constitution" (`CONVERGENCE_CLEANUP_2026_06_10/GOVERNANCE_CONSTITUTION.md`) self-subordinates correctly but persists as standing procedural law outside the rewrite set; three ARB signatures pending (GATE-1 ratification, ops-survivor, survivability repeal) — the chain is operative-by-directive.

## 5. MONEY INTEGRITY SCORE — 4 / 10

The ledger kernel is the best component in the repo: append-only enforced by UPDATE/DELETE triggers (`139_...ledger_core.sql:163-382`), deferred debit=credit constraint, migration 165 revokes UPDATE/DELETE from every role including `service_role` (verified — privileges bind even with BYPASSRLS), idempotent postings, payout double-release protection via `FOR UPDATE` + ledger-derived balance (`160:357-421`), settlement variance opens `recon_breaks` instead of auto-plugging, merchant balance endpoint fails closed without verified zero-variance reconciliation.

But it is the *only-money-reality* claim that fails:

| # | Violation | Evidence |
|---|---|---|
| 1 | **Entire shopper capture surface un-ledgered.** `confirm_order_payment_with_ledger` posts zero ledger lines (verified: 0 ledger refs in function body, `000_baseline.sql:1590-1709`, never redefined). Reached from `payments.ts:1097`, `checkout.ts:654`, `storefront/checkout-payment-routes.ts:620/860/1187`, `internal-payment-routes.ts:163` (= all provider webhooks). | P0 |
| 2 | **False attestation in data.** `checkout.ts:673` stamps `capture_posted_to_ledger: orderPlan.provider !== 'cod'` immediately after the non-ledgering call (verified). | P0 credibility |
| 3 | **Un-ledgered refund path.** `complete_order_refund` (`000_baseline.sql:1039-1190`, used by returns flow) — no ledger lines. Only the V1 `/payments/:id/refund` route ledgers. | P0 |
| 4 | **Cross-flow `merchant_payable` double-credit.** Commission reconcile, settlement ingest, and COD remit each credit the same order's money under different `source_id`s; ledger idempotency cannot dedupe across flows; an inflated balance passes the payout release check. Repo admits it (SKIP rows 32/35). | P0 when live |
| 5 | **Mutable stored value outside everything.** `ai_credits.balance` read-modify-write (`ai.ts:1112-1142`); `gift_card_accounts SET balance = balance - …` inside `create_checkout_order`. Not in any validator's table list. | P1 |
| 6 | **Validator blind spots.** `canonical-ledger-only-validator` scans only `services/`+`packages/` (never `database/`), passes a file on a whole-file substring (a *comment* mentioning `capture_ledger_transaction_id` waves through a naked money write — mutation-proven), and exempts 9 files including exactly where `partner_payout_ledger_entries` is mutated. `commission-bps-zero` catches only the literal `300` (a `500` default passes — mutation-proven) and excludes all migrations except 162. | structural |

Five money stores coexist: canonical ledger; legacy `payment_transactions`/`orders`; `wallet_ledger_entries` (compatibility); `partner_payout_ledger_entries` (validator-exempt); `ai_credits`/`gift_card_accounts` balances. No real-money loss is possible *today* only because every live rail is a fail-closed stub (no payout client, no live PSP credentials, sandbox default).

## 6. THEME CONVERGENCE SCORE — 3 / 10

Strategic winner: Liquid. Runtime winner: **React, 100% of traffic, structurally unflippable.** Verified chain: default OFF (`theme-governance.ts:14`) → per-store canary key has **no write path anywhere** (grep: only theme-engine source/tests + store-service read-through) → no store carries a Liquid bundle (bundles exist only in test fixtures; 5 of the 20 "portable sections" exist *only* inside the fixture; spot-reads show stubs that ignore their own settings — `product-detail` declares `showGallery` and renders no image) → no CSS exists for any `lb-*` class → the rendered `layoutHtml` is computed then discarded (`composition-engine.tsx:352`) and section groups are hard-coded empty for Liquid plans, so a canaried store would render naked, chrome-less, unstyled HTML → both theme editors preview React → and `theme-governance-validator.mjs:60-64` **fails the build if Liquid is flipped on** (verified). What is real: DOMPurify + LiquidJS auto-escape genuinely in the render path with fragment/head/document modes (D7's security claims verify); the 20-file React freeze ratchet works (mutation-proven) but only watches one directory. D7's parity/canary claims describe scaffolding presented as capability.

## 7. IDENTITY CONVERGENCE SCORE — 7 / 10

Merchant realm: exactly one issuer, asymmetric, alg-pinned, HS256-downgrade rejection proven by running the D3 suite (5/5). Switch takeover fixed and committed (4/4 test, though the test is source-structural, not a live request). `lb_accounts` capped at 90d. Total signer census: 4 (identity-platform asymmetric; `auth-core` HS256 for shopper/app/console populations; dormant sandbox `mock-key-service`; AUTH_SECRET-signed operator impersonation tokens). Deductions: step-up auth is a self-issued `recorded-gap-step-up-${uuid}` placeholder accepted by an "any ≥12 chars" check (`security-controls.ts:20-32`) — the refund-approve and payout-release gates are decorative (honestly labeled, still not crypto); OIDC is a 501/`implemented:false` skeleton; passkeys flag-off with no server RP; `AUTH_SECRET` remains load-bearing for cookies/impersonation/media/checkout-signing and as `INTERNAL_API_SECRET` fallback — anyone holding the internal secret can forge internal SSO headers and thereby any merchant identity to the gateway; one non-constant-time token compare (`custom-domains.ts:329`); staff/ops population is the weakest (static token + impersonation HMAC, SKIP-OPS-SSO-IDP open). Merchant login fails closed in staging/production until JWKs are provisioned — convergence achieved at the price of zero deployability without the human seam.

## 8. VALIDATOR INTEGRITY SCORE — 7.5 / 10

Teeth, not theater — with two structural holes. Census: 109 validator files, 92 wired into the gate (1 report-lane), 14 orphans (5 referenced nowhere — dead). Gate passes green on the current tree. Mutation testing: 9/9 probes behaved correctly; GATE-1 self-block is gone and inverted; the multi-region/survivability self-mandate is repealed AND now actively forbidden (`whole-repo-end-state` asserts the `globalRegions` contract must NOT exist; `meta-no-theater` bans survivability validators re-entering the gate). The two holes, both verified: **(A)** `production-deploy.yml` never runs the 92-validator gate — it is not a `needs:` prerequisite of any deploy job, gate workflows can't cross-block it, and no branch-protection-as-code exists in-repo; a `workflow_dispatch` deploy bypasses everything. **(B)** Untracked destructive migrations are invisible to every validator (probe `999_temp_audit_probe.sql` with `DROP TABLE payouts;` — migration-safety exit 0, stale-artifact counted-but-passed) while the deploy step runs `supabase db push --include-all`, which applies local files regardless of git tracking. Lesser: substring-evidence and literal-300 narrowness (see §5); the `legacyAllowedUntilD5` exemption set has no enforced expiry; one gate validator still requires the ledger to attest the historical `D12-D13-GATE-RESTORE` row — bookkeeping that reads as if survivability was restored (it wasn't; the repeal SKIP row coexists).

## 9. DOCUMENTATION CONVERGENCE SCORE — 7.5 / 10

1,191 markdown files: 10 canonical law, 8 operational ledgers, 52 historical-audit (4 dirs), 777 archived, 258 active reference, 86 code-boundary. Root is exactly the 9 allowlisted files; the 16 build-mission specs exist only in archive (dual-authority risk did not materialize); README converged; a real prompt-perimeter validator enforces the PROMPTS.md registry; no active doc instructs toward rejected architecture. Residue: the executed Codex master prompt is still registered CANONICAL-EXECUTION with no EXECUTED/DO-NOT-RE-RUN stamp (the duplicate `SKIP-RAZORPAYX-ENUM-PURGE` row is live evidence of the double-append failure mode a re-run would cause); `docs/auth/` (54 files) contains a rival "single execution source of truth" master plan that root registries cite as living authority and whose SSO docs treat frozen marketplaces as live targets; 4 root business binaries (2 pptx, 2 xlsx) that Batch 4 ordered archived remain at root; frozen-marketplace ops runbooks carry no frozen banner; the cleanup's second "constitution" isn't stamped historical; same fact lives in up to 3 registries (update-in-three-places hazard).

## 10. PRODUCTION READINESS SCORE — 3.5 / 10

**Can 100 merchants use LetBuyy tomorrow? No.** Blocking chain, each verified: (1) production runs `c2547049` — account takeover live, 3% rake live, anon RLS leaks unfixed at the schema level; (2) even after promotion, merchant login fails closed until identity JWKs are provisioned (SKIP-D3) — and the first guarded deploy fail-closed-blocks because `stepup/main` doesn't exist on the remote and the runbook never says to push it; (3) hosted checkout fails closed without `CHECKOUT_SIGNING_SECRET` + DNS (SKIP-D6); (4) payouts cannot move money — `PayoutProviderUnavailable` is thrown unconditionally absent an injected client (CAP-C03); (5) captures wouldn't be ledger-certifiable even if they flowed (CAP-C01); (6) mobile login triple-blocked; (7) no observability/alerting (CAP-C10), no PITR evidence (SKIP-W0). **1,000 merchants:** additionally untested under load, no telemetry, withTenantTx at 0% adoption means tenancy under concurrency rests on app-layer checks around an RLS-bypassing admin client (906 `getSupabaseAdmin` calls / 99 files, all in api-gateway). The improvement since the June 10 audits (readiness 2.3) is real but it is *repository* readiness: honest labels, fail-closed seams, reversible migrations, a 34-secret preflight, encrypted pre-migration backups, staging E2E gate. Live capability has not moved.

| Domain | Score | One-line truth |
|---|---|---|
| Auth/Identity (merchant) | 6 | One issuer, crypto-proven; undeployable without keys |
| Sessions | 5 | 6 mechanisms; merchant clean, staff/static-token weak |
| Payments capture | 2 | Un-ledgered + false attestation; sandbox-only |
| Ledger/Settlement | 6 | Kernel excellent; only settlement-side wired |
| Payouts | 2 | No provider client; release protection good |
| Checkout | 5 | Signed handoff + reserve→commit real; needs secret+DNS |
| Orders/Inventory | 6 | Reserve→commit RPCs + expiry sweeper committed |
| Themes | 3 | Winner renders 0% |
| Mobile | 4 | Converged internally; login triple-blocked |
| Security | 5 | S0s fixed locally; deployed world still vulnerable |
| Observability | 1 | Nothing provisioned |
| Deployment | 3 | Well-gated pipeline that has never run; old lane unguarded |

## 11. REMAINING ALTERNATE REALITIES

1. **`origin/main` == `origin/develop` (the deployed reality)** — 127 commits behind, carries every condemned defect; the only reality CI/remote/production know. *Recorded* as a human seam, but it is the dominant risk in the system.
2. **Money: 5 coexisting stores** — canonical ledger; `payment_transactions`/`orders` status world (captures/refunds live here exclusively); `wallet_ledger_entries` compatibility rows; validator-exempt `partner_payout_ledger_entries`; mutable `gift_card_accounts`/`ai_credits` balances.
3. **Theme: React runtime vs Liquid strategy** — gate-enforced to stay split until an ARB decision; canary un-armable without DB surgery.
4. **Identity shadow stack** — 18 dormant files inside the active gateway + 13 never-read feature flags + legacy mint fallback (recorded drain seam).
5. **Frozen apps as deployable ghosts** — 3 functional `vercel.json` + 4 manifests claiming Vercel authority; fully installed and CI-typechecked every run ("frozen" exists in docs, not toolchain).
6. **Dual DOC 02** — root AGENTS.md vs stale `LETBUYY_AGENTS_V2.md`, 4 hunks diverged, Constitution points at the stale one.
7. **`docs/auth/` rival execution authority** — 54-file program self-described as "the single execution source of truth," cited by root registries.
8. **Twin queue-projection planners** — ~460-line near-identical files in two services, unflagged.
9. **Two racing staging lanes** — `deploy-staging.yml` and `staging-deploy.yml` both fire on push to develop with different concurrency groups; plus a second guard-less manual production lane (`production-rollout.yml`).

## 12. REMAINING TECHNICAL DEBT

Config/process: ghost `packages/typescript/utils` in `tsconfig.workspace.json` (breaks workspace `tsc --build`); ~36 used-but-undeclared env keys — `EMAIL_QUEUE` binding bound in no wrangler.toml (order-confirmation emails silently never queue), KYC/logistics/KMS/push families undeclared, `MEDIA_UPLOAD_SIGNING_SECRET` silently falls back to AUTH_SECRET; 17 dead feature flags (15 identity flags never set — 13 never even read; `FEATURE_LIQUID` set in three env sections and read by nothing — the Liquid kill-switch is decorative; `STOREFRONT_POOLED_SQL` unread); `[env.production.vars]` ships `…_MODE="live"` next to `SKIP_NEEDS_HUMAN_` placeholders for AI/WhatsApp/push (fail-closed at runtime, but "live" labels overstate); the `.store→.com` sed left `dns.tf` + `letbuyy_com.tf` defining overlapping records for the same zone under two zone-id variables (Terraform un-appliable as-is) and erased every `# CUTOVER:` comment's meaning; secret-matrix still enumerates frozen apps as env owners. Code: 906 `getSupabaseAdmin` / 99 files vs `withTenantTx` at 5 total occurrences (0% adoption — the safe path is the dead code; tenant resolvers themselves return the admin client); 105 raw `Color(0x…)` literals in ~15 Flutter files outside the converged token system; Firebase residually load-bearing for media (2 next.config image-host allowlists + dormant storage provider); `auth-core/src/legacy.ts` zero-importer shim; 176 tracked binary screenshots under `artifacts/`; `.claude/` untracked and un-gitignored; stale "not committed" column on EXECUTION_LEDGER rows 1–46; duplicate `SKIP-RAZORPAYX-ENUM-PURGE` ID; `razorpayx` still accepted by 3 DB CHECK constraints; 5 truly-orphaned validator files; mobile release lane is Android-only, artifact-only (no store publish, no iOS).

## 13. REMAINING CAPABILITY GAPS (repo's own registry, code-verified)

18 CAP gaps + 19 HR items + 53 SKIP rows. The ones that gate real merchants with real money: capture ledgering (C01) and refund ledgering (C02) — confirmed un-fixed in code, not just unprovisioned; payout provider client (C03) — adapter throws unconditionally; reconciliation scheduling (C04) — RPC exists, nothing calls it; settlement executor (C05); step-up crypto (C06) — placeholder confirmed; OIDC/JWKS rotation/revocation (C07); Liquid chrome/CSS/editor (C08); mobile Turnstile double-spend (C09) — structural, secret alone won't fix; observability/alerting (C10); live tenant red-team probe (C11); transactional email (C14 — plus the dead `EMAIL_QUEUE` binding); live KYC (C15); logistics (C16); identity live keys + OIDC clients + passkey RP (SKIP-D3); checkout DNS/secret (SKIP-D6); PITR (SKIP-W0); WhatsApp WABA/BSP (D10). Pattern: **the repo is converged but not capable** — every live seam fails closed by design, which is honest, and also means zero end-to-end merchant journeys can complete in production.

## 14. IMMEDIATE PRIORITIES (ordered)

1. **Collapse the temporal split.** Maintainer review → push `main` AND `stepup/main` to origin (the guard fetches `refs/heads/stepup/main`; `MERGE_RUNBOOK.md` step 4 must be corrected first or the first guarded deploy fail-closed-blocks). Until pushed, every day extends the window in which the only deployable reality contains an account takeover and a 3% rake — and `workflow_dispatch` on the old workflow can ship it with zero new gates.
2. **Sequence the go-live atomically:** provision identity JWKs + Turnstile + checkout signing secret + apply migrations 160–167 *with* the deploy — the new code fails closed without them (a code-only deploy bricks merchant login).
3. **Close the two enforcement holes:** make the 92-validator gate a `needs:` prerequisite in `production-deploy.yml` (and the rollout lane), add GitHub branch protection, and reject untracked files under `database/supabase/migrations/` before any `db push --include-all`.
4. **Make money one reality:** rewrite `confirm_order_payment_with_ledger` and `complete_order_refund` to post canonical entries atomically (C01/C02); delete the false `capture_posted_to_ledger` attestation; add cross-source `merchant_payable` dedupe; extend the canonical-ledger validator to scan migrations, require call-adjacent (not whole-file-substring) evidence, sunset the 9-file exemption, and add gift-card/AI-credit tables.
5. **Resolve the theme fiction:** either build the canary write path + CSS + chrome (`layoutHtml` is already computed — stop discarding it) + editor support, or amend the ratified decision. The current state — winner enforced OFF by the gate that certifies it — is the old "governance theater" pattern in miniature, well-labeled.
6. **Governance hygiene (cheap, high-trust):** amend Constitution ART-21/ART-24/§14.2.3, fix `CLAUDE.md` precedence, collapse the dual DOC 02, rewrite six "Incubating" reserved-service stubs, stamp the executed Codex prompt EXECUTED, archive the 4 root binaries, dedupe the SKIP ID, backfill the ledger commit column, gitignore `.claude/`, obtain the 3 pending ARB signatures.
7. **Then** work the live-capability seams in SKIPPED/CAP order (payout client, PSP credentials, reconciliation scheduling, observability, mobile Turnstile structural fix).

## 15. FINAL RECOMMENDATION

**PROMOTE, ARM, THEN BUILD CAPABILITY — in that order, and treat the repository's own claims as trustworthy-but-scoped.**

The convergence program did what it said: this is no longer a repository lying to itself. Labels are honest, seams are recorded, validators bite, history is clean, and the prior audits' worst structural findings (temporal triplication, governance self-blocks, scan-generated law, account takeover, rake, self-mandated forbidden work) are genuinely resolved *in the committed tree*. The remaining dishonesty is small and named: one false data attestation (`capture_posted_to_ledger`), one "with_ledger" function that isn't, "live" env labels on placeholder values, and a winner that the gate itself keeps off the field.

But convergence happened on one machine. The remote, the CI, the production DNS, the deployed workers, and any merchant who shows up today all live in the condemned reality of June 9. The single highest-leverage act available is also the simplest: the push. Everything else — the gate-wiring, the JWKs, the capture ledgering, the theme decision — is downstream of the two realities becoming one.

**Most important question, answered:** LetBuyy is operating as **MULTIPLE REALITIES** — exactly two at the system level (converged-local vs deployed-stale), with two domain-level splits (money, themes) inside the converged one. It is one push, one secrets ceremony, and two domain decisions away from being able to say ONE.

---

### Appendix A — Agent→finding traceability

| Agent (user spec) | Coverage | Key verdict |
|---|---|---|
| 1 Architecture + 14 Duplicate Ownership | apps/services/packages topology, imports, deploy configs | ONE active architecture, 8/10 |
| 2 Governance | AGENTS.md, Constitution, authority chain | ONE chain, 7/10 |
| 3 Payments & Ledger | all money routes, migrations 139/160/162/165, validators run, tests run | MULTIPLE money realities, 4/10 |
| 4 Identity & Session | issuer census, D3 tests executed, switch fix verified | 1 merchant issuer / 4 signers, 7/10 |
| 5 Theme & Storefront | render path traced, validators run | React 100%, 3/10 |
| 8 Validators | 9 mutation probes, gate executed, CI workflows | Teeth + 2 holes, 7.5/10 |
| 9 Docs + 10 Prompt Drift | 1,191 md classified, perimeter validator | Converged, 7.5/10 |
| 11 Dead Runtime + 13 Hidden Deps | imports, routes, flags, env vars | Code graph clean; config surface medium |
| 6 Mobile + 7 Infra/Deploy | origin/main dissected, login flow traced, tf read | Two products; mobile triple-blocked |
| 12 Readiness + 15 Archaeologist | 127 commits reconstructed, ledger cross-checked, tests run | Cleanup real; ledger truthful; 2 realities |

### Appendix B — Discrepancies between sources (reconciled)

`getSupabaseAdmin`: 904 vs 906 across two agents (scope difference; ≈906/99 files, all api-gateway). Validator count: 92 in today's gate vs ledger's "93" (one consolidated). MCP "62 routes" legend: actual architecture is 44 allowlisted prefixes + 4 concrete routes over one catch-all proxy (the 62 matches merchant-control-plane's 62 BFF route files). `.DS_Store`: 0 tracked (prior "1 remains" claim stale or over-delivered). SKIP rows: 53 rows, 52 unique IDs. EXECUTION_LEDGER "not committed": stale pre-freeze truth, resolved by commit `72e80c2b` (STEPUP-COMMIT-0), not fabrication.

*All mutation probes and temp files created during this audit were deleted; final `git status --porcelain` shows only pre-existing `?? .claude/` plus this report's directory.*
