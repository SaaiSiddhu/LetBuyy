# Admitted native run: publisher privilege mismatch

Run `515b6d97865b` used the unchanged official runner with elevated Docker access, fresh owned resources, gateway-db/jobs1/no-reap/prepared2/timeout600, default-LATEST392 with no ceiling. All321 migration files through392 applied; all receipt hashes match the admitted current source.

The native parent then failed before phase1 at `playfield201-promotion.postgres.test.ts:187:50`. The actual query `has_function_privilege('app_tenant', p.oid, 'EXECUTE')` for `public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)` returned **true**; the admitted assertion requires **false**. This is an observed privilege-profile mismatch, not a Docker/startup failure. The publisher was not invoked by app_tenant, so this does not claim an exercised escalation or cross-tenant attack.

Actual TAP: one parent, zero pass, one fail, no skip/cancel/todo. All eight child phases were not started; the expected complete qualification remains9 tests. Candidate393 was not applied, and none of the new update/role-restoration/audit/rollback/concurrency/browser acceptance is qualified. The suite-owned synthetic tenant/actor setup preceded the profile check, but no install/update/publish acceptance phase ran.

No phase provenance file was emitted: the profile assertion precedes the first proof write. The raw full publisher profile/ACL was transient and is not present in TAP, so the exact grant/inheritance/owner cause is unqualified. Do not infer that cause or fabricate a captured profile after cleanup. A separately admitted diagnostic would be needed to distinguish those sources.

The runner verified ownership before start and removed its database, REST sidecar, container, network and volume. Its cleanup failure and remaining-resource lists are empty; no stale resources were reaped. All1079 source-closure files and admission/suite bytes still match. No grant/RLS/guard/profile/migration/source change or retry was attempted. Retained Threadline preview/login/tabs, persistent Marketplace and Root's separate stable392 fixture were untouched.

The first run98f95df21bc7 remains separately preserved as a zero-test/migration/resource sandbox socket denial. It is not counted as an application failure or qualification. Root renewed this second attempt with elevated sandbox access. The next action is Root review of this actual native profile failure and an explicit decision on any diagnostic or repair; no permission change, guard weakening or further run is authorized by this report.
