# Phase F Evidence Pack — Merchant Pilot Program

**Document:** 7 §6 (F10 criterion)
**Status:** SCAFFOLD — populated as pilot runs; all cells PENDING until human-triggered pilot

This file is the Phase F evidence pack index. F10 criterion: "per-merchant onboarding checklists +
weekly syntheses + issue register archived as the Phase F evidence pack." When all F1–F10 criteria
are met, this file triggers the Phase G GO/NO-GO convene.

---

## Evidence Index

### F1 — Volume (≥ 200 orders across 5 merchants)

| Merchant | Orders | Status |
|----------|--------|--------|
| M1 | PENDING | |
| M2 | PENDING | |
| M3 | PENDING | |
| M4 | PENDING | |
| M5 | PENDING | |
| **Total** | **PENDING** | **Target: ≥ 200** |

Evidence source: platform-console orders dashboard + `ledger_transactions` table count by site.

---

### F2 — Money Integrity (100% ledger trails, zero recon breaks, I1–I8 green)

| Check | Status | Evidence |
|-------|--------|----------|
| % orders with complete canonical ledger trail | PENDING | Query: `SELECT COUNT(*) FROM orders WHERE canonical_ledger_transaction_id IS NOT NULL` |
| Unexplained reconciliation breaks | PENDING | Recon log from `queue-workers` scheduled reconciliation |
| Invariant I1–I8 on pilot dataset | PENDING | `node scripts/money-certification/check-invariants.mjs` against production DB |
| Finance sign-off | PENDING | human seam |

**F2 is non-waivable. Red F2 → pilot extends or aborts.**

---

### F3 — Payouts (≥ 3 payout cycles per merchant via PA-split)

| Merchant | Cycles completed | Status |
|----------|-----------------|--------|
| M1 | PENDING | |
| M2 | PENDING | |
| M3 | PENDING | |
| M4 | PENDING | |
| M5 | PENDING | |

Evidence source: `payout_statements` table; operator release log in platform-console.

---

### F4 — Refunds/COD (≥ 10 refunds, ≥ 20 COD remittances)

| Metric | Count | Status |
|--------|-------|--------|
| Refunds processed | PENDING | Target: ≥ 10 |
| COD remittances processed | PENDING | Target: ≥ 20 |

Evidence source: `ledger_entries` WHERE `entry_type = 'refund'` or `entry_type = 'cod_remittance'`.

---

### F5 — Availability (storefront+checkout ≥ 99.5%, zero data-loss incidents)

| Metric | Value | Status |
|--------|-------|--------|
| Storefront uptime | PENDING | Synthetic check results |
| Checkout uptime | PENDING | Synthetic check results |
| Data-loss incidents | PENDING | Target: 0 |

Evidence source: Document 4 §3 monitoring dashboard; incident log.

---

### F6 — Security (zero cross-tenant incidents, zero step-up bypasses, RT probes green)

| Check | Status | Evidence |
|-------|--------|----------|
| Cross-tenant incidents | PENDING | Target: 0; incident register |
| Step-up bypass incidents | PENDING | Target: 0; security log |
| RT-1–RT-9 probes in production | PENDING | `tests/executable/tenant-redteam-postgres.test.mjs` against production-shaped DB |

**F6 is non-waivable. Red F6 → pilot extends or aborts.**

---

### F7 — Support SLOs (≥ 90% tickets met; zero P0 open > 24h)

| Metric | Value | Status |
|--------|-------|--------|
| Ack ≤ 2h (business hours) compliance | PENDING | |
| Money-affecting mitigation ≤ 24h compliance | PENDING | |
| Storefront-down mitigation ≤ 4h compliance | PENDING | |
| P0 issues open > 24h | PENDING | Target: 0 |

Evidence source: GitHub Issues `pilot` label + timestamps.

---

### F8 — Merchant Verdict (≥ 4 of 5 continue, ≥ 3 rate onboarding ≤ 1 day)

| Metric | Value | Status |
|--------|-------|--------|
| Merchants who would continue past pilot | PENDING / 5 | Target: ≥ 4 |
| Merchants rating onboarding ≤ 1 day effort | PENDING / 5 | Target: ≥ 3 |

Evidence source: end-of-pilot survey (founder-run weekly calls).

---

### F9 — Mobile Reality (M5 ≥ 80% mobile, core flows without web fallback)

| Metric | Value | Status |
|--------|-------|--------|
| M5 mobile-run core flows | PENDING | Target: ≥ 80% of actions from Flutter app |

Evidence source: M5 operator notes; mobile API call log by session.

---

### F10 — Evidence (checklists + syntheses + issue register archived)

| Artifact | Location | Status |
|----------|----------|--------|
| M1 onboarding checklist | `evidence/f-pilot/MERCHANT_M1_CHECKLIST.md` | PENDING |
| M2 onboarding checklist | `evidence/f-pilot/MERCHANT_M2_CHECKLIST.md` | PENDING |
| M3 onboarding checklist | `evidence/f-pilot/MERCHANT_M3_CHECKLIST.md` | PENDING |
| M4 onboarding checklist | `evidence/f-pilot/MERCHANT_M4_CHECKLIST.md` | PENDING |
| M5 onboarding checklist | `evidence/f-pilot/MERCHANT_M5_CHECKLIST.md` | PENDING |
| Weekly synthesis Week 1 | `evidence/f-pilot/WEEKLY_SYNTHESIS_W1.md` | PENDING |
| Weekly synthesis Week 2 | `evidence/f-pilot/WEEKLY_SYNTHESIS_W2.md` | PENDING |
| Weekly synthesis Week 3 | `evidence/f-pilot/WEEKLY_SYNTHESIS_W3.md` | PENDING |
| GitHub Issues pilot register | `https://github.com/[owner]/[repo]/issues?label=pilot` | PENDING |
| Issue register export | `evidence/f-pilot/ISSUE_REGISTER_EXPORT.md` | PENDING |

---

## Prior Phase Evidence References

| Phase | Evidence | Pointer |
|-------|----------|---------|
| A — Reality Promotion | Origin SHA == local SHA; G4 smoke | `FINAL_TRUTH_AUDIT_2026_06_11/G4_HUMAN_EXECUTION_PACKET.md` |
| B — Phase D Money Certificate | Scenarios S1–S12 + 7-day soak | `evidence/d-money-certification/` |
| B — Invariants I1–I8 | SQL checks green | `scripts/money-certification/invariants/` |
| C — Infrastructure | Doc 4 checklist 12/12 | `PRODUCTION_INFRASTRUCTURE_PROGRAM.md` §7 |
| D — Capture/Refund Ledgering | B1/B2 migration + tests | `EXECUTION_LEDGER.md` FINAL-B1-B2-CAPTURE-REFUND-LEDGERING |
| D — Reconciliation | B3-B5 convergence | `EXECUTION_LEDGER.md` FINAL-B3-B5-MONEY-CONVERGENCE-GUARDS |
| E — Liquid Parity | Parity matrix | `evidence/e-liquid-parity/PARITY_MATRIX.md` |
| E — Canary Metrics | X-Lb-Render-Engine header + lb:canary:render logs | `apps/storefront-runtime/src/proxy.ts`, `composition-engine.tsx` |

---

## Phase F → Phase G Gate

All F1–F10 criteria must be GREEN before convening the GO/NO-GO session (Document 8 §2).
F2 and F6 are non-waivable: red = pilot extends or aborts.

When ready, reference this pack from the `GO_NO_GO_TABLE.md` in this directory.
