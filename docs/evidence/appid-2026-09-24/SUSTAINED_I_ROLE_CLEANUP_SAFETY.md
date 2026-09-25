# SUSTAINED-I — Postgres role-cleanup safety audit (workstream 3)

Audits `clearRoleDependenciesInSiblingDatabases` as it exists, unmodified, in the three files that
carry it (`tests/executable/{tenant-redteam,security,settlement}-postgres.test.mjs`, all
byte-identical in shape). Per the owner's instruction: no broader destructive cleanup was
introduced or used to manufacture a pass — every claim below is proven against the exact shipped
function, empirically, not asserted from reading the SQL alone.

## The function, restated precisely

```js
function clearRoleDependenciesInSiblingDatabases(roles) {
  const others = psqlInDatabase('postgres',
    "SELECT datname FROM pg_database WHERE datname LIKE 'letbuyy\\_%' ESCAPE '\\';")
    .split('\n').map(l => l.trim()).filter(name => name && name !== databaseName);
  for (const database of others) {
    psqlInDatabase(database, `
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN (${roleList})) THEN
          EXECUTE 'REASSIGN OWNED BY ${roleList} TO postgres';
          EXECUTE 'DROP OWNED BY ${roleList}';
        END IF;
      END $$;`);
  }
}
```

## Claim 1 — scope is restricted to disposable `letbuyy_*` databases, never anything else

The discovery query's `LIKE 'letbuyy\_%' ESCAPE '\'` is a **fixed literal string**, not built from
any variable — no role name, table name, or environment value is concatenated into it, so there is
no SQL-injection path into the discovery query itself. The `\_` escape makes the underscore literal
(not a wildcard), so the pattern can only match names that literally start with `letbuyy_`.

**Empirically proven**: created two databases, `letbuyy_safety_audit` (matches the prefix) and
`not_letbuyy_should_never_touch` (deliberately does not). Ran the unmodified function. The
"sibling databases discovered" list it printed was exactly `[letbuyy_subscription_payment,
letbuyy_safety_audit, letbuyy_webhook_reclaim]` (the three `letbuyy_*` databases that happened to
exist on the cluster from earlier test runs) — `not_letbuyy_should_never_touch` never appeared, was
never connected to, and its own probe table (owned by `app_user`, holding a row) was **still owned
by `app_user` with its data unchanged** after the run.

## Claim 2 — the action itself is non-destructive to data, not a CASCADE

`REASSIGN OWNED BY <roles> TO postgres` changes the **owner** of every object those roles currently
own in that database to `postgres` — it does not drop rows, tables, or schemas. Only *after* that
runs does `DROP OWNED BY <roles>` execute; by then the roles own nothing in that database (ownership
was just transferred), so `DROP OWNED BY` has nothing left to drop for them — it only revokes any
remaining `GRANT`s made *to* those roles on objects they don't own. This is Postgres's own documented
pre-`DROP ROLE` sequence, not an invented technique, and it is strictly narrower than a schema/table
`CASCADE`, which this code never issues against a sibling database.

**Empirically proven, the strongest test available**: created a table **owned by** `app_user` (not
merely granted a privilege on) in the sibling `letbuyy_safety_audit` database, with a real row
(`'must survive cleanup'`). Ran the unmodified cleanup function. After it ran: the table **still
exists**, **still holds its row**, and its `tableowner` changed from `app_user` to `postgres` — it
was reassigned, not dropped. This is the single case where "restricted to disposable resources"
could plausibly fail (an owned object, not just a grant) and it did not.

## Claim 3 — cannot corrupt or destructively interfere with a concurrently running suite

Within one `pnpm run test:behavioral` invocation, `--test-concurrency=1` already serializes every
file, so there is no concurrency *within* a single suite run to interfere with. The real question is
whether this cleanup could corrupt or destructively disrupt a **separately running** process (a
second terminal, a manual `psql` session, or a second concurrent suite invocation) connected to the
same sibling database at the same moment.

**Empirically proven**: opened a second `psql` session against `letbuyy_safety_audit`, started a
transaction, and took an `ACCESS EXCLUSIVE` lock on a table owned by `app_user`, then slept 6
seconds before committing. While that lock was held, ran the unmodified cleanup function
concurrently. Result: the cleanup call **took exactly 6 seconds** (matched the lock holder's sleep)
— it blocked and waited for the lock, exactly like any other DDL statement would under Postgres's
standard MVCC locking, and returned successfully once the lock was released. The lock-holding
transaction itself **completed and committed normally**, unaffected by the concurrent cleanup. No
error, no corruption, no forced termination of the other session — the worst-case behavior is a
lock wait, bounded by however long the other transaction holds its lock, which is the same
characteristic any two pieces of ordinary Postgres DDL/DML share.

**Honestly disclosed, not new**: this test harness names its Postgres databases with fixed strings
(`LETBUYY_EXECUTABLE_PG_DATABASE` defaults like `letbuyy_executable`), not per-invocation-unique
names, so two genuinely separate `pnpm run test:behavioral` processes running at the same time would
already collide on the same database names regardless of this cleanup function's existence — that is
a pre-existing characteristic of the harness, unrelated to and not worsened by this fix. The fix's
own worst case (a bounded lock wait against an object a handful of specific roles own or were
granted) is materially smaller than that pre-existing collision surface.

## Verdict

The cleanup is scoped to `letbuyy_*`-prefixed disposable test databases only (proven, not merely
read), is non-destructive to actual data or schema objects even in the adversarial case of a role
that genuinely owns something (proven), and degrades to an ordinary Postgres lock wait — never
corruption or forced disconnection — under real concurrent access (proven). No broader or additional
cleanup was introduced to produce these results; the function audited is byte-identical to what
SUSTAINED-H shipped.
