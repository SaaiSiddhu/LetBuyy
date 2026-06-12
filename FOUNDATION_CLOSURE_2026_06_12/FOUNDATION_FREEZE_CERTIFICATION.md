# FOUNDATION FREEZE CERTIFICATION — LETBUYY

**DOC: FC-02 · Drafted 2026-06-12 at HEAD `da83ba92` · STATUS: ARMED, NOT ACTIVE**
**Activation clause:** this certification becomes ACTIVE only when all seven `CLOSURE-B*` rows (FC-01 §Definition of Done) exist in `EXECUTION_LEDGER.md` at a SHA where the gate is green, the tree is clean, and `main == stepup/main == origin/main`. Until then it binds nothing and certifies nothing. Signing it early is itself a governance violation.

---

## 1. ARCHITECTURE — FROZEN

**Certified state (already true at `da83ba92`, survives closure unchanged):** one modular monolith (`services/api-gateway`, single Worker, hosts checkout/payments/payouts/wallet/settlements/orders/themes) + 4 satellite Workers (webhook-service, queue-workers, mobile-bff) + 5 Vercel apps + 1 Flutter app; one region; reserved roots manifest-only (2 files each); zero Dockerfiles; zero frozen→active imports; deprecated aliases exist only under `docs/archive/`.

**MAY change:** route/handler additions inside existing runtimes; internal refactors that keep the import graph acyclic and runtime count fixed; activation of a reserved root ONLY via human-approved scope (CLAUDE.md) with source+tests+deploy config in one reviewed change.
**MAY NEVER change (without constitutional amendment):** runtime count/topology; introduction of microservices, CQRS, event sourcing, saga orchestration, an event-bus runtime, multi-region; resurrection of deprecated aliases; un-freezing `apps/{app-marketplace, developer-portal, theme-marketplace, platform-operations-portal}` as deploy targets; deletion of the GraphQL/extensions surface other than through the open ARB seam `SKIP-GRAPHQL-EXTENSIONS-SCOPE-ARB`.

## 2. GOVERNANCE — FROZEN

**Certified state at activation:** authority chain Constitution (DOC 01) → root `AGENTS.md` (DOC 02, hand-authored) → nested AGENTS — internally consistent, 78 files, no scan-generated active law; gate green at ~107 validators including the B4-reworked migration validator, B3-extended deployment-safety, and the B7 secret-topology validator; **every deploy workflow runs the gate before deploying** (B3); the gate sees untracked migrations (B4); `PROMPTS.md` registry tree-consistent; root md budget 9/9.

**MAY change:** adding validators that tighten reality-enforcement; converting document-grep validators into reality validators; ledger/SKIP/HR row appends; archive moves under `docs/archive/`.
**MAY NEVER change:** removing/weakening a `criticalGateValidators` entry; removing the gate from any deploy workflow; re-splitting the validator file universe (tracked-only readers); deleting EXECUTION_LEDGER/SKIPPED/EXECUTABLE_HUMAN rows (append-only); exceeding the 9-file root md budget; registering two ACTIVE canonical execution prompts for one mission.

## 3. MONEY — FROZEN

**Certified state at activation:** exactly one canonical, append-only, double-entry ledger (`ledger_entries`/`ledger_transactions`, mutation-rejecting triggers `139:163,358`, deferrable balance trigger `139:378`, single-writer `writer_module='settlement'`); capture/refund/payment-failure/COD/payout all post atomically (`168`, `160:357`); real Razorpay Route rail, no self-custody, idempotent lock-guarded release; `commission_bps = 0` by migration 162 default+backfill + constraint 152 + validator; **no reachable money-mutation path without a canonical ledger post (B6 closed in Form A or B)**; invariant runner asserts on result rows with a committed negative control (B5).

**MAY change:** new money flows ONLY through `post_ledger_transaction`-mediated, validator-listed paths with scenario coverage; recon alert hardening (logs→pager); gift-card/store-credit reconciliation INTO the canonical ledger (a tightening, pre-approved direction — Launch backlog).
**MAY NEVER change:** ledger append-only semantics; balance-as-derived (no mutable balance column may become truth); the 0% commission default (`DEFAULT 300` restoration = constitutional violation); reintroduction of self-custody rails (`razorpayx` fund accounts); any money table leaving `canonical-ledger-only-validator`'s list; weakening the B5 runner back to exit-code-only.

## 4. IDENTITY — FROZEN

