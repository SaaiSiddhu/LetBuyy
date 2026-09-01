# LETBUYY FINAL CONVERGENCE MASTER PROGRAM

**Program:** LetBuyy Final Convergence · **Document 5 of 5 (master)** · **Status:** PLAN ONLY — no code changes authorized by this document
**Purpose:** combine the four implementation plans into one dependency-ordered, gated execution program suitable for Codex execution, ARB review, and long-term governance.
**Audited HEAD:** `cabe148c` (`main`==`stepup/main`, clean) · **Remote:** `origin/main`==`41b6ea49` (127 behind).
**Constraint banner:** no new services · no microservices · no CQRS · no event sourcing · no extension/Wasm runtime expansion · no marketplace architecture · respect every strategic winner (Liquid, canonical-ledger SSOT, identity-platform sole issuer, RLS+GUC, modular monolith, one region, 0% commission, Constitution). All work lives in the existing 5 active apps + 4 active services + packages + queue-workers.

---

## 1. THE FOUR PLANS AT A GLANCE

| Doc | Plan | Priority | Fixes | Target |
|---|---|---|---|---|
| 1 | Reality Promotion | P1 — root dependency | deployed reality 127 behind; gate not in deploy; runbook trap | one deployed reality |
| 2 | Money Unification | P2 | capture/refund un-ledgered; 5 money stores; validator blind spots | one financial reality (4→8–9, certified at P6) |
| 3 | Liquid Convergence | P3 — longest pole | Liquid renders 0%; ~15–20% parity; React owns 100% | Liquid runtime winner (3→10) |
| 4 | Duplicate Elimination | P4 | stale law, dual DOC-02, frozen-app deploy shape, ghost config, dead flags | one authority/reality/implementation |

---

## 2. EXECUTION ORDER & DEPENDENCY GRAPH

```
                ┌──────────────────────────────────────────────┐
   PHASE A  ───▶│ REALITY PROMOTION (root dependency)           │
   (P1)         │ collapse temporal split; wire gate into deploy│
                └───────────────┬──────────────────────────────┘
                                │ G4 (one deployed reality, gate-enforced)
              ┌─────────────────┼───────────────────────────────┐
              ▼                 ▼                                 │
   PHASE B (P2)         PHASE C (P3)                              │
   MONEY UNIFICATION    LIQUID CONVERGENCE                        │
   ledger total         Liquid → parity (parallelizable          │
   (rails fail-closed)  with B; no file overlap)                 │
              │                 │                                 │
              └────────┬────────┘                                 │
                       ▼                                          │
              PHASE D (P4) ◀───────────────────────────────────-─┘
              FINAL DUPLICATE ELIMINATION
              (runs after B & C settle their files)
                       │
                       ▼
              PHASE E  FOUNDATION CERTIFICATION
              (single-reality proof + anti-recurrence validators + ARB)
                       │
                       ▼
              PHASE F  CAPABILITY BUILD
              (provider seams: payout/PSP/KYC/logistics/email/WhatsApp/observability)
```

**Why this order:**
- **A first, always.** Money/Liquid/Duplicate work only matters once it can reach users; A is the gating dependency. A also closes the two enforcement holes (gate-in-deploy, untracked-migration) that every later deploy relies on.
- **B and C in parallel** after A: they touch disjoint file sets (B = money routes/migrations/queue-workers; C = theme-engine/storefront-runtime/editors). No merge conflict surface. B is gated higher (money) and is done while rails are fail-closed.
- **D after B and C** so it certifies the *final* file state rather than re-auditing a moving target; D's validator/DNS/env items that overlap A and B are *owned* by A/B and only *referenced* by D.
- **E** certifies single-reality and installs anti-recurrence validators.
- **F** builds live capability last — the repo is converged and certified before real money/identity/comms providers are switched on.

---

## 3. PHASE-BY-PHASE MILESTONES & GATES

### PHASE A — REALITY PROMOTION (Doc 1)
- **Milestones:** A0 safety snapshot (2 tags + DB backup) · A1 repo verify (clean, lag 0, gate green) · A2 branch convergence (push `main`+`stepup/main`, fix runbook, branch protection, neutralize `develop`) · A3 wire gate + untracked-migration rejection into both deploy lanes · A4 atomic go-live (secrets→migrate 160–167→deploy→DNS→smoke) · A5 post-promotion audit + 3 ARB signatures + branch-lag monitor.
- **Gates:** G0–G5 (Doc 1). **Blocking gate for the whole program: G4** (one deployed reality, gate-enforced).
- **Blockers:** identity JWKs / checkout secret / Turnstile (human seams) must be ready before A4; runbook step-4 correction before A2 push.

