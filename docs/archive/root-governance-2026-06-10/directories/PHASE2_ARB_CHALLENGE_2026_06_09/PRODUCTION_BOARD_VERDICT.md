# PRODUCTION_BOARD_VERDICT

**Question put to the board:** can LetBuyy *safely* onboard 10 / 100 / 500 / 1,000 merchants **today** (as of 2026-06-09, current working tree)?

## Verdict
| Merchants today | Verdict | The binding reason |
|---|---|---|
| **10** | **NO** (for any merchant paid real money) | Money cannot move truthfully + no balance check + no backups. A 10-merchant *design-partner pilot* with money operated manually **outside** the system is the only safe form. |
| **100** | **NO** | All of the above + observability blindness + outbox backlog begins. |
| **500** | **NO** | + Supabase connection pressure (Hyperdrive unused) + no search (full-table scans). |
| **1,000** | **NO** | + every scale ceiling stacks (outbox 4,800/day, products index gap). |

There is no tier at which the platform can *today* safely custody the merchant relationship for real money. This is **not** a verdict that the platform is far away — the P0 set is bounded (see master plan) — but it is an unambiguous **NO for today**.

## For every NO — why / impact / fix / complexity / owner

| Blocker | Why it blocks | Impact if onboarded anyway | Fix | Complexity | Owner |
|---|---|---|---|---|---|
| **Spendable balance from mutable table, not ledger** (`wallet.ts:66-92`) | Truth source is freely UPDATE-able | Balances can be wrong/edited; payouts on false balances | Point balance reads at canonical ledger; invariant test wallet-sum = ledger | M | Money |
| **Payout release: no lock + no balance check + double-initiate race** (`payouts.ts:505-521`) | Can release unfunded or twice | Merchant over/under-paid; LetBuyy loses money | `FOR UPDATE` + balance gate + idempotency key + state guard | M | Money |
| **Refunds post nothing to ledger** (`payments.ts:763-855`) | Refund truth lost; partial refund corrupts | Books diverge; disputes unresolvable | Post refund to `refund_clearing`; fix partial-refund state | M | Money |
| **No continuous backup / PITR** (`production-deploy.yml:234-237`) | One bad migration/incident = unbounded loss | Catastrophic, irreversible | Supabase PITR + tested restore drill | M | Platform (needs tier — HUMAN) |
| **Rate limiting fails open** (`rateLimit.ts:884-888`) | Missing secret silently disables all limits | Auth brute-force, checkout/API abuse | Fail-closed + deploy preflight asserts limiter live | S | Security |
| **Mobile login blocked on prod** (Turnstile placeholder) | 100% of mobile usage blocked | Merchants can’t log in on the primary app | Replace Turnstile config | M | Identity (needs cfg — HUMAN) |
| **Internal-header identity forgery** (`auth.ts:96-128`, shared secret) | Secret compromise = total impersonation | Account takeover, money theft | Isolate/rotate secret; move to signed tokens; lock the gateway (mTLS/allowlist) | L | Security |
| **Maker-checker on wrong table** (`payouts.ts` vs orphan `payouts` 151) | Live payout has no dual-control | Single actor moves money | Attach approval to `payout_statements` release | M | Money/Ops |
| **Default `mock` payment mode** (`payments.ts:130`) | Orders marked paid with no money | Fake fulfillment, chargebacks | No `mock` default; reject in prod | S | Money |
| **`integer` money columns** (`migrations/119`) | Overflow at ₹21.47M/row | Silent financial corruption | Migrate to `bigint` (after backups) | S | DB |
| **Observability undeployed** | Blind in production | Incidents undiagnosable | Deploy metrics/logs/traces/alerts + error tracker | M | Platform |
| **Outbox capped ~4,800 events/day** (15-min cron) | `order.paid`→WhatsApp/notify backlogs | Customers/merchants miss notifications | Queue-driven drain or sub-minute cron | S | Platform |
| **No search; products index gap** (`baseline:18056-18070`) | Full-table scans at 500+ | Slow catalog, DB pressure | Composite index now; search service later | S→L | DB/Platform |
| **Supabase connection model** (Hyperdrive bound, unused) | REST/HTTP per invocation | Connection exhaustion at 500+ | Use Hyperdrive pooling for the SQL path | M | Platform |

## The conditional YES (what unlocks each tier)
- **After Q1 P0s** (money-logic fixes + backups + rate-limit fail-closed + mobile login + secret isolation): **10–50 controlled beta merchants — YES**, with PA sandbox→live and manual payout approval.
- **After Q2** (observability, server checkout, MFA, verify-not-assert, WhatsApp, outbox uncap): **100–500 — YES**.
- **After Q3** (Hyperdrive pooling, search, auth consolidation): **1,000 — YES**; 10k needs the deferred services + read replicas.

**Board recommendation:** **Do not onboard revenue-bearing merchants today.** Run a ≤10 design-partner pilot with money handled manually and out-of-band, while Q1 P0s land. Re-convene the board at Q1 exit with the money-reconciliation and restore-drill evidence as the gate.
