# 6. Support Platform Investigation

## Direct Evidence: Support Is Explicitly Unimplemented

`services/api-gateway/src/routes/employee.ts:296-317` — the only support endpoint in the platform:

```ts
// GET /employees/tickets — Support tickets
router.get('/tickets', async (c) => {
    // ...verifies caller is an active employee...
    return c.json(
        { error: { code: 'SUPPORT_TICKETS_UNAVAILABLE',
                   message: 'Support ticket infrastructure is not configured' } },
        501
    );
});
```

The portal UI (`apps/platform-operations-portal/src/app/(dashboard)/support/page.tsx`) calls this endpoint, gracefully renders the `backend_needed` state, and ships **disabled** "Assign ticket / Change priority / Reply" buttons.

## Capability Audit

| Capability | Verdict | Evidence |
|---|---|---|
| Support tickets | MISSING | No `support_tickets`/`tickets` table in 233-table schema; endpoint returns 501 |
| Live chat | MISSING | No chat tables, no websocket chat service; repo-wide search for zendesk/intercom/freshdesk integrations: none |
| Merchant→platform issue intake | MISSING | No form, route, or table; merchants have no in-product way to contact LetBuyy |
| Shopper→merchant messages | EXISTS | `contact_submissions` table + merchant inbox at `merchant-control-plane /contact` (read/replied/spam states, mailto replies) — often misread as a support system; it is storefront contact mail |
| Escalations | MISSING | No escalation states, routing, or SLA anywhere |
| Internal notes | MISSING | No notes table; CRM page "Add note" disabled |
| Merchant history (360 view) | PARTIAL | Console can show store row + audit logs; no unified timeline joining orders/payments/apps/themes/support per merchant |
| Store history | PARTIAL | `audit_logs` (actor, action, resource, old/new values, IP, UA) + console viewer with filters |
| Order history (cross-store, for agents) | MISSING | No platform-side order search/lookup |
| App history per merchant | PARTIAL | `app_installations` data exists; no agent-facing view |
| Theme history per merchant | PARTIAL | `theme_instances`/`theme_releases` data exists; no agent-facing view |
| Knowledge base / help center | MISSING | No KB tables or routes |
| CSAT / support analytics | MISSING | Nothing |
| Notification/email visibility for agents | PARTIAL | `email_logs` table (type, status sent/failed/bounced) exists; no UI to look up "did the merchant get the OTP email?" — a top-3 real-world support query |

## How Support Would Operate Today

1. Merchant hits a problem → finds no help link → emails a founder's personal address or DMs on social media.
2. Agent (if any existed) has: no ticket record, no merchant 360, no order lookup, no email-delivery lookup, no notes, no escalation path.
3. Resolution requires a super-admin running SQL against Supabase and replying from a personal inbox.
4. Nothing is measured: no volume, no response time, no CSAT.

The seeded permissions prove intent without implementation: `('support','tickets.view')`, `('support','tickets.respond')`, `('support','users.read')`, `('support','stores.read')` (`database/supabase/seeds/001_seed.sql`) — permissions for a ticket system that returns 501.

## Conclusion

LetBuyy has **no support platform** — not a weak one, none. The 501 response is honest scaffolding: UI shell, employee verification, and seeded permissions all anticipate a ticketing system that was never built. The most damaging absence is the intake side: even a perfect agent console would have nothing to display because merchants cannot file issues.
