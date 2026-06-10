# 12. Operational Risk Assessment

What happens to LetBuyy at each merchant scale with current internal systems. Assumes typical SaaS-commerce ratios: ~5% of merchants generate a support contact weekly; ~0.5–1% of payment volume generates disputes; review submissions scale with partner ecosystem growth.

## 100 Merchants — Painful but survivable
- ~5 support contacts/week land in personal email. A founder answers from SQL. Slow, unmeasured, but possible.
- Suspensions/refund escalations: handful per month, via raw API. The lack of reason capture and appeals creates merchant-trust incidents but not existential ones.
- Marketplace: near-zero external submissions; the single review queue suffices.
- Finance: payouts reconcilable by hand in a spreadsheet monthly.
- **Binding constraint:** founder attention. Risk level: MODERATE.

## 1,000 Merchants — Systems break
- ~50 support contacts/week with no intake, no dedup, no history. Email triage collapses; response times go to days; churn begins among paying merchants ("frozen" trial logic still doesn't exist, so billing leakage also accrues — expired trials keep running free).
- First real fraud arrives (fake stores, stolen-card testing through checkout, COD abuse). **No fraud system exists**; detection happens via payment-provider complaints or bank notices. Cashfree/Razorpay can withhold settlement or offboard the platform if dispute ratios spike — an existential counterparty risk with no internal dispute tooling to respond.
- Hiring becomes mandatory but the platform can't onboard staff: invite emails unsent, permissions unenforced, and the ops portal accepts any merchant session — **adding employees without fixing auth widens the attack surface instead of capacity**.
- Reviewer load (apps/themes) reaches dozens/month; blind approvals (no code inspection) make the first malicious app/theme statistically likely.
- Risk level: SEVERE. Failure mode: reputational spiral + payment-partner sanctions.

## 10,000 Merchants — Not operable
- ~500 support contacts/week ≈ 10–15 agents needed; no system exists for them. Hiring agents without ticketing yields negative productivity (shared inboxes, double replies, lost cases).
- Compliance becomes legally binding in practice: DPDP/GDPR data-subject requests arrive at volume; **no DSR pipeline** means each is a manual engineering task with statutory deadlines (India DPDP Act penalties scale to ₹250 crore). App compliance webhooks (`customers/redact` etc.) exist as contract strings with no enforcement loop — platform cannot prove downstream deletion.
- Trust & Safety: counterfeit/prohibited-goods stores appear daily. No cases, no graduated enforcement, no appeal → suspensions are arbitrary super-admin status flips; wrongful-suspension disputes have no record to adjudicate.
- Finance: partner payouts (80% rev-share ledger) at thousands of entries/month with `rail='manual'` and no release workflow → partner trust collapse or uncontrolled manual bank operations (fraud/error exposure with no two-person rule).
- Incident response: real traffic incidents now page no one (notification-service is reserved; incident API has no alerting). MTTR measured in "whenever someone notices."
- Risk level: CRITICAL. The company cannot honor its merchant, partner, or regulatory obligations.

## 100,000 Merchants — Hypothetical
The platform's *runtime* substrate (partitioned tables, queues, replay, multi-region governance docs) is the part engineered for this scale; the *human* substrate is absent. At this scale every missing system is a daily catastrophe: ~5,000 support contacts/week, hundreds of fraud cases/day, thousands of DSRs/year, full-time review staff with no tooling, and a payout operation moving crores monthly through manual rails. No staffing plan can compensate — headcount without systems just multiplies unaudited super-admin access. Risk level: NOT REACHABLE with current internals.

## Risk Register (top items, ordered by severity × proximity)

| # | Risk | Likelihood | Impact | Evidence anchor |
|---|---|---|---|---|
| 1 | Ops portal accessible with merchant session (employee surfaces unauthenticated) | Certain (latent now) | High — data exposure, governance breach | portal `api/client.ts`, login TODO |
| 2 | No support intake → silent churn + reputational damage at any growth | Certain by ~1k | High | `employee.ts:313` (501) |
| 3 | Payment-partner sanctions from unmanaged fraud/disputes | High by ~1k | Existential | no fraud/dispute tables |
| 4 | Trial/dunning enforcement absent → revenue leakage | Certain now | Medium-High | no transition job for `trial_status`/`frozen` |
| 5 | Blind marketplace approvals admit malicious app/theme | Medium-High | High (tenant-wide XSS/data theft) | no static analysis/preview (reports 4–5) |
| 6 | DSR/compliance non-response at volume | High by ~10k | High (statutory) | no DSR pipeline |
| 7 | Manual payout rails without approval workflow | High | High (financial error/fraud) | `partner_payout_ledger_entries.rail='manual'`, no release API |
| 8 | Suspension without case/reason/appeal → wrongful-suspension disputes | Medium | Medium-High | `admin.ts:104` (status flip only) |
| 9 | Single-tier super-admin = insider/compromise blast radius is total | Medium | High | report 9 |
| 10 | Incidents page no one | Certain on first incident | Medium-High | reserved notification-service |

## Conclusion
Current internals support a low-hundreds merchant count operated personally by founders. Every order of magnitude multiplies workload into systems that don't exist; the first hard wall is not technical scale but **counterparty and regulatory obligations (payments, privacy) that demand workflows, evidence, and auditability the platform cannot produce.**
