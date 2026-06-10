# LetBuyy Empty State Inventory

**Phase 3 of the Empty State Design System mission.** The full catalogue of empty states across LetBuyy: every surface's title, description, primary/secondary CTA, assigned illustration motif, and accessibility notes. Copy follows the voice rules in `EMPTY_STATE_GOVERNANCE.md` §5 and the `design:ux-copy` conventions.

- **Date:** 2026-06-09
- **Surfaces catalogued:** 33 · **Distinct motifs:** 18 (curated reuse — see Audit §12 / Governance §2).
- **Default type below is first-run.** Filtered-empty, permission, and error variants follow the rules in Governance §9 and the per-cluster notes.

## Coverage map (surface → motif)

| Motif | Surfaces served |
|---|---|
| `generic` | Generic fallback, Search-no-results |
| `orders` | Orders |
| `products` | Products |
| `inventory` | Inventory |
| `shipping` | Shipping, Fulfillment, Returns |
| `customers` | Customers, Reseller |
| `payments` | Payments, Checkout |
| `payouts` | Payouts, Settlements, Billing |
| `discounts` | Discounts, Marketing |
| `analytics` | Analytics |
| `domains` | Domains |
| `themes` | Themes, Storefront |
| `apps` | Apps, Marketplace, Integrations |
| `messaging` | WhatsApp |
| `notifications` | Notifications, Email |
| `identity` | Identity, KYC |
| `security` | Security, SSO, Passkeys, Audit Logs |
| `permissions` | Staff, Roles, Permissions |

18 motifs cover all 33 surfaces. Reuse is deliberate: surfaces that share a mental model (Shipping/Fulfillment/Returns = logistics; SSO/Passkeys/Security/Audit = trust) share a motif so the system reads as one family.

---

## Cluster 1 — Commerce core (Merchant Control Plane)

| Surface | Title | Description | Primary CTA | Secondary CTA | Motif | A11y / notes |
|---|---|---|---|---|---|---|
| **Orders** | No orders yet | Orders placed in your store will show up here, ready to fulfil. | Create order | View checkout settings | `orders` | Filtered variant: "No orders match these filters" + **Clear filters** (secondary), drop Create. |
| **Products** | Add your first product | Products you add appear here. Add details, media and pricing to start selling. | Add product | Import products | `products` | Import opens CSV flow; announce title+body+primary as one sentence. |
| **Inventory** | No inventory tracked | Track stock to see quantities on hand, committed and available to sell. | Enable tracking | Import stock | `inventory` | If tracking on but empty, body → "No tracked items yet." |
| **Customers** | No customers yet | People who buy from you or sign up will appear here with their order history. | Add customer | Import customers | `customers` | Permission variant for staff without CRM access → guidance, no Add. |
| **Discounts** | No discounts yet | Create automatic or code-based discounts to drive sales and reward loyalty. | Create discount | Browse campaigns | `discounts` | — |

## Cluster 2 — Logistics

| Surface | Title | Description | Primary CTA | Secondary CTA | Motif | A11y / notes |
|---|---|---|---|---|---|---|
| **Shipping** | No shipping set up | Add zones and rates so customers see delivery options at checkout. | Set up shipping | Add carrier | `shipping` | India-first: mention COD/courier rates in onboarding, not the art. |
| **Fulfillment** | Nothing to fulfil | Orders awaiting fulfilment will appear here so you can pick, pack and ship. | View orders | Fulfilment settings | `shipping` | This is usually a *good* empty (all caught up) — keep tone positive. |
| **Returns** | No returns yet | Return and refund requests from customers will show up here for review. | Create return | Return policy | `shipping` | Error/abuse cases still use calm art; never a "broken" motif. |
| **Reseller** | No resellers yet | Invite resellers to sell your catalogue and track their performance here. | Invite reseller | How resellers work | `customers` | India-first reseller model; secondary links to docs. |

## Cluster 3 — Money movement

| Surface | Title | Description | Primary CTA | Secondary CTA | Motif | A11y / notes |
|---|---|---|---|---|---|---|
| **Payments** | No payments yet | Captured and pending payments across your checkout will appear here. | Configure payments | View checkout | `payments` | Sensitive data — body must not imply funds are missing. |
| **Checkout** | Checkout not configured | Set up payment methods and shipping so customers can complete checkout. | Configure checkout | Preview checkout | `payments` | UPI/COD-first: surface those methods in the flow. |
| **Payouts** | No payouts yet | Settlements to your bank account appear here once sales are processed. | Add bank account | View schedule | `payouts` | Permission-gated to finance roles; otherwise guidance only. |
| **Settlements** | No settlements yet | Settlement batches and their breakdown will appear here as they're created. | View payouts | Settlement settings | `payouts` | Money copy stays factual; no "0" anxiety. |
| **Billing** | No invoices yet | Your LetBuyy plan invoices and receipts will appear here. | View plan | Billing settings | `payouts` | Distinguish *your* billing from customer payments in body. |

## Cluster 4 — Storefront & growth