**Certified state at activation:** `/api/auth/switch` guard committed (valid session + proven-on-device, `switch/route.ts:56-81`); step-up real (HMAC + TOTP re-verify, enforced 428 on `refund.approve`/`payout.release`/`dsr.erase`); EdDSA/ES256 issuance + JWKS verification implemented; mobile login via identity-platform (CSRF+Turnstile); OIDC honestly 501-gated; **internal auth is per-caller keyring, no architectural requirement for shared `INTERNAL_API_SECRET` (B7-code), legacy acceptance sunset-marked**.

**Known-open (frozen AS DEBT, not as architecture):** 9 token issuers incl. parallel Supabase GoTrue (sellers/employees); EdDSA sole-issuer enforced only in production runtime; KYC advisory. These are **registered Launch-era identity work** (LAUNCH_HANDOFF §6). Freezing means: no NEW issuers, no NEW shared-secret surfaces, no expansion of GoTrue usage — convergence may only proceed toward identity-platform.
**MAY change:** issuer consolidation toward identity-platform; enforcing EdDSA in staging; KYC-gating payouts; per-runtime secret rotation completion (B7-live).
**MAY NEVER change:** reintroducing a shared signing secret across runtimes; weakening the switch guard, step-up enforcement, or two-realm cookie isolation; minting tokens in frozen apps.

## 5. THEME OWNERSHIP — FROZEN

**Certified state at activation:** exactly two renderers (React live-default, liquidjs built-and-dormant); one canonical theme model (theme-package lineage + `template_config`); `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` pinned by `theme-governance-validator.mjs:60-61`; 20-section React allowlist enforced; both editors (web + Flutter) produce the same Liquid bundle format.

**MAY change:** Liquid parity work (filling the 0/200 matrix, fixing the `capture-snapshot.mjs:64` header stub, real telemetry sink); per-store canary enables in staging; React *section* bug-fixes within the existing 20.
**MAY NEVER change:** adding a third rendering engine; new React section files; flipping the Liquid default outside the ARB-gated flip (Wave 6 / launch Phase E); deleting React before parity 200/200 + ARB approval + G+30d stability (LIQUID_ACTIVATION_PROGRAM.md:5,60-62); forking the theme model (mobile must keep producing the canonical bundle).

## 6. CLEANUP PROGRAM — CLOSED (with registered residue)

**Certified state at activation:** dead flags removed; prompt perimeter clean; root budget held; provider posture honest (1 live email provider); 9 local branches deleted; `origin/develop` deleted at B1-a; **registered, ARB-gated residue explicitly carried forward, NOT silently dropped:** GraphQL+extensions 5,063 LOC (`SKIP-GRAPHQL-EXTENSIONS-SCOPE-ARB`), ~30K LOC frozen apps (half-quarantine: topology-registered/build-excluded), 43MB `artifacts/shopify-ux` PNGs, secret-matrix OAuth residue, ≥3 dead deps. Cleanup is CLOSED as a *program* — residue moves to the Launch-era backlog under its SKIP/ARB rows.

**MAY change:** executing the registered deletions when their ARB seams close (proof-before-delete, one deletion per commit, revert command in ledger row).
**MAY NEVER change:** deleting anything without its seam closing; "cleanup" that touches money/identity/theme frozen surfaces; re-tracking deleted prompts.

## 7. FOUNDATION PROGRAM — CLOSED

At activation, the foundation program itself terminates: REPOSITORY_TRUTH → CONVERGENCE → CLEANUP → SAFE_DELETION → LAUNCH_READINESS scaffolding → TRUTH_CERTIFICATION → CLOSURE. No further foundation-era programs may be opened; new structural work happens as Launch-era scoped changes under DOC 01/02. The era's documentary record (8 program directories) is immutable history.

---

## ACTIVATION RECORD (to be completed by the executor + human owner — empty until closure)

| Field | Value |
|---|---|
| Closure SHA | _pending_ |
| Gate validator count at closure | _pending (~107)_ |
| CLOSURE-B4/B3/B5/B6/B7/B2/B1A ledger lines | _pending_ |
| `git ls-remote origin` transcript ref | _pending_ |
| Human owner signature (B1-a operator) | _pending_ |
| Date of activation | _pending_ |

**On completion of this table: FOUNDATION ERA — CLOSED. Successor authority: `LAUNCH_HANDOFF_DOCUMENT.md`.**
