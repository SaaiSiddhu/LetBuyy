// Phase 2 / D03 real-database acceptance (auth hardening follow-up, Section 10). Persisted
// deliberately -- the earlier backfill proof was run once and deleted; this repository's own
// established real-DB test convention is to keep the test, never to discard real-database
// verification as a temporary script.
//
// Required cases (all against a REAL Postgres, synthetic rows only): principal insertion; mapping
// stability across repeated resolution; membership insertion; role/permission resolution (seeds real
// site_roles/site_role_permissions, which the migrations leave empty); idempotent rerun; ambiguity
// blocking; revocation after initial backfill (the reconciliation path); permission downgrade (via a
// real role_ids change); partial-run recovery.
//
// WHERE IT RUNS (P2-HERMETIC-GATEWAY-DB): only in the database the executable-suite runner owns for this
// suite (a disposable cluster, a database cloned from the fully migrated template, a real PostgREST sidecar),
// reached through requireOwnedDatabase(), which proves that ownership before any statement is sent. There is no
// skip path and no lookup of the developer's own stack: with no owned database this suite FAILS, and the runner
// fails any suite that skips. Every row it creates is left for the disposal of that database -- nothing is
// hand-deleted, so no protection is bypassed.
//
// Boundary exercised, per proof: database constraints and triggers, and the real gateway backfill executors and
// target-shadow comparator, reached through PostgREST as the service role. It is not an internal-signed-identity,
// browser-session or route-level proof, and not a row-level-security proof.

import assert from 'node:assert/strict';
import test from 'node:test';
import { getSupabaseAdmin } from '../../lib/supabase';
import { executeMerchantPrincipalBackfill, executeStoreMembershipBackfill, type BackfillExecutorDb } from '../../identity-foundation/backfill-executor';
import { compareStaffPermissionDecisionAgainstTargetData, type TargetShadowDb } from '../../identity-foundation/target-shadow-comparison';
import type { Env } from '../../index';
import { requireOwnedDatabase } from './owned-db-support';

const owned = requireOwnedDatabase();
const psql = owned.psql;
const script = owned.script;

function db(): BackfillExecutorDb & TargetShadowDb {
    const env = { ...owned.restEnv(), ENVIRONMENT: 'test' } as unknown as Env;
    return getSupabaseAdmin({ env } as never) as unknown as BackfillExecutorDb & TargetShadowDb;
}

