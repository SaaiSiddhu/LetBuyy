# LetBuyy Console feature priorities — 22 October 2026

Research and recommendations, not authorization to implement or release. Reviewed the current dirty `develop` checkout at `118209b4fde1b5a15313f4741bcac454690d15c8`, current Console/Gateway source and recent merchant-control/readiness verification reports. External primary documentation was checked on 22 October 2026. This is a source-backed capability assessment, not a new exhaustive runtime or security certification.

The Console should help a small team find a merchant problem, understand evidence, take a permitted action and confirm the result. Complete existing canonical workflows first. Use the existing Console, monolith and satellites within the India 100–10,000 merchant envelope; this memo creates no new architecture or programme authority.

## Already present: extend these owners

- Merchant 360, store/owner/billing context, recent audit, read-only assistance and independently approved suspension/restoration: `apps/internal/console/src/app/(dashboard)/merchants/[id]/page.tsx`.
- Searchable merchant catalog and original order snapshots; effective SaaS access/limits; bounded KYC status and usage; common seven-check store health: `apps/internal/console/src/app/(dashboard)/merchants/[id]/operations/page.tsx`. Existing verification is recorded in `MERCHANT_CONTROL_E2E_2026-10-21.md` and `MERCHANT_READINESS_HEALTH_2026-10-21.md`.
- Merchant/Console support conversations, public/internal visibility, resolution and original-command recovery: `apps/internal/console/src/app/(dashboard)/support/support-desk.tsx` and the canonical support routes.
- Permission administration, emergency grants, access reviews, approvals, audit, incidents, compliance and ledger reconciliation have existing surfaces. Their existence is not a claim that every integration/provider/release dependency is complete.

## Ranked recommendations

Ranking is LetBuyy-specific engineering judgment based on merchant impact, current implementation gaps and the opportunity to reuse existing contracts. It is not a vendor-prescribed universal ranking.

### 1. Finish support ownership and response deadlines

**Current evidence:** Gateway support already accepts status/priority/assignee filters, has an assignment command and returns SLA clocks. The active Console support view primarily exposes text search, conversation, reply/internal note and resolution. Source: `services/api-gateway/src/routes/operations/support.ts:241`, `:332`, `:363`; `apps/internal/console/src/app/(dashboard)/support/support-desk.tsx`.

**Add/finish:** assignee and priority controls; My tickets, Unassigned and Overdue views; first-response and resolution due times; clear waiting-for-merchant state; escalation ownership. Reuse the existing clocks and assignment route rather than create a second ticket engine.

