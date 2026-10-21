# Public pooled SQL fallback — observed gap and local repair

**Current correction,21 October:** migration370 now authorizes fixed public site/release reads for the existing restricted backend login. The no-REST-fallback test passes; direct table SELECT still fails42501 intentionally. SQL9, database authority14 and native1 pass in final rund951d521ae90. Read sql-repair-progress.json for current limits, especially Hyperdrive protocol/freshness. The discovery account below is retained history.

The new mounted bootstrap suite retains a decisive requirement: a configured SQL read must succeed without silently falling back to REST. The owned PostgreSQL transport is the established non-inheriting authenticator login. A direct current_user/has_table_privilege query reports authenticator and no SELECT on theme_releases; an actual bounded SELECT fails with SQLSTATE42501. The HTTP request then succeeds through the pre-existing REST service path. This is not SQL-path acceptance.

Five other projection cases pass: real legacy/manifest fallback, foreign/mismatched publication pin refusal, dependency outage/recovery, an actual concurrent publication with a coherent superseded snapshot, and visibility/query validation. Four collection regression cases pass. Gateway1608 unit cases and reviewed inventory14 pass. The failed no-fallback case remains unchanged. Native cache/browser acceptance is separate and pending.

Correction: commit16538f4a made JSON empty-string SQL syntax clearer but the rerun still failed. The observed failure is permission42501, not proof of malformed SQL. Do not use its commit title as acceptance evidence.

Next repair must use the canonical database authorization boundary. Do not grant direct table access to authenticator, switch the test to postgres/service_role, disable RLS, or set an app_tenant GUC from an anonymous handle as if it were a verified JWT. Inspect a narrow backend-only public-read routine with fixed fields, publication/tenant filters, immutable release pinning, guarded grant/owner/search_path and a paired rollback; preserve independently scoped default/private consumers. Extend the claim before adding migrations. Prove actual SQL success, foreign/private refusal and unchanged grants on the real owned database; only then close this case. Broader public catalog password/offline authorization remains a separate unproven existing surface.

Primary develop/GitHub8f415c0f remains frozen. New verification/fixes after the saved WIP snapshot remain local. No restored/shared database or object was written.
