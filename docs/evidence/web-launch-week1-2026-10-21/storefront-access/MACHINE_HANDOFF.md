# Storefront access work — unfinished source handoff, 21 October 2026

The owner explicitly requested committing and pushing all current work for a new machine. This authorizes this source sync and supersedes the prior local-only restriction. No deployment, hosted migration, real provider transaction or external message is authorized.

Implementation checkpoint d63d5b8e is preserved on `letbuyy/week1-storefront-access`, stacked on verified protocol checkpoint 5e9c7aaa. It is deliberately not merged into develop: catalogue authorization acceptance is unfinished. The integrated public storefront candidate is on develop; continuing this branch requires reconciling develop bookkeeping without losing its active scope.

## Observed verification and known failure

Before guards, the actual mounted Gateway/owned PostgreSQL REST-path suite failed four cases and exposed password, preview-only and offline catalogue data. Initial guards passed four cases; the expanded positive suite passed six, including password verification/revision rotation, typed-capability separation and stored preview-link revocation/expiry/deletion. Structured runner receipts are adjacent. They describe their historical tested checkpoints; a final fixture adjustment in d63d5b8e has not been rerun.

Auth-core tests passed30. Gateway/Commerce types passed before the latest small corrections. First full Gateway run passed1611 and failed2; marketplace category overlap was corrected. The latest targeted product suite passed14 and failed1: unpublished-site denial produces500 in the isolated test mount, because the new middleware throws AppError404 and the bare Hono fixture lacks the production error handler. Preserve the denial and verify production mounting; do not weaken the expected404. This diagnosis is from the captured stack, not a fresh repaired test result.

## Required continuation

- Prove actual pooled SQL plus REST compatibility access paths. Retarget the historical370 lifecycle fixture honestly for guarded371; add371 replay/rollback/tamper/ABI/ACL and no-secret-projection tests. Do not modify historical370 to accept arbitrary bodies.
- Check canonical host resolution distinguishes database failure from absent store; host/site scope, duplicate parameters, unavailable/recovery, capability purpose and independently approved marketplace behavior.
- Verify the normal preview issuer/revoker routes and validate target host ownership. Preserve editor JWT capabilities and buyer history.
- Test server-only cookie forwarding and actual native browser password unlock, rotation, access-mode changes, first share-link request and revocation. Run the complete public Core journey, appropriate types/security/regression and canonical gate in a disposable clone.
- Fresh cart/order eligibility remains separate required launch work; catalogue read guards do not establish that those write paths enforce current store eligibility.

371 and its paired rollback are source only. Do not apply them to a restored or hosted database as a side effect of pulling this branch. Older untyped storefront cookies/links require deliberate re-unlock/reissue during a coordinated rollout; no identity JWT issuer changed. Week1 and the four-week programme remain open. Razorpay account login is owner-deferred.

Pull this branch in a separate checkout with `git fetch origin` then `git switch --track origin/letbuyy/week1-storefront-access`. Never reset another machine's local work. Keep environment files, backups, uploaded objects and sessions out of Git.

## Superseding source-sync continuation

The earlier unfinished-state description above is historical. Catalogue/normal visitor lifecycle now has local acceptance at b49e7b3a, recorded in acceptance.json and CONTINUITY.md. Password admission is implemented at b27a9838 with31 owned and1620 Gateway checks passing; see ../password-admission. The owner renewed commit/merge/push authorization for the current machine transfer. Read the latest github-sync handoff for the integrated SHA and actual final checks; no hosted acceptance is implied.
