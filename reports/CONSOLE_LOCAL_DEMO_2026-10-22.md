# Console feature locations and local demo — 22 October 2026

The owner requested a map of the recent features and visible sample data because the Console looked unchanged. The recent work extends existing workspaces. Read-only preflight found zero local stores, orders, support tickets, invoices and announcements; those screens had consequently been empty. This delivery adds labelled local DEMO records to the real canonical readers, without changing application UI, authentication or money authority.

**Start here: [all three DEMO merchants](http://localhost:9007/merchants?q=DEMO).** Merchant profiles opens a search form until a query is entered; searching `DEMO` reveals the three sample profiles and their Operations workspace links. This is the page left open in the owner's signed-in browser. Store directory provides the separate paginated browsing entry.

## Where to find the changes

| Feature | Console location and working local example |
|---|---|
| Merchant account overview and protected controls | **Merchants → Merchant profiles → open a merchant**. [Demo Lotus Apparel](http://localhost:9007/merchants/de202610-2200-4000-8000-000000000201). Suspend/restore requests continue through the existing independent-approval workflow; no fake reviewer or approval was added. |
| Searchable catalog and protected historical orders | Open **merchant operations: catalog, orders and SaaS limits** from the merchant profile. [Demo operations](http://localhost:9007/merchants/de202610-2200-4000-8000-000000000201/operations), then **Products / Orders** under Commerce evidence. Scroll within the workspace to the table. |
| Store setup, actual theme release evidence, SaaS access/limits | The same [merchant operations](http://localhost:9007/merchants/de202610-2200-4000-8000-000000000201/operations) page, above Commerce evidence. Demo Apparel has4/7 checks complete, with shipping, actual published theme and store publication still needing attention. No publication or provider readiness was fabricated. |
| Site-specific SaaS billing investigation and record summaries | **Finance → Subscriptions**, or **Open billing investigation** inside a merchant profile. [Demo Lotus Home billing](http://localhost:9007/merchants/de202610-2200-4000-8000-000000000202/billing). Its past-due Growth subscription, effective free access and failed unpaid sample invoice remain distinct. |
| Support owner/priority, SLA and public/internal conversations | **Support → select a ticket**. [Urgent sample conversation](http://localhost:9007/support?ticket=de202610-2200-4000-8000-000000000702). Queue view offers All/My/Unassigned/Overdue. The sample has an overdue resolution clock and an internal-only note. Owner selection uses real current platform staff; no fake staff access was created. |
| Campaigns, offers, regulations and product notices | **Merchant messages** in the main rail. [Sample regulation notice](http://localhost:9007/merchant-messages?message=de202610-2200-4000-8000-000000000803) → **Inspect publication** shows2 DEMO recipients and1 sample read. The fourth message is an editable selected-DEMO-account draft. |
| Approval requests, operational recovery and fresh dependency evidence | [Approvals](http://localhost:9007/approvals), **Operations** and [Settings](http://localhost:9007/settings). These retain their real guards; no approval or provider-health success was fabricated for a demo. |
| Merchant recipient surface | Merchant web **Account inbox**, both `/inbox` before store selection and `/:store/inbox` inside a store; mobile uses its existing notification screen labelled **Account inbox**. The inserted inbox copies belong only to separate, credential-less DEMO owners. No real account received a sample notice. |

## Installed samples

| Records | Count / example |
|---|---|
| Credential-less fake owners |2, using `example.invalid`; no verified email, password, principal or role grant |
| Stores |3: **DEMO — Lotus Apparel**, **DEMO — Lotus Home**, **DEMO — Nilgiri Crafts**; all unpublished and preview-only |
| Products |6 active/draft items across the three stores |
| Orders |2 pending COD orders created through the canonical checkout RPC with the correct store GUC |
| Subscription states |3 trialing/past-due examples; amount paid remains0 |
| Invoice/history examples |2 unpaid examples using current persisted plan prices; no provider reference or paid ledger proof |
| Support |3 tickets,4 conversation messages and4 clocks showing running/overdue/paused states |
| Merchant messages |3 explicitly fictional published-history examples plus1 draft;6 recipient copies, all belonging to the two DEMO owners |

The catalog/order comparison is intentional: the current **DEMO — Cotton Tee (new catalog name)** costs₹549, while its placed order retains **DEMO — Classic Cotton Tee** at₹499. The old order and item snapshot were never hand-edited. No new advertising campaign, offer, legal obligation, provider transaction or real merchant publication is asserted by the example text.

Sample publication history is fixture-seeded into the restricted canonical tables and obeys the content guard. It is not evidence of a new normal operator publication or a fabricated command receipt. Normal draft/review/publish/recovery behavior remains covered by the earlier owned inbox acceptance. Live Console inspection in this delivery verifies that the seeded samples are rendered by the actual authenticated application.

## Verification and repeatability

Manual local runner: `node scripts/dev/seed-console-demo.mjs --check` validates the whole transaction and rolls back; `--apply` installs it. It is pinned to `supabase_db_letbuyy-web-local-20261021`, expects migration372 and the original non-superuser owner over the Docker-local socket, checks namespace collisions and enabled guards, and never accepts a remote URL. Existing rows use `ON CONFLICT DO NOTHING`; order creation is conditional on the stable canonical checkout idempotency key. Repeating the check after installation reports0 inserted rows throughout and unchanged counts, then rolls back. Existing business data is not overwritten. Protected order/audit/inbox history remains subject to normal retention; do not hard-delete it as cleanup.

The successful dry run, installation and idempotency check pass. Postflight proves exact counts, no paid orders/subscriptions, no public demo stores, no DEMO principal grants, no non-demo inbox recipient, original order499 versus catalog549, `postgres.rolsuper=false` and enabled event/tax/content guards. Initial invalid trial vocabulary, missing per-store checkout GUC and a support-column/author mismatch were corrected to the actual schema; each failed attempt rolled back. No guard was weakened. The read-only snapshot probe was corrected from an assumed column name to the actual canonical JSON row shape.

Normal signed-in browser checks verified the populated announcements and recipient/read review; support queue/conversation with overdue SLA/internal note; merchant operations/catalog/limits/setup and original order details; Lotus Home's billing/access/payment separation; and the actual Merchant 360 protected controls and all three DEMO search results. The session expired during the walkthrough and was renewed through the existing local-development magic proof and real configured TOTP. No email was sent, and no account, factor or privilege was provisioned. Screenshots remain private at `/private/tmp/letbuyy-console-demo-20261022/` and can be shown to the owner.

Node syntax and whitespace checks pass. The full governance lane ran in an isolated current-source snapshot to keep generated-artifact cleanup away from the running development apps:110 PASS,4 FAIL,0 BLOCKED/SKIP and1 not applicable. The red results are existing route-ownership recognition, untracked migrations370–372, unclassified postgres-only372 custody policies, and dependency symlinks rejected by the snapshot's artifact gate. The first three reference source already present in this task's starting dirty tree; the fourth is a verification-method limitation. No result was waived or validator changed. This is not a merge/deploy-green claim. No web/native build was repeated because this delivery changes only the manual local seed/runner, not runtime source.

All274 pre-existing dirty files were byte-unchanged before continuity updates. No source reset, staging, commit, push, merge, hosted deployment or parent-programme acceptance occurred. [Structured receipt](CONSOLE_LOCAL_DEMO_2026-10-22.json) · [Sanitized seed/postflight/governance evidence](../docs/evidence/console-local-demo-2026-10-22/).
