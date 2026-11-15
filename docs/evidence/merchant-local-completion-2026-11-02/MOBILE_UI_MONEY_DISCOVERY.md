# Money workspace source discovery — 6 November 2026

Read complete MoneyScreen and all four private tab/shared presentation bodies, complete MoneyService, PayoutStatementDetailSheet, ProviderMode parsing/badge, current route aliases, Home entry and provider registration. This was source review while native40 ran on frozen document1. No money code changes, commands, settlement, collection, reconciliation, provider calls or acceptance were performed.

Money is a real Home/named-route workspace. Feature aliases select Payouts0, Wallet1 or Commission2; COD is the fourth existing tab. These four distinct user tasks share one parent and are nonadditive with route aliases and detail/step-up children. The named management-security routes and inline payout approval ownership remain as previously classified; do not activate retained local management bodies.

| Task | Existing reads/commands | Authority and gaps to preserve |
| --- | --- | --- |
| Payouts | List(limit25), summary/detail, create statement, protected release | Server statement/readback controls state and eligibility. Release already binds a current step-up proof and original serialized SecurityCommandStore operation, validates returned ID/site/status and retains processing intent. Preserve this owner; do not create a payout rail or treat statement creation/processing as bank settlement. |
| Wallet activity | Ledger-backed wallet(limit50) | This is an existing read surface, not authorization to construct a cross-merchant wallet/custody system. Preserve backend ledger authority, units and history population. |
| Commission | Overview(limit50), existing reconcile command | Preserve server schedule and recorded entries. Constitution's permanent0%transaction fee remains binding; reading a UI named Commission authorizes no new fee or commercial rule. Displayed source copy is not evidence a fee was charged. |
| COD | Overview(status=all,limit50), collect/reconcile commands | Preserve expected/collected/deposited amounts, exact order/entry identity and current server control. Missing values/statuses cannot supply a command amount or grant eligibility. No delivery or remittance/provider acceptance is inferred from UI. |

## Frontend candidates requiring reproduction

Parent `_load` starts all four panel reads even if only one tab is visible, isolates each panel failure and uses mounted-only settlement. The persistent service owns global last-read maps. Parent guards selected-store ID but not full actor/selection-generation identity. A-B-A, same-site actor replacement, late read/result, refresh/error retention, covered actions and denied views need real composed tests. Preserve valid partial panels without making an old map the current actor's authority. A selected-tab/read budget and retained-tab invalidation can be presentation changes; inventing another ledger/cache/session owner is forbidden.

The parent uses default AppBar/TabBar, several fixed horizontal amount/action Rows and local summary/record/empty styles. Long full references, exact amounts, warnings, status/provider labels, large text, short windows and keyboard/step-up return need canonical composition and actual platform testing. Current provider mode for every tab comes from the payout summary; absence hides it. Do not fabricate mode or carry another panel's mode over a failed current read.

Money minor formatting and `_intValue` helpers default missing input to0; status defaults include pending/posted. Preserve all original domain calculations/helpers and add explicit response-presence admission before display/action where authorized. Do not convert unknown to a recorded zero or default eligibility. Precision/currency/arithmetic behavior requires separate appropriate authority and tests; this UI task cannot silently rewrite financial calculations.

Create-statement catch currently reports no eligible paid orders for every error; reconcile-commission fallback count is0. Distinguish unavailable/denied/uncertain from an evidenced business result. These are source observations, not reproduced current provider outcomes. Non-release commands generate their original operation key inside the service and expose no external durable recovery handle; do not introduce one or replay commands under frontend scope. Payout release's existing durable identity is protected.

The payout detail child keeps its initial Future, has no explicit retry/Close, defaults malformed minor values to0 and does not itself fence actor/store/route identity. Its complete source and original exact minor-string formatter were already reviewed in Supporting discovery. Extend the canonical detail presentation and presence/current-owner guards while preserving original calculation, provider reference, source lineage and the rule that lineage does not determine payout eligibility.

## Acceptance still required

Reproduce scoped/held/error/unknown/callback cases; preserve command and security/store/backend bytes; test meaningful positive reads and confirmations, not fabricated empty success. Relevant full money/tenancy/auth rigor, real owned database reconciliation and provider sandbox evidence remain separate from widget/compile gates. No money feature is accepted by this source audit, and native40's warehouse scope adds no money acceptance.