| Surface | Title | Description | Primary CTA | Secondary CTA | Motif | A11y / notes |
|---|---|---|---|---|---|---|
| **Storefront** | Your storefront is empty | Add products and a theme to bring your storefront to life for shoppers. | Customise storefront | Add products | `themes` | Links the two true first steps (theme + products). |
| **Themes** | No theme published | Pick a theme and customise your storefront. Your published theme shows here. | Browse themes | Customise | `themes` | — |
| **Domains** | No domains connected | Connect a custom domain so customers reach your store at your own URL. | Connect domain | Buy a domain | `domains` | Mention letbuyy.com canonical migration in help, not art. |
| **Analytics** | No data to show yet | As traffic and sales come in, your trends and reports will appear here. | Choose metrics | View reports | `analytics` | Filtered/date-range empty → "No data for this range." |
| **Marketing** | No campaigns yet | Plan promotions, broadcasts and campaigns to reach more customers. | Create campaign | Browse templates | `discounts` | Shares motif with Discounts (same mental model). |

## Cluster 5 — Channels & messaging

| Surface | Title | Description | Primary CTA | Secondary CTA | Motif | A11y / notes |
|---|---|---|---|---|---|---|
| **WhatsApp** | No conversations yet | WhatsApp chats with your customers will appear here once they reach out. | Connect WhatsApp | Message templates | `messaging` | Core India channel; ensure RTL/locale text in copy layer. |
| **Notifications** | You're all caught up | New alerts and notifications will appear here as they arrive. | Notification settings | View archive | `notifications` | "Caught up" is a *positive* empty; the badge dot is decorative. |
| **Email** | No emails yet | Transactional and marketing emails you send will appear here. | Set up email | Email templates | `notifications` | — |

## Cluster 6 — Apps & extensibility

| Surface | Title | Description | Primary CTA | Secondary CTA | Motif | A11y / notes |
|---|---|---|---|---|---|---|
| **Apps** | No apps installed | Extend your store with apps from the LetBuyy marketplace. | Browse marketplace | Manage apps | `apps` | — |
| **Marketplace** | Nothing here yet | Browse and install apps, themes and integrations built for LetBuyy. | Explore marketplace | — | `apps` | Marketplace browse-empty (e.g. a category) → `generic` + Clear filters. |
| **Integrations** | No integrations connected | Connect the tools you already use to sync data with LetBuyy. | Add integration | View directory | `apps` | — |

## Cluster 7 — Identity & access (Identity Platform)

| Surface | Title | Description | Primary CTA | Secondary CTA | Motif | A11y / notes |
|---|---|---|---|---|---|---|
| **Identity** | No identities yet | Verified people and their profiles will appear here for review. | Add identity | Identity settings | `identity` | — |
| **KYC** | No KYC submissions | Verification submissions will appear here for you to review and approve. | Start verification | KYC settings | `identity` | Compliance-sensitive: neutral, non-judgemental copy. |
| **Staff** | No staff added | Invite teammates and assign roles to control who can access what. | Invite staff | Manage roles | `permissions` | — |
| **Roles** | No custom roles | Create roles to group permissions and assign them to staff. | Create role | View permissions | `permissions` | RBAC is role-coarse today; copy shouldn't over-promise granularity. |
| **Permissions** | No permissions set | Define what each role can see and do across LetBuyy. | Configure permissions | Learn about RBAC | `permissions` | — |
| **SSO** | SSO not configured | Set up single sign-on so your team logs in with your identity provider. | Configure SSO | View providers | `security` | OIDC is skeletal today — link docs honestly, don't imply full support. |
| **Passkeys** | No passkeys yet | Passkeys let your team sign in without passwords. Add one to get started. | Add passkey | Learn about passkeys | `security` | — |
| **Security** | Nothing flagged | Security events and sign-in activity will appear here when there's something to review. | Review security | View audit log | `security` | Positive empty = good security posture; keep reassuring. |
| **Audit Logs** | No activity logged yet | Actions taken across your account will appear here for audit and compliance. | View settings | Export logs | `security` | Export gated by role; filtered-by-date variant common. |

---

## Global / utility states

| State | Title | Description | Primary | Secondary | Motif |
|---|---|---|---|---|---|
| **Generic fallback** | Nothing here yet | When there's something to show, it will appear in this space. | Get started | Learn more | `generic` |
| **Search — no results** | No results for "{query}" | Try a different term or clear your filters to see everything. | Clear search | — | `generic` |
| **Error (load failed)** | Couldn't load this | Something went wrong fetching your data. Try again in a moment. | Try again | — | `generic` |
| **Permission denied** | You don't have access | Ask an account admin to grant you access to this area. | — | Contact admin | `security` |

## Notes for implementers

- **Every surface needs all relevant variants**, not just first-run. At minimum, list views need first-run + filtered-empty; access-controlled views need a permission variant; anything that fetches needs an error variant. Reuse the motif; change copy + CTA only (Governance §9).
- **Copy is canonical here.** Strings live in app code / i18n, not in the SVG. Localize the title/body/CTA; the art never changes.
- **CTA permission-awareness is mandatory** — never render a primary button the viewer can't use; swap to guidance (see Permission rows).
- **One primary CTA maximum.** Where this inventory lists a primary + secondary, that is the ceiling, not a target — first-run benefits from both; filtered/error states often have only one.

*Cross-references:* [[EMPTY_STATE_GOVERNANCE]], [[EMPTY_STATE_TOKEN_MAPPING]], [[EMPTY_STATE_SCORECARD]], [[LETBUYY_DESIGN_LANGUAGE_AUDIT]].
