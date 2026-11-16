# Revenue recovery test: real Data API readiness

The d37 CI retry passed both complete pure lanes (3,206 passed, zero failed and
15 existing provider-dependent skips per lane) and Environment Lifecycle. Its
Unit database lane then failed the final revenue recovery assertion: the first
application read immediately after migration394 reapplication returned503.
That attempt and its concurrent Architecture run were canceled; neither is a
passing full release gate. The original failure is retained.

The test previously assumed SQL commit acknowledged PostgREST's schema-cache
reload. [PostgREST16 documents notification-triggered cache reload and debouncing](https://docs.postgrest.org/en/stable/references/schema_cache.html).
Its missing-function/cache errors are separately defined in the
[official error reference](https://docs.postgrest.org/en/stable/references/errors.html).
The original sanitized application response alone does not establish which
underlying PostgREST error caused that particular CI failure.

The test now proves the actual STABLE read-only RPC works before removal,
observes its absence after DOWN, and waits for the same real RPC to return the
original14 rows and199 total after UP. Only the documented missing-cache404
PGRST202 is eligible for readiness polling after reapplication. Unexpected
network, permission, infrastructure, response-shape or value failures remain
failures. The test then performs one application read and checks both200 and
the original total. The sanitized503/no-fabricated-data, foreign-tenant,
anonymous, invalid-window and unprivileged-access assertions remain intact.
No application response or mutation is retried.

An initial whole-OpenAPI readiness probe timed out under its bounded request
deadline; those failed qualifications remain retained. The final targeted
read-only RPC probe passed three fresh owned PostgreSQL/PostgREST runs under
CI's exact Node22.23.5: seven tests passed per run, zero failures, zero skips
and zero cleanup failures. These are repeated qualifications of the same seven
tests, not21 distinct tests.

Application runtime, SQL, paired rollback, canonical issuer and financial/tenant
policy are unchanged. Fresh exact-source CI, live recovery/history/permission
checks, staged signup/sign-in, production activation and physical iPhone
acceptance remain mandatory and are not certified by this local test repair.
