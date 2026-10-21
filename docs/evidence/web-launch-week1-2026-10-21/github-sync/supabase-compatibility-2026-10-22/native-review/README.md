# Independent native fence verification — 2026-10-22

**Mechanism verification: PASS. Hosted installation: BLOCKED pending a supported provider-administrator route.**

This report replaces neither the existing release preflight nor the financial
and populated-database upgrade gates. Merchant Performance owns source edits,
commits, promotion and all cloud mutations. Storefront Performance produced this
independent review on a frozen copy and did not change a hosted environment.

The final `helper-results.json` records 70 checks behaving as expected, including
34 exact migration/rollback fence blocks and 31 actual native catalog relation
locks. `static-lock-coverage.json` proves that the helper's fixed union contains
every catalog in the original 34 catalog-lock consumers. There were no missing
original catalogs. The helper body SHA256 is:

`4772eebc5017ef1e188b188f87f1cca8fb8f2b9cfd1e928798ef5cd5dfebfabc`

The fresh synthetic image was Supabase PostgreSQL 17.6.1.127. Its bundled
Supautils policy was explicitly included. Application checks used a direct
non-superuser postgres login, not SET ROLE from an administrator. Bootstrap and
retirement administrator access existed only in this isolated, network-disabled
container. The container had no published ports or persistent data volume and
was removed after verification; cleanup is recorded in the result.

The same backend remained postgres/postgres/non-superuser after the definer
returned, held all 31 native SHARE ROW EXCLUSIVE locks through its transaction,
and released them at COMMIT. Concurrent role attributes, membership grants to a
critical member, function/table/event DDL, extension/publication creation,
replica-mode DDL and privilege changes all failed specifically by lock timeout.
A cross-database role change also timed out against the shared-catalog lock.
Application roles could not invoke the helper. Managed postgres could not
install, replace, overload, drop or retire it. The protected administrator could
install and retire the exact helper in the synthetic fixture.

The helper refused an existing conflicting native relation lock with NOWAIT.
A previously completed DDL statement in an open transaction can have released
its catalog relation lock already: native relation locking alone does not reject
that state. The separate, unchanged migration-360 assigned-transaction preflight
was tested against such a transaction and rejected it. This is why both controls
must remain. Retained-data, prepared-writer and full rollback tests belong to
the deployment owner's financial and populated-restore suite.

Frozen SQL inputs and their SHA256 hashes are recorded in the result. After
testing, the shared rollback-360 source gained MAINTAIN restoration in its final
grant/journal allowlist; the entire native fence remained identical. This review
does not certify that separate financial rollback change.

The earlier `helper-results-attempt-invalid-reason.json` preserves a failed test
assertion: function replacement was correctly denied at schema permission
checking, while the test expected an owner error. The final rerun uses the actual
schema denial and passed all checks. No unsafe production bypass was accepted.

This successful local mechanism test does not create provider administrator
access. The normal connected CLIs cannot install an administrator-owned helper.
The reviewed installation and paired retirement scripts must be accepted and
installed through a supported provider route before the managed migrations can
pass their admission checks. No provider approval or installation is implied by
this report, and no release completion is claimed.