### PHASE B — MONEY UNIFICATION (Doc 2)
- **Milestones:** B0 financial inventory ratified · B1 capture ledgering (CAP-C01) + kill false attestation · B2 refund ledgering (CAP-C02) + cross-source dedupe · B3 settlement convergence (one chart) · B4 reconciliation wiring (CAP-C04) · B5 legacy money removal (proof-gated) · B6 production certification (CAP-C03/C05/C06 + live variance-0).
- **Gates:** MG0 + per-phase validation matrices; B6 needs A-G4 + provider secrets.
- **Blockers:** execute B1–B5 while rails fail-closed (no provider secrets) for zero financial blast radius.

### PHASE C — LIQUID CONVERGENCE (Doc 3)
- **Milestones:** C0 capability matrix + parity % · C1 rendering parity (consume `layoutHtml`, chrome, CSS, settings fidelity) · C2 editor parity + canary write path (CAP-C12) · C3 preview parity · C4 storefront canary · C5 checkout compat (CAP-C13 resolved/re-scoped) · C6 runtime validation (100% snapshot) · C7 React decommission (ARB validator amendment + deletion checklist).
- **Gates:** LG0 + snapshot-parity gate (hard gate for C7). Platform-wide flip needs ARB amendment of `theme-governance-validator.mjs:60`.
- **Blockers:** longest pole; expect overlap into Phase F.

### PHASE D — FINAL DUPLICATE ELIMINATION (Doc 4)
- **Milestones:** D0 ownership register · D1 docs convergence (dual DOC-02, Constitution articles, CLAUDE.md, reserved stubs, root binaries) · D2 prompt convergence (stamp executed prompt, widen perimeter) · D3 validator convergence (coordinate money/CI hardening) · D4 runtime convergence (frozen-app neutralization, shadow-stack drain, planner dedupe, withTenantTx adoption) · D5 config convergence (ghost ref, dead flags, env declarations, DNS reconcile) · D6 final repo certification.
- **Gates:** FG0–FG6. Runs after B/C settle.

### PHASE E — FOUNDATION CERTIFICATION
- **Milestone:** full forensic harness returns single-reality; all duplication scores at target; anti-recurrence validators in the gate (dual-DOC-02 sync, reserved-stub language, frozen-app non-deployability, widened prompt perimeter, branch-lag monitor, migration-aware canonical-ledger); ARB certifies single-reality.
- **Gate:** EG1 — the program's "ONE REALITY" certification.

### PHASE F — CAPABILITY BUILD
- **Milestone:** provider seams switched on in dependency order — payout client (CAP-C03), PSP creds, reconciliation live (CAP-C04), step-up crypto (CAP-C06), KYC (C15), logistics (C16), transactional/live email (C14/C18), WhatsApp (D10), AI-credit provider (C17), observability/alerting (C10), mobile Turnstile structural fix (C09), PITR (W0).
- **Gate:** each CAP/SKIP row removed only with live evidence; beta-readiness validator green.

---

## 4. MASTER VALIDATION GATE LADDER

| Gate | Owner phase | Blocks | Pass condition |
|---|---|---|---|
| G0–G3 | A | promotion | snapshot+verify+converged remote+gate-in-deploy |
| **G4** | A | **all of B/C/D deploy** | one deployed reality, login/switch/anon/commission smoke correct |
| G5 | A | program continuation | remote audit converged, ledger current, 3 ARB sigs |
| MG0 + B1..B5 matrices | B | B6 | every money path posts ledger; validator migration-aware |
| B6 | B | "real money" claim | live variance-0 + honest provider badges |
| LG0 + snapshot gate | C | C7 React deletion | 100% capability+rendering+snapshot+editor parity |
| FG0–FG5 | D | FG6 | every duplicate dispositioned with proof |
| FG6 / EG1 | E | F | single-reality forensic certification + ARB |
| per-CAP | F | launch | live provider evidence per row |

---

## 5. BLOCKERS & CRITICAL PATH

**Critical path:** A2 (branch push + runbook fix) → A3 (gate-in-deploy) → A4 (atomic go-live) → **G4** → [B ∥ C] → D → E → F.

