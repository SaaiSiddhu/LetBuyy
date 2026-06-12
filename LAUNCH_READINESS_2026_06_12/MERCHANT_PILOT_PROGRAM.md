# DOCUMENT 7 — MERCHANT PILOT PROGRAM

**Scope:** Phase F. First 5 real merchants, 21-day pilot window. Entry conditions: Phase D money certificate, Document 4 checklist all-evidenced, CRITICAL seams for KYC/logistics/email/WhatsApp/mobile-login closed (or ARB-waived per §1). The pilot's strategic frame is the ratified wedge: India-first, 0% commission, UPI/COD/WhatsApp-native commerce.

## 1. THE FIRST 5 MERCHANTS (selection profile)

| Slot | Profile | Why this slot exists |
|---|---|---|
| M1 | Friendly/founder-adjacent, low volume (~5 orders/day) | tolerance for rough edges; fastest feedback loop |
| M2 | UPI-dominant prepaid seller (fashion/accessories) | exercises S1/S2 money paths at real volume |
| M3 | COD-heavy seller (tier-2/3 city customer base) | exercises COD remittance + logistics lane (S4) |
| M4 | WhatsApp-led seller (catalog + order updates over WhatsApp) | exercises the channel wedge end-to-end |
| M5 | Mobile-first merchant who runs the store from the Flutter app | exercises mobile login (Turnstile), mobile theme editor, mobile publish |

Constraints: all 5 pass KYC (automated, or manual `needs_review` path with ARB waiver per CAP-C15 status); none exceeds ₹50k/day GMV during pilot (payout exposure cap); at least one store opts into Liquid (Phase E synergy); written pilot agreement covering data, refund liability, and the offboarding promise (§5).

## 2. ONBOARDING PROCESS (per merchant, target < 1 day each, sequential M1→M5)

1. Account + store creation (identity-platform issuance; step-up live).
2. KYC: automated provider pass or manual review with evidence (no payout until KYC green — invariant).
3. Merchant PSP credentials connected + webhook proof (their Razorpay/Cashfree per SKIP-MERCHANT-PSP-LIVE-CREDENTIALS).
4. Catalog load (≥ 10 products), theme pick + publish (CAP-C12 live path), custom domain optional.
5. Logistics: carrier account link, pickup address, test label + AWB (CAP-C16).
6. Comms: WhatsApp templates live for order lifecycle (SKIP-W7), email sender verified (CAP-C18).
7. **First-order ceremony:** a real ₹-small order placed, captured, ledgered, fulfilled, delivered, and (for M1) refunded — operator watches every hop in the ledger and dashboards. The merchant is live only after their first clean ledger trail.
8. Onboarding evidence row appended (per-merchant checklist stored with the pilot records).

Sequencing rule: M2 does not start until M1's first-order ceremony is clean, M3 not until M2's, etc. Defects found pause intake, not the live merchants.

## 3. SUPPORT PROCESS

- **Channel:** dedicated WhatsApp group per merchant (founder + on-call engineer inside) — dogfoods the wedge channel; fallback email.
- **Coverage:** business-hours human response; out-of-hours paged only by money/availability alerts (Document 4 §3).
- **SLOs:** ack ≤ 2h business hours; money-affecting issue mitigation ≤ 24h; storefront-down mitigation ≤ 4h.
- **Operator surface:** `apps/platform-console` (the signed ops survivor) — KYC review queue, reconciliation mismatch queue (dual-control), support actions. RBAC limits per SKIP-OPS-SSO-IDP state.
- **Standing rule:** support actions that touch money go through the dual-control resolve path, never direct DB writes (the auto-plug stays dead in support too).

## 4. ISSUE TRACKING

One pilot issue register (GitHub Issues, label `pilot`): severity P0 money-wrong / P1 merchant-blocked / P2 degraded / P3 polish. Every issue links the merchant, the ledger/trace evidence, and its fix commit (which itself appends a ledger row and keeps the gate green). P0 protocol = Document 5 §5 (freeze payouts first, diagnose second). Weekly triage; pilot ends with zero open P0/P1.

## 5. FEEDBACK LOOP + OFFBOARDING PROMISE

Weekly 30-min call per merchant (founder-run) + in-app friction notes from M5's mobile usage; synthesis every Friday into: fix-now (pilot scope) vs backlog (post-launch, appended to `CAPABILITY_BACKLOG.md` as named-not-designed rows — the existing discipline). **Offboarding promise (defined before M1 onboards):** any merchant may exit with 48h notice → payouts settled to ₹0 against ledger evidence, catalog + orders + customer data exported (machine-readable), domain released, store archived. A pilot you can't exit cleanly is a hostage program, not a pilot.

## 6. PILOT SUCCESS CRITERIA (Phase F exit, measured over the 21 days)

| # | Criterion | Bar |
|---|---|---|
| F1 | Volume | ≥ 200 total real orders across the 5 merchants |
| F2 | Money integrity | 100% of orders with complete canonical ledger trails; **zero unexplained reconciliation breaks**; invariants I1–I8 green on pilot data |
| F3 | Payouts | ≥ 3 payout cycles per merchant completed on schedule via PA-split |
| F4 | Refunds/COD | ≥ 10 refunds and ≥ 20 COD remittances processed cleanly |
| F5 | Availability | storefront+checkout ≥ 99.5% measured by synthetic checks; zero data-loss incidents |
| F6 | Security | zero cross-tenant incidents; zero step-up bypasses; RT probes stay green in production |
| F7 | Support | SLOs met for ≥ 90% of tickets; zero P0 open > 24h at any point |
| F8 | Merchant verdict | ≥ 4 of 5 would continue past pilot (asked directly); ≥ 3 of 5 rate onboarding ≤ 1 day effort |
| F9 | Mobile reality | M5 ran their store ≥ 80% from mobile without web fallback for core flows |
| F10 | Evidence | per-merchant onboarding checklists + weekly syntheses + issue register archived as the Phase F evidence pack |

All 10 green → Phase G. F2 or F6 red → pilot extends or aborts; they are not waivable.