**Why:** a merchant can already contact LetBuyy, but the team needs to know who must respond and which request is becoming urgent. Zendesk distinguishes first public response, resolution targets and calendar/business-hour measurement; LetBuyy should explicitly define its own clock semantics. [Zendesk reply-time and SLA documentation](https://support.zendesk.com/hc/en-us/articles/4408821871642-Understanding-ticket-reply-time).

**Done when:** assignment persists and appears on reload; scoped filters match server results; internal notes do not count as a public merchant response; pause/resume and reopened-ticket behavior are verified; unauthorized operators cannot assign or escalate; any automatic notification has an independently visible delivery result. Commercial response targets/business hours need owner agreement, not invented defaults.

### 2. Complete the SaaS billing operations workspace

**Current evidence:** the active subscription page is a paginated read-only list and explicitly says invoice download, plan changes, cancellation and retry need audited backend commands. Source: `apps/internal/console/src/app/(dashboard)/subscriptions/page.tsx:142`. Merchant operations already reads effective SaaS access and limits; it is not a plan-granting writer.

**Add/finish:** per-site invoice/payment history, latest provider state, outstanding balance and next renewal; a failed-renewal queue; provider-supported payment recovery; effective-dated plan/cancellation actions only after their canonical commands and policies are ready. Clearly distinguish a subscription, a payment and an entitlement. Keep merchant SaaS fees separate from buyer order payments.

**Why:** staff must investigate “I paid, but my store still has limited access.” Razorpay documents failed renewals moving through pending/halted states and provider-specific recovery. [Razorpay subscription payment retries](https://razorpay.com/docs/payments/subscriptions/payment-retries/). Stripe independently documents failed-payment analysis and recovery as a subscription operations capability; this is a product benchmark, not a proposal to add Stripe. [Stripe revenue recovery](https://docs.stripe.com/billing/revenue-recovery).

**Done when:** provider/ledger evidence ties to the exact site and invoice; pending is never shown as paid; repeated recovery cannot charge twice; the existing entitlement authority supplies access; cancellation timing, grace, refunds and exceptional grants have explicit approved policies; consequential commands leave a durable audited result.

### 3. Make platform and integration health actionable

**Current evidence:** Operations displays runtime/queue/deployment summaries; Settings shows configured bindings/secrets as booleans. Generic runtime commands are explicitly unavailable. Sources: `apps/internal/console/src/app/(dashboard)/operations/page.tsx:410`, `:592`; `apps/internal/console/src/app/(dashboard)/settings/page.tsx`.

**Add/finish:** current status and last successful check for Identity, Gateway, database, workers, payment callbacks and lifecycle-notification delivery; checked-at/freshness, affected merchant count where provable, trace/reference and a specific recovery procedure. Merchant health already checks theme/domain/payment configuration; connect those existing diagnostics instead of recalculate readiness in the Console.

**Why:** the recent local sign-in issue showed that a rendered login page does not establish a working authentication dependency chain. This is evidence of a local tooling/dependency problem, not evidence that production is down. Operational availability checks and business-readiness checks need separate labels.

**Done when:** stopped/unreachable, stale and unknown are distinguishable; missing evidence cannot become healthy; login failures have a useful sanitized explanation/reference; diagnostics expose no keys, tokens or private documents. Build on simple existing health readers; do not extend rejected projection infrastructure or expose unrestricted server restart buttons.

### 4. Add bounded delivery-failure investigation and recovery

**Current evidence:** queue depth/retry/dead-letter counts exist, but generic runtime controls are withheld pending an integrated execution owner. Saving a support reply explicitly does not prove notification delivery.

**Add/finish:** inspect the specific failed webhook/job/lifecycle notification, merchant context, attempts, last error, last success and outcome. Provide a finite retry only for a command whose canonical executor supports it; otherwise show the existing recovery procedure or provider-dashboard link.

**Why:** Cloudflare documents retry and dead-letter behavior, so aggregate counts alone are insufficient to investigate a stuck item. [Cloudflare retries](https://developers.cloudflare.com/queues/configuration/batching-retries/) and [dead-letter queues](https://developers.cloudflare.com/queues/configuration/dead-letter-queues/). Razorpay documents duplicate and out-of-order webhooks; recovery must preserve idempotency and current state. [Razorpay webhook best practices](https://razorpay.com/docs/webhooks/best-practices/).

**Done when:** a retry is authorized, bounded, audited and reconciled to its original operation; double-click/repeated delivery creates one business effect; confirmed delivery is distinguishable from accepted/queued/unknown. Use existing outbox/worker/provider ownership, not a new bus or replay engine. WhatsApp stays within its approved lifecycle/COD-confirm scope.

### 5. Extend money investigation around the existing reconciliation queue

**Current evidence:** the Console already has a canonical ledger break-resolution queue with approval-backed review and a variance-zero verification boundary. Source: `apps/internal/console/src/app/(dashboard)/money-reconciliation/page.tsx`. This is not a missing reconciliation system.

**Add/finish:** navigate from a merchant/order/provider reference to its payment, refund/dispute record, ledger evidence, reconciliation break, case owner and existing approval/result. A refund or dispute action appears only when the canonical provider-backed contract and permission exist; otherwise provide investigation and a provider handoff.

**Why:** operators need to answer “payment succeeded but the order is pending” or “where is the refund?” without guessing or altering historical orders.

**Done when:** money states remain separate; the original order snapshot stays intact; external outcome is verified before success; review cannot manufacture a balanced result. No manual paid checkbox, editable ledger, arbitrary provider transfer or LetBuyy custody of merchant money.

### 6. Search actual records from the top bar

**Current evidence:** the top finder filters a local array of workspace labels/groups. Source: `apps/internal/console/src/components/ConsoleShell.tsx:81`. Merchant, catalog and ticket pages already have some individual search flows; universal record lookup is distinct.

**Add/finish:** a permission-filtered finder for store name/subdomain/stable ID, allowed merchant identity fields, order number, ticket reference and authorized payment reference. Show the store context and a direct record link. Start with exact/reference matching and bounded server search.

**Why:** support commonly starts from a reference supplied by a merchant, not from knowledge of the Console menu.

**Done when:** search covers authorized matches beyond the loaded page; pagination is bounded; a denied record is not discoverable through snippets/counts; buyer data is minimized. Use existing Gateway/Postgres capabilities; the reserved search service remains empty.

### 7. Build a merchant attention inbox from existing evidence

**Current evidence:** the overview has queue links and rollup counts; the detailed readiness checklist is per merchant. Sources: `apps/internal/console/src/app/(dashboard)/dashboard/page.tsx`, merchant operations and shared Store Health.

**Add/finish:** cross-merchant views for incomplete setup, unpaid renewal, overdue support, pending review and unknown/stale readiness. Each row has a merchant, issue, age, owner, evidence timestamp and next permitted action. Persist useful filters/sort rather than introduce speculative risk scores.

**Why:** gives the small operations team an answer to “which merchants need us today?” Reuse the current task owners; the inbox is navigation/triage, not a second workflow engine or new gate blocking merchants.

**Done when:** each row opens the matching filtered evidence; counts/populations and freshness agree; completing the underlying action updates the inbox; unavailable sources cannot silently disappear as zero issues.

### 8. Extend Merchant 360 with a connected activity timeline

**Current evidence:** Merchant 360 already has a Recent Audit panel. Source: `apps/internal/console/src/app/(dashboard)/merchants/[id]/page.tsx:206`. A new Merchant 360 page is unnecessary.

**Add/finish:** one paginated chronological view linking relevant billing, setup/publication, support, approval and restriction changes with actor, time, reason and confirmed outcome. Reuse canonical records and audit; do not create an event store.

**Why:** staff should understand what happened before taking another action. OWASP recommends attributable operational/security logging while excluding credentials, tokens and unnecessary sensitive information. [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

**Done when:** record links retain exact merchant scope; access is audited; records cannot be silently rewritten through a presentation action; time/order and pagination are stable; private support content is disclosed only to permitted viewers.

## Delivery order and acceptance boundaries

1. **First bounded implementation:** support assignment, priority, existing SLA visibility and task filters. It reuses the strongest existing contract surface and has a clear merchant-facing result.
2. **Next:** billing investigation/invoices/renewal failures, then policy-approved lifecycle commands. Safe exception handling and provider evidence are prerequisites to any financial action.
3. **Before broader merchant rollout:** fresh dependency health, typed delivery/job recovery and complete money-case investigation around existing ledger/approval authority.
4. **Then operational efficiency:** cross-record lookup, merchant attention inbox and the connected timeline, built on reliable source queries.

Existing MFA, live authorization, independent approvals and audit remain cross-cutting requirements. Permission checks belong on every relevant server request, with minimum necessary privilege, rather than only hiding buttons. [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

Each feature needs a normal permitted journey, denied actor/foreign-scope cases, stale/missing-source states, interrupted-action reconciliation and durable readback. Money and authentication additionally retain their current higher-rigor gates. Provider-sandbox, hosted, device and broader release acceptance are separate evidence; source presence or local green tests do not close them. Earlier reports still record controlled support migration/hosted acceptance as pending; this research did not apply a migration or certify those gates.

No prices, grace periods, SLA promises, refund policies or approval permissions are established by this memo. It is input to the existing foundation programme, not a replacement roadmap. No application code, environment configuration, database, provider or deployment was changed during this research pass.
