# Console overview rollback/reapply readiness

Source a6f8d549b's CI Unit lane failed the Console overview test's first
application read after migration325 reapplication:503 instead of200. The exact
failure is preserved; that source's CI and Architecture attempts were canceled.
The sanitized response alone does not establish the original underlying error.
Other suites interrupted during cancellation are not accepted or silently
reclassified as passing.

The test had treated SQL COMMIT as acknowledgement of PostgREST's asynchronous
schema-cache reload. It now polls only the real overview RPC with null inputs.
The function's existing invalid-kind return occurs before session resolution or
audit writes. Readiness requires the exact200/accepted=false/query-invalid
response. Only404/PGRST202 is eligible while awaiting reapplication; absence
after DOWN also permits PostgreSQL's42883. Other errors fail immediately, and
the wait has a finite deadline and per-request timeout.

The test additionally verifies a real application503 without data while the
function is absent, preserved accounts/sessions/audits, denied execution for
ordinary roles, the existing invoker-security property, and one recovered
application read with exactly one additional attributed audit. No application
read or mutation is retried. Runtime, SQL, migration history, issuer, permissions
and production configuration are unchanged.

Local qualification passed three fresh owned PostgreSQL/PostgREST runs using
CI's exact Node22.23.5: the same10 tests passed per run, with zero failures,
skips or cleanup failures. The lifecycle-managed proof is
`20261117T005158Z-native418-console-overview-schema-recovery-49e37b8b6e4940c59f07935e8ef0289a`.
These are repeated qualifications, not30 distinct tests. All31 focused
source-freeze, migration-profile and owned-database-lane controls also passed
with zero failures or skips through the common verification lifecycle.

Fresh exact-source mandatory CI, current
backup/restore and hosted history/permission checks, staging signup/sign-in,
production activation and physical iPhone acceptance remain separate gates.
