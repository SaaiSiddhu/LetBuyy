# Console read repair — 21 October 2026

## Working position

Continues the console redesign at the owner's “Continue” instruction. Checkout: `/Users/saai_mithra/Projects/Start_Up/LetBuyy`, branch `develop`, source HEAD `118209b4fde1b5a15313f4741bcac454690d15c8`, with uncommitted redesign/setup work preserved. Scope: repair the observed store, subscription, founding-allocation and compliance read failures, plus merchant profile search reached from the directory.

## Result

All five affected workspaces load against the real local backend with zero API error panels. Empty local collections display real empty results and pagination instead of internal errors. Nonempty synthetic records were verified separately in the owned database lane; the developer's restored database was not seeded or reset.

| Read | Authority and bounds |
| --- | --- |
| Store directory | Current MFA Console session, active membership and `merchant:view`; validated 1–100 row pages |
| Subscriptions | Current MFA Console session, active membership and `exec:view`; validated 1–100 row pages |
| Merchant profile search | `merchant:pii`, since search can resolve owner email/name; bounded direct site search and existing guarded owner lookups |
| Founding allocations | Correct Console bridge plus current `merchant:view`; validated number/UUID search, page and 1–500 row cap |
| Compliance overview/list | Current `compliance:view`; list cap 100, seven count-only queries, latest ten request summaries and five export cursors |

These are explicit call sites of the repository's existing operator-read client. The ordinary tenant-scoped client, tenant-table registry and tenant guard remain unchanged. Call-site allowlist tests pin the permission gates and bounds. No migration, RLS change, issuer, MFA reset, service or cache was added.

Store/subscription ordering now includes an ID tie-breaker. The founding page requests 25 records and connects the returned totals to the shared pagination controls. The existing web CSV handler consumes the repaired allocation reader.

Compliance counts no longer depend on a capped 10,000-row array. Sensitive list audit actor ID, email and actor type come from the current session rather than request query fields. Audit insertion errors now propagate from the shared compliance audit helper; a failed sensitive-read audit cannot return a successful data response. This also makes audit-storage failure visible to other helper callers; their complete command/webhook retry and transaction behavior is outside this read acceptance.

## Fresh verification

Environment: Node 22.23.3 / pnpm 10.6.2. Database tests use the repository-owned PostgreSQL 16 + PostgREST fixture and the real gateway worker/middleware/session path. Browser checks use Chromium and the running local Supabase/identity/gateway/console stack.

| Check | Result |
| --- | --- |
| Gateway build (`pnpm --filter @letbuyy/api-gateway build`) | Exit 0 |
| Console production build with separate `.next-session-runtime-20261021-console-next` directory | Exit 0 |
| Console TypeScript check | Exit 0 |
| Console ESLint | Exit 0; zero errors, 25 existing warnings |
| Focused founding/compliance/operator-client/merchant/money-convergence contracts | 28 pass, 0 fail, 0 skipped/cancelled/TODO |
| `console-directory-reads.postgres.test.ts`, through `run-executable-suites.mjs` | 7 pass, 0 fail, 0 skipped/cancelled/TODO |
| Browser: stores, subscriptions, founding, compliance, merchant search | All render; zero API error panels, JavaScript errors, desktop/mobile horizontal overflow; one main landmark each |
| `git diff --check` | Exit 0 |

The seven database cases prove nonempty cross-site store results and a free subscription, bounded/invalid query handling, server-side matching and empty search, bridge-only and pre-MFA denial, wrong bridge denial, permission denial, live role/membership revocation, logout rejection, nonempty founding search, exact counts over 10,005 synthetic privacy requests, small overview responses, site-filtered privacy results, forged audit attribution rejection and audit-failure recovery.

Runner evidence: `/tmp/console-directory-db-acceptance.json`, run `c4b10221dfab`; fixture cleanup reports no failures and no remaining containers, networks or volumes. Logs: `/tmp/console-directory-db-acceptance/`. Browser results: `.tmp/local-backend/console-read-repair-verification.json`; screenshots use the same `console-read-repair-*` prefix. Evidence contains no saved credentials or private production records.

The first database run expected a role change to yield 403. The actual canonical session contract retires the old permission witness and yields 401; the corrected test asserts that refusal and separately verifies 403 for an initially authenticated operator without the executive permission. Earlier failing observations are superseded by the fresh passing acceptance above.

Navigation source contracts were retargeted from the old dashboard layout into `ConsoleShell`, where the required links now live. The merchant label assertion follows “Merchant profiles”; route, action, independent-approval and financial assertions remain intact.

## Limits and next work

This closes the observed read failures in the five named workspaces locally. It does not certify every Console endpoint, populated record-detail journey, administrator mutation, independent second-operator approval, financial action, external provider or production deployment. No such action was performed. Legacy direct founding endpoints and non-read compliance command recovery still need their own session/permission/atomic-audit review; this repair does not broaden their access.

Next bounded task: verify the populated merchant-detail and approval journeys with synthetic records in the owned browser/database lane, then address their observed failures. Keep production providers and real financial effects outside the local acceptance.

> Follow-up, 21 October 2026: the broader page audit, additional repairs and current verification limits are recorded in [CONSOLE_ALL_PAGES_AUDIT_2026-10-21.md](CONSOLE_ALL_PAGES_AUDIT_2026-10-21.md). This earlier report remains dated evidence.