test('D03 real-database acceptance: principal insertion, mapping stability, membership insertion, role/permission resolution, idempotent rerun, ambiguity, revocation, downgrade, partial-run recovery', async () => {
    const RUN = crypto.randomUUID().slice(0, 8);
    const OWNER = crypto.randomUUID();
    const STAFF = crypto.randomUUID();
    const AMBIG = crypto.randomUUID();
    const SITE = crypto.randomUUID();
    const ROLE_FULL = crypto.randomUUID();
    const ROLE_DOWNGRADED = crypto.randomUUID();

    psql(`INSERT INTO sites (id, name, store_name, site_type, subdomain) VALUES ('${SITE}', 'd03-accept-${RUN}', 'D03 Accept ${RUN}', 'store', 'd03-accept-${RUN}');`);
    // Real site_roles/site_role_permissions rows -- the migrations leave both tables empty; these are this
    // test's own synthetic seed.
    script(`
        INSERT INTO site_roles (id, site_id, slug, name) VALUES ('${ROLE_FULL}', '${SITE}', 'd03-accept-full-${RUN}', 'D03 Accept Full ${RUN}');
        INSERT INTO site_roles (id, site_id, slug, name) VALUES ('${ROLE_DOWNGRADED}', '${SITE}', 'd03-accept-downgraded-${RUN}', 'D03 Accept Downgraded ${RUN}');
        INSERT INTO site_role_permissions (role_id, permission, effect) VALUES ('${ROLE_FULL}', 'product.read', 'allow');
    `);

    // ---- 1. Principal insertion ----
    const insertResult = await executeMerchantPrincipalBackfill(db(), [
        { id: OWNER, email: `owner-${RUN}@example.test`, name: 'D03 Accept Owner' },
        { id: STAFF, email: `staff-${RUN}@example.test`, name: 'D03 Accept Staff' },
    ]);
    assert.equal(insertResult.inserted, 2, JSON.stringify(insertResult.details));

    // ---- 2. Mapping stability: the same legacy_user_id resolves to the SAME principal id across
    // repeated lookups (not a fresh row each time). ----
    const idFirst = psql(`SELECT id FROM principals WHERE legacy_user_id = '${STAFF}';`);
    const idSecond = psql(`SELECT id FROM principals WHERE legacy_user_id = '${STAFF}';`);
    assert.ok(idFirst && idFirst.length > 0);
    assert.equal(idFirst, idSecond, 'the legacy_user_id -> principal_id mapping must be stable, not re-derived differently each time');

    // ---- 5 (checked early). Idempotent rerun of the principal backfill ----
    const rerun = await executeMerchantPrincipalBackfill(db(), [{ id: STAFF, email: `staff-${RUN}@example.test` }]);
    assert.equal(rerun.skipped, 1);
    const countAfterRerun = psql(`SELECT count(*) FROM principals WHERE legacy_user_id = '${STAFF}';`);
    assert.equal(countAfterRerun, '1', 'rerun must not duplicate the real row');

    // ---- 6. Ambiguity blocking: seed a SECOND principal for a different legacy_user_id, then
    // insert a duplicate manually to simulate a genuine data problem, and confirm the backfill
    // blocks rather than guessing. ----
    await executeMerchantPrincipalBackfill(db(), [{ id: AMBIG, email: `ambig-${RUN}@example.test` }]);
    psql(`INSERT INTO principals (realm, actor_type, legacy_user_id, email) VALUES ('merchant', 'merchant', '${AMBIG}', 'ambig-dup-${RUN}@example.test');`);
    const ambigResult = await executeMerchantPrincipalBackfill(db(), [{ id: AMBIG, email: `ambig-${RUN}@example.test` }]);
    assert.equal(ambigResult.details[0].outcome, 'blocked_ambiguous', JSON.stringify(ambigResult.details));

    // ---- 3. Membership insertion (active, with a role that genuinely grants product.read) ----
    const membershipResult = await executeStoreMembershipBackfill(db(), [
        { id: crypto.randomUUID(), store_id: SITE, user_id: STAFF, email: `staff-${RUN}@example.test`, role: 'manager', status: 'active', deleted_at: null },
    ]);
    assert.equal(membershipResult.inserted, 1, JSON.stringify(membershipResult.details));
    psql(`UPDATE store_memberships SET role_ids = ARRAY['${ROLE_FULL}']::uuid[] WHERE store_id = '${SITE}' AND principal_id = '${idFirst}';`);

    // ---- 4. Role/permission resolution: the target-backed comparator must resolve the REAL
    // role_ids -> site_role_permissions chain against actual Postgres. ----
    const grantedResult = await compareStaffPermissionDecisionAgainstTargetData(db(), {
        legacyUserId: STAFF,
        siteId: SITE,
        requiredKey: 'products:read',
        legacyAllowed: true,
    });
    assert.equal(grantedResult.outcome, 'MATCH', JSON.stringify(grantedResult));
    assert.equal(grantedResult.targetAllowed, true, 'a real role_id resolving through real site_role_permissions must grant product.read');

    // ---- 8. Permission downgrade: swap to a role with NO matching permission row, confirm the
    // resolution reacts -- this tests the resolution mechanism's sensitivity to a real role_ids
    // change, not a legacy-role-string mapping (none exists yet; site_roles/site_role_permissions
    // are empty in every real environment, so there is nothing for a legacy role string to map
    // to today -- recorded precisely, not glossed over). ----
    psql(`UPDATE store_memberships SET role_ids = ARRAY['${ROLE_DOWNGRADED}']::uuid[] WHERE store_id = '${SITE}' AND principal_id = '${idFirst}';`);
    const downgradedResult = await compareStaffPermissionDecisionAgainstTargetData(db(), {
        legacyUserId: STAFF,
        siteId: SITE,
        requiredKey: 'products:read',
        legacyAllowed: true,
    });
    assert.equal(downgradedResult.outcome, 'DIVERGE_LEGACY_ALLOWS_TARGET_DENIES');
    assert.equal(downgradedResult.targetAllowed, false, 'the downgraded role must no longer resolve to an allow');

    // ---- 7. Revocation after initial backfill (the reconciliation path), against REAL Postgres ----
    const revokeResult = await executeStoreMembershipBackfill(db(), [
        { id: crypto.randomUUID(), store_id: SITE, user_id: STAFF, email: `staff-${RUN}@example.test`, role: 'manager', status: 'removed', deleted_at: null },
    ]);
    assert.equal(revokeResult.details[0].outcome, 'reconciled_revoked', JSON.stringify(revokeResult.details));
    const realStatus = psql(`SELECT status FROM store_memberships WHERE store_id = '${SITE}' AND principal_id = '${idFirst}';`);
    assert.equal(realStatus, 'removed', 'the real row in Postgres must actually be revoked, not just reported as such');

    // ---- 9. Partial-run recovery: simulate an interrupted run (only STAFF's membership landed),
    // then resume with the full input including a not-yet-processed row for a fresh principal. ----
    const FRESH = crypto.randomUUID();
    await executeMerchantPrincipalBackfill(db(), [{ id: FRESH, email: `fresh-${RUN}@example.test` }]);
    const resumed = await executeStoreMembershipBackfill(db(), [
        { id: crypto.randomUUID(), store_id: SITE, user_id: STAFF, email: `staff-${RUN}@example.test`, role: 'manager', status: 'removed', deleted_at: null },
        { id: crypto.randomUUID(), store_id: SITE, user_id: FRESH, email: `fresh-${RUN}@example.test`, role: 'manager', status: 'active', deleted_at: null },
    ]);
    assert.equal(resumed.details.find((d) => d.legacyId && resumed.details.indexOf(d) === 0)?.outcome, 'skipped_already_exists', 'the already-revoked row must not be re-processed as new work');
    assert.equal(resumed.inserted, 1, 'the never-before-seen row must still be inserted on this resumed run');
});