**Hard human seams (cannot be code-completed) on the critical path:**
1. Push `main`+`stepup/main` to origin + branch protection (A2) — *fixes the runbook trap*.
2. Identity JWKs + checkout signing + mobile Turnstile secrets (A4) — *new code fails closed without them*.
3. 3 ARB signatures: GATE-1 ratification, ops-survivor, survivability repeal (A5).
4. ARB amendment of the Liquid default-OFF validator (C7) — *the only path to Liquid-as-default*.
5. Provider secrets for Phase F (payout/PSP/KYC/logistics/email/WhatsApp) — *off the critical path until F*.

**Top program blockers:**
- B-RP: a code-only promotion without secrets bricks login → A4 ordering is mandatory.
- B-RB: skipping the runbook fix → first guarded deploy self-blocks on missing `origin/stepup/main`.
- B-MG: deleting legacy money paths before the replacement is proven → INV violation; B5 is strictly proof-gated.
- B-LR: deleting React before 100% snapshot parity → C7 hard gate forbids it.
- B-FILE: B and D, or A and D, editing the same validator/DNS/env file concurrently → ownership rules below.

---

## 6. FILE-OWNERSHIP & CONFLICT-AVOIDANCE RULES

To let B ∥ C run safely and keep D from colliding with A/B:

- **Validators:** money hard-walls owned by **B**; CI/deploy gate-wiring + untracked-migration owned by **A**; docs/prompt/frozen-app validators owned by **D**. D *references* A/B validator changes, never re-edits them.
- **DNS Terraform:** reconciliation owned by **A** (Phase 4, needed for cutover); D *references* it (D-CFG3 points at A).
- **Env templates:** money-provider env owned by **B/F**; general declaration cleanup owned by **D**.
- **theme files:** exclusively **C**. **money files:** exclusively **B**. No overlap by construction.
- **Constitution/AGENTS.md/CLAUDE.md:** exclusively **D** (Phase 1) — A and B touch the *ledger/skip* docs, not the law docs, except A5's ledger backfill.

---

## 7. ROLLBACK POSTURE (program-level)

- Every phase has a paired rollback (Docs 1–4). The single highest-stakes rollback is **A4** (code re-pin + reverse migrations 167→160 + DNS revert) — clean *only* while money rails are fail-closed, which is why F (providers) is last.
- Never `git clean`/`reset --hard`/blanket restore (MERGE_RUNBOOK guardrail 1, cleanup constitution Rule #0).
- Archive, don't vaporize (L2): historical docs/code go to `docs/archive/`.
- Each delete is an independent reviewed commit with a paired reverse — never batch deletions.

---

## 8. GOVERNANCE & ANTI-RECURRENCE

The program ends (Phase E) by installing validators that make the converged state **self-defending**, mirroring the successful GATE-1 inversion pattern (validators now pin the law instead of the drift):
- branch-lag monitor (temporal split cannot silently recur),
- migration-aware + call-adjacent canonical-ledger validator (money cannot silently un-ledger),
- snapshot-parity + React-absence validators (theme cannot silently regress to React after decommission),
- dual-DOC-02 sync + reserved-stub-language + frozen-app-non-deployability + widened prompt-perimeter (duplication cannot silently return).

ARB signs the single-reality certification; `EXECUTION_LEDGER.md` records it with the stale commit column backfilled.

---

## 9. WHAT THIS PROGRAM DELIBERATELY DOES NOT DO

- Does not introduce any new service, microservice, CQRS, event-store, extension/Wasm runtime, or marketplace architecture (all rejected).
- Does not un-freeze React to reach parity faster (Liquid is built up; React stays frozen until proven-deletable).
- Does not switch on real money/identity/comms providers before the repo is converged and certified (Phase F is last, intentionally).
- Does not claim "production-ready for merchants" until B6 (money live-certified) + A-G4 (deployed) + F (providers) + beta-readiness validator are all green. Convergence ≠ capability — and this program keeps that distinction honest.

---

## 10. ONE-LINE PROGRAM THESIS

**Promote the one converged reality (A), make money one reality while it's safe to (B) in parallel with building Liquid to provable parity (C), eliminate the last duplicates against the settled tree (D), certify single-reality with self-defending validators (E), then — and only then — switch on real capability (F).** LetBuyy becomes ONE reality at Phase E; it becomes a product real merchants can use at Phase F.
