# 11. Enterprise SaaS UI/UX Research Report

Patterns extracted (not copied) from Shopify Admin, Stripe Dashboard, Atlassian Admin, Linear, HubSpot, Zendesk, Intercom, and Salesforce, for adaptation to LetBuyy's internal tooling. Verified against current (2025–26) vendor documentation; sources at end.

## Product Observations (condensed)

- **Shopify Admin** — object-noun sidebar (Orders/Products/Customers) with Settings isolated; pinnable apps/channels; Cmd+K global search with AI (Sidekick) fallback; Polaris IndexTable + IndexFilters where **tabs are saved views**; collaborator access-request approval flow; merchant-visible Store activity log where apps and "Shopify" itself are first-class actors.
- **Stripe Dashboard** — business-noun nav + Workbench developer overlay (`~` key); Organizations layer above accounts; **Radar review queues** are the reference review console: signal-dense list, claim/assignment with visibility, J/K traversal, risk-insight explanations, related-payment entity links, small closed set of terminal actions (approve/refund/refund-and-report) that feed block lists; append-only payment timeline on detail pages.
- **Atlassian Admin** — separate admin product (admin.atlassian.com); org-level user directory hoisted above sites/products; explicit org-admin vs site-admin matrices; audit log with actor/app/IP, plan-gated retention, SIEM export; access requests as a dashboard queue widget.
- **Linear** — keyboard-first grammar (`G then X`, J/K, four invocation paths per action); contextual Cmd+K ranking; **Triage** as the reference intake queue: rotation-based "goalie" responsibility, AI suggestions (dupes/labels/assignee) with human confirm, deterministic triage rules (tier→urgency→SLA), snooze-until-time-or-activity; closed-loop CX integration (support thread auto-reopens when the linked issue ships).
- **HubSpot** — role-scoped **workspaces** over shared CRM data (Help Desk workspace, Customer Success workspace); configurable weighted health scores showing band + recent delta; manager portfolio roll-ups (health distribution, usage, renewals, ticket volume).
- **Zendesk** — three-pane Agent Workspace (properties | conversation | context panel); one composer with public-reply vs internal-note toggle; macros filtered contextually; **SLA breach countdown as a sortable badge column**; side conversations; "light agent" (comment-only) role for SMEs.
- **Intercom** — inbox-centric layout; AI copilot in the context sidebar with source citations and one-click insert (never auto-send); J/K/R/E email-triage keys; AI topic clustering for "what are customers contacting us about."
- **Salesforce** — Service Console multi-tab + split view for queue grinding; utility bar (macros, notes, omni-channel presence); push-routing by capacity/skill; Setup as a separate config surface with Quick Find; approval pattern = submit action on entity + approval-history on entity + cross-entity Items-to-Approve queue with bulk actions.
- **Supplementary (ops-specific):** Pigment's guardrailed impersonation (read-only-by-default JWT, 30-min expiry, dual-identity audit visible to the customer, persistent visual frame, informative 403s); Pinterest Pinqueue moderation platform (queues-as-config JSON, review widgets + action widget, per-reviewer decision history for QA, wellbeing modes); LaunchDarkly env-scoped flag-change approvals; incident.io/PagerDuty timeline-centric incident pages.

## Pattern Library → LetBuyy Application

