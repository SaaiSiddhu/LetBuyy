# F3.5 grievance complaint-copy receipt — 5 October 2026

## 5 October integration and atomic-write correction

This section supersedes the earlier same-day status below for the buyer-surface and persistence
gaps. The signed-buyer Commerce account now has a Support screen connected through two same-origin
BFF routes to the existing Gateway and canonical `support_tickets` / `ticket_messages` data. It
supports first submission, a server-confirmed complaint-copy/reference receipt, ticket list, public
conversation, buyer reply, validation, loading and error states. Account navigation links to it; the
legacy public contact form keeps its existing semantics.

Migration 287 adds `open_buyer_support_ticket_with_complaint`, a fixed-search-path
`SECURITY DEFINER` RPC executable only by `service_role`. The Gateway invokes it once for the ticket
and first public message, so PostgreSQL commits both or neither. Existing human ticket references
and SLA due-time calculations remain in the Gateway. The rollback file drops only the function.
No provider, hosted database or real consumer data was used.

Verification on 5 October in Asia/Kolkata, worktree
`/Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy-phase2`, branch
`letbuyy/phase2-shared-buyer-identity`, source HEAD
`0862687a5008d604d0df23357b2eb511293139fa`:

- `pnpm --filter @letbuyy/api-gateway typecheck`: passed.
- `pnpm exec tsx --test src/app/api/buyer/support/support-routes.test.ts` from
  `apps/commerce/web`, under Node's `--conditions=react-server`: **6/6 passed**.
- `pnpm exec tsc --noEmit` from `apps/commerce/web`: passed.
- `pnpm exec tsx --test services/api-gateway/src/__tests__/buyer-support-routes.test.ts`:
  **14/14 passed**.
- `node scripts/governance/run-executable-suites.mjs --suite services/api-gateway/src/__tests__/owned-db/storefront-customer-profile.postgres.test.ts --jobs 1`:
  **12/12 passed** on the runner-owned Postgres 16, real Gateway, local Identity and Chromium stack.
  This includes the account browser flow through BFF and Gateway, complaint readback/reply, and a
  trigger-injected message-insert failure that returned a sanitized 500 and left neither row.
- `git diff --check`: passed. The temporary, version-matched Identity `node_modules` symlink was
  removed by the runner wrapper; the owned test containers were cleaned by the executable-suite
  runner. No unrelated dirty workspace paths were staged, reset or cleaned.

This is end-to-end local acceptance of buyer support intake and conversation, not hosted migration,
deployment, or overall Phase 2/3 closure. Officer acknowledgement within 48 hours, redress within one
month, NCH convergence, entity/channel applicability and counsel/owner policy remain open. The broad
Phase 2 session transition is also still active; the seven-day versus thirty-minute session policy
has not been changed.

## Outcome

The authenticated Gateway ticket-create endpoint now returns an explicit copy of the buyer's
complaint as recorded in the first public `ticket_messages` row, plus the timestamp of that
recorded row. Existing root ticket fields remain in the response for compatibility. The existing
canonical support table and conversation routes are reused; no parallel complaint store was added.

The copy is returned only after the ticket row and public complaint message both return from the
database successfully. The value comes from the inserted-message response, not only from request
memory. Existing ownership checks, fixed requester author/visibility, and public-only read boundary
remain in place.

## Source and scope

The Department of Consumer Affairs' [official amendment listing](https://consumeraffairs.gov.in/pages/consumer-protection-acts)
links to the official [G.S.R. 789(E) eGazette PDF](https://egazette.gov.in/WriteReadData/2026/276125.pdf).
The PDF was fetched directly and its notification particulars checked; rendered pages 5–7 were
visually verified on 5 October. Rule 4(5) states the grievance officer must acknowledge receipt
within 48 hours, provide the complainant a copy of the complaint as recorded by the officer, and
redress the grievance within one month. The amendment commences 1 January 2027.

This delivery implements a narrow API-level complaint-copy seam. It is not evidence that a
grievance officer has acknowledged the complaint, that the 48-hour service level or one-month
redress process is staffed and measured, that a browser UI displays the receipt, or that LetBuyy's
entity/channel falls within the provision. Counsel and the product owner must settle applicability,
officer responsibility, exact acknowledgement semantics, SLA operations, NCH convergence and
user-facing wording before the platform makes a compliance claim.

## Verification

- `pnpm exec tsx --test services/api-gateway/src/__tests__/buyer-support-routes.test.ts`: **12/12 passed**, including exact persisted complaint text and timestamp in the create response, cross-buyer refusal, internal-note exclusion and server-controlled author/visibility.
- `pnpm --filter @letbuyy/api-gateway typecheck`: passed.
- `git diff --check`: passed.
- The initial sandboxed test attempt was blocked before execution because tsx could not bind its local IPC socket. The same focused command passed with local-socket access; this was test-runner access only.

## Remaining work

1. Integrate the receipt with a buyer-facing complaint submission surface and verify the complete browser journey through BFF, Gateway and owned Postgres.
2. Establish the atomic ticket-plus-first-message write guarantee or a safe compensation/retry strategy for partial database failure.
3. Agree and evidence grievance officer assignment, acknowledgement within 48 hours, redress within one month, and National Consumer Helpline convergence where applicable.
4. Obtain counsel and owner confirmation of LetBuyy entity, marketplace/storefront channel and transition scope.

This is one locally verified API slice. F3.5, Phase 3 and the eleven-phase programme remain open.
