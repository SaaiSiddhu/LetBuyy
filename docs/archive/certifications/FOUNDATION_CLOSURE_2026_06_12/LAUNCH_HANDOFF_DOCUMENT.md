# LAUNCH HANDOFF DOCUMENT — LETBUYY

**DOC: FC-03 · Drafted 2026-06-12 at HEAD `f961e23a` · Effective: upon activation of FOUNDATION_FREEZE_CERTIFICATION.md (FC-02)**
**Purpose:** the precise boundary between the Foundation Era (repository truth) and the Launch Readiness Era (real-world validation). Nothing in this document is foundation work; everything in it presumes B1a–B7 closed.

---

## 1. FOUNDATION COMPLETE — what "done" handed over

At the closure SHA: one monolith + 4 satellites, one region, one canonical money ledger with no reachable un-ledgered mutation path, asserting invariant tooling with negative controls, per-caller internal-auth architecture, gate wired into every deploy workflow and sighted on untracked migrations, `main == stepup/main == origin/main` under branch protection, honest append-only ledger/SKIP/HR registries, freeze certification active. **What is explicitly NOT handed over as done:** live production promotion, live money evidence, Liquid parity, pilot execution, identity issuer consolidation, secret rotation completion, ARB residue deletions — those are this era's work, below.

## 2. LAUNCH READINESS STARTS

Operating program: `LAUNCH_READINESS_2026_06_12/` (Phases A–G, 56 seams, GO/NO-GO 16 rows). Phase A preconditions are satisfied by foundation closure (origin == reality; gate trusted). The era's exit is the GO/NO-GO table fully populated with evidence links and 16 human verdicts.

## 3. HUMAN SEAMS (the era's currency — nothing below is agent-executable)

From `EXECUTABLE_HUMAN_REQUIRED.md` (19 rows + `HR-SECRET-ROTATION` added by B7 = 20) and `SKIPPED_HUMAN_DECISIONS.md`, grouped:

| Group | Seams | Unblocks |
|---|---|---|
| Production promotion | first gated deploy; G4 atomic go-live smoke; DNS/domain (letbuyy.com canonical) | §4 |
| Secrets & keys | per-runtime secret rotation + disable `INTERNAL_AUTH_LEGACY_ACCEPT` (B7-live); `LETBUYY_IDENTITY_PRIVATE_JWK` provisioning (staging EdDSA); KMS; Turnstile live keys | §4, §6 |
| Providers | PSP live credentials (Razorpay Route activation), KYC provider, carrier/logistics, ESP domain (Resend) | §5, money cert |
| ARB decisions | GraphQL/extensions deletion scope (`SKIP-GRAPHQL-EXTENSIONS-SCOPE-ARB`); Liquid default flip; pilot GO/NO-GO verdicts ×16 | §6, §7 |
| Live evidence runs | S1–S12 + I1–I8 against staging→prod; 7-day soak (G-D1/D2); D2 anon-grant probe; parity matrix population | §5, §6 |

## 4. PRODUCTION PROMOTION (B1-b — first act of this era, urgent security remediation)

Sequence: (1) human completes secret rotation onto the B7 per-runtime topology (one rotation event, final topology); (2) trigger `production-deploy.yml` (push→main path — gate + untracked guard + branch-lag guard all run; `LETBUYY_ENFORCE_BRANCH_LAG=1` resolves the now-existing `origin/stepup/main`); (3) **G4 atomic go-live smoke** (from `FINAL_TRUTH_AUDIT_2026_06_11/G4_HUMAN_EXECUTION_PACKET.md` + SKIP-A4): live probes must show `/api/auth/switch` denied for unproven accounts, anon `orders` access denied, `commission_bps = 0` live, EdDSA merchant-session issuance active (`IDENTITY_ISSUER_REQUIRED` honored). (4) Record in ledger as `LAUNCH-B1B`. Until this completes, the deployed product still ships the takeover — treat as an open incident, not a backlog item.

## 5. MONEY CERTIFICATION (Phase D of launch program)

Instruments handed over correct (B5 asserting runner + negative control; S1–S12 with real asserts; B6 path closed). This era runs them for real: seed staging fixtures → `pnpm money:invariants` green on staging → S1–S12 green end-to-end via product paths (S11 now exercises the real purchase path or asserts its 501) → 7-day soak with scheduled recon at zero unexplained variance (recon alerting upgrade logs→pager is registered backlog) → repeat I1–I8 against production read-replica post-promotion. Evidence lands in `LAUNCH_READINESS_2026_06_12/evidence/d-money-certification/` (currently empty by design). Exit: GO/NO-GO rows 4–7 green.

## 6. IDENTITY CONVERGENCE COMPLETION (registered debt from FC-02 §4)

Order of work: enforce EdDSA issuance/verification in staging (JWK seam) → migrate seller auth (`/auth/signup|signin`, `auth.ts:1342-1414`) and employee auth (`employee.ts`) off Supabase GoTrue onto identity-platform → retire gateway non-prod opaque mint (`auth.ts:1140`) → KYC gates payouts (decision + enforcement at `payouts.ts` settle path) → B7-live legacy-accept disable. Freeze rule en route: no new issuers, no new shared secrets, convergence only toward identity-platform.

## 7. LIQUID ACTIVATION (Phase E) & MERCHANT PILOT (Phase F)

**Liquid:** fix `capture-snapshot.mjs:64` header stub + point telemetry at a real sink (registered repo-side prework, small) → provision the two parallel staging stores (React-default + per-store `liquidRenderingCanary`) → populate the 20×10 = 200-cell `PARITY_MATRIX.md` via the snapshot harness → canary C1–C4 → ARB flip decision of `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` (validator pin moves WITH the ARB record, never ahead of it) → React decommission only after G+30d stability (LIQUID_ACTIVATION_PROGRAM.md:60-62).
**Pilot:** instantiate M1–M5 from `ONBOARDING_CHECKLIST_TEMPLATE.md` → run pilot via `.github/ISSUE_TEMPLATE/pilot-issue.md` protocol → populate F1–F10 evidence pack (F2/F6 non-waivable) → 16-row GO/NO-GO human verdicts.

## 8. ERA EXIT

Launch Readiness closes when: production promoted and smoke-proven (§4), money certified live (§5), identity debt cleared or formally re-scoped by ARB (§6), Liquid flip decided by ARB either way (§7), pilot F-pack complete with GO verdict (§7). Successor document: to be authored then — not now.