| # | Pattern | Exemplars | LetBuyy application |
|---|---|---|---|
| 1 | Object-noun sidebar, Settings isolated | Shopify, Stripe, Atlassian | Console nav: Merchants, Orders, Apps, Themes, Reviews, Cases, Payouts; config under Settings |
| 2 | Cmd+K palette, contextual ranking, AI fallback | Linear, Shopify, Stripe | Single palette across console + ops portal; entities: store, user, order, app, theme, employee |
| 3 | Composable keyboard grammar (G-x, J/K, single-key actions) | Linear, Radar, Intercom | Review queue + future support queue throughput |
| 4 | Tabs-as-saved-views index tables, bulk-select bar | Shopify Polaris | Replace ad-hoc tables in `/stores`, `/users`, review queue |
| 5 | Entity detail anatomy: header + status badge + actions + tabs + activity timeline | Stripe, Zendesk, Shopify | Merchant 360 page; review detail page; `audit_logs` already supplies the timeline data |
| 6 | Three-pane work surface (queue | item | context) | Zendesk, Intercom, Salesforce | Review console and future support workspace |
| 7 | Customer-context sidebar | Zendesk, Intercom | Merchant context (plan, health, GMV, recent audit events) beside any case/review |
| 8 | Public reply vs internal note, one composer; light-agent role | Zendesk | Future ticketing; comment-only role for engineers on merchant cases |
| 9 | Contextual macros/action bundles | Zendesk, Salesforce | Canned decisions + reason templates in review queue |
| 10 | SLA countdown badge, sortable | Zendesk, HubSpot | Review queue first (submission SLA), then tickets |
| 11 | Review triad: dense list → explainable detail → closed terminal actions feeding automation | Stripe Radar, Pinqueue | App/theme review; future fraud queue over `payment_transactions` |
| 12 | Claim/assignment with visibility + rotation | Radar, Linear triage | `marketplace_review_records` lacks `assigned_to` — pattern defines the need |
| 13 | Triage inbox: AI suggest + rules + snooze | Linear | Merchant-report and escalation intake |
| 14 | Closed-loop support↔work-tracker (auto-reopen on fix) | Linear CX | When ticketing lands, wire to engineering tracker |
| 15 | Account-360 with trending health score + portfolio roll-up | HubSpot CS | Ops portal already computes scores — add trend, owner, actions |
| 16 | Role-scoped workspaces over shared data | HubSpot, Zendesk, Salesforce | Keep console (operators) vs portal (employees) split, but same API + per-role cockpits instead of duplicated pages |
| 17 | Approval triad: submit action + history-on-entity + Items-to-Approve queue; env-scoped config approvals | Salesforce, LaunchDarkly, Shopify collaborators | Payout release, suspension, flag changes (`operational_feature_flags` already has `approved` status awaiting this) |
| 18 | Guardrailed impersonation: read-only default, expiry, dual-identity audit, visible frame, revocable | Pigment, PropelAuth | Highest-value missing support tool; design before building support platform |
| 19 | Append-only audit log UI: filters, drawer detail, prev/next, export, retention tiers; merchant-visible mirror | Atlassian, Shopify activity log | Console `/audit-logs` is close — add drawer, export, reason field; expose merchant-visible subset |
| 20 | Self-serve queue/console config (queues-as-data, per-queue metrics, item passing, wellbeing modes) | Pinterest Pinqueue | Long-term: one queue platform serving review/fraud/T&S instead of three bespoke consoles |

## Adaptation to LetBuyy Design Language

- Build on the existing `@letbuyy/ui` package (`packages/typescript/ui`) — Button/Input/DataTable are the extraction point; the saved-views table (pattern 4) should become the canonical `DataTable` evolution rather than per-app tables.
- Existing internal pages already use Tailwind tokens with dark-mode variants and status-badge color conventions (emerald=passed, red=failed, amber=pending — see `badgeClass()` in `platform-operations-portal/src/app/(dashboard)/operations/page.tsx`). Extend this exact badge taxonomy to lifecycle states (published/suspended/frozen) for consistency.
- Locale: internal tools already format `en-IN` dates and INR minor units (`amount_minor`, paise) — keep en-IN/INR as first-class in all ops surfaces, with explicit currency columns (USD fields exist on theme purchases).
- Actor model alignment: patterns 16/18/19 must respect `docs/governance/actor-governance.md` (operators vs employees, MFA, audit events) — the console already implements the strong half; the portal must be brought up to it before any new employee surface ships.

## 2025–26 Direction Notes
AI lands in three placements (search fallback, cited sidebar copilot, triage suggester) — always human-confirmed. Org-umbrella layers (Stripe Organizations, Atlassian central UM) are table stakes. Keyboard-first has crossed fully into ops tooling.

## Sources
Stripe: docs.stripe.com/radar/reviews, /get-started/account/orgs, /payments/payment-records; stripe.com/blog/workbench. Shopify: help.shopify.com admin overview, Sidekick, collaborator accounts, org permissions; polaris-react.shopify.com (IndexFilters, resource-index-layout). Linear: linear.app/now/cx-in-linear, /docs/triage, Medium "Invisible details". Zendesk: support.zendesk.com Agent Workspace, context panel, layout builder, SLA views, side conversations. Intercom: intercom.com Fin Copilot docs + blog. Atlassian: support.atlassian.com org administration, audit log; community centralized-UM post. Salesforce: Trailhead Service Console & Setup modules; salesforceben.com (console, Spring '25 approvals); unofficialsf.com items-to-approve. HubSpot: knowledge.hubspot.com CS workspace, health score, help desk. Impersonation: engineering.pigment.com/2026/04/08/safe-user-impersonation; docs.propelauth.com impersonation. Moderation: medium.com/pinterest-engineering Pinqueue 3.0; tspa.org moderation metrics. Flags: launchdarkly.com flag dashboard updates. Incidents: support.pagerduty.com incidents docs.
