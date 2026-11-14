> **3 November follow-up:** [Latest verified repairs, source bundle and remaining work](FOLLOW-UP-FIXES-AND-REMAINING-WORK.md) supersede earlier same-day build/count/access statements below. No deployment occurred.

# Rollback and recovery — prepared, not executed

## Marketing recovery reference

Before this task, `www.letbuyy.com` served `dpl_ADZiF5548EQAxvnoHbcbzmdoVmfE` at `https://marketing-site-7w5hrckul-letbuyy-store-s-projects.vercel.app`. Authenticated alias inspection verifies that reference. Production history reports main source `e4105581e3346041d71694d3db093eb713773e07`. Preserve its build/settings and domain assignment before a later release.

Restoring that deployment would also restore its known old SEO defects; it is a service-recovery reference, not the desired SEO state.

After a separately authorized release, recovery triggers include broken primary pages/assets, incorrect production origins, pricing outage, account-handoff failure, unexpected indexability/canonicals, or a material verified layout/interaction regression. Stop further rollout and retain the failed checks.

Installed CLI help confirms this form, which was **not executed**:

```sh
# Production mutation: requires the approved release/recovery scope.
vercel rollback https://marketing-site-7w5hrckul-letbuyy-store-s-projects.vercel.app
```

Re-inspect the public alias and repeat the same status, metadata, pricing, asset and account smoke after recovery. Do not change DNS to roll back an ordinary Vercel application release. No production rollback was rehearsed or claimed.

## DNS and Firebase

Before any later DNS change, export exact records, TTL/proxy flags and domain assignments. Cloudflare record reads currently return 403; public resolver answers are not a full provider configuration backup. There is no safe basis to invent rollback record values.

Firebase's displayed short hashes are main `0e45aa`, seller `9279d9`, admin `80c22c`, store `6480a7` and storefront `414a0c`. Obtain full release/version IDs, deployed files and the corresponding config before changing any site. Do not reconnect the stale apex mapping or remove sites/releases/Auth/Firestore as cleanup.

If an approved path redirect fails, restore only its captured rule/record or exact targeted hosting version, then verify both old and current account/app paths. Keep unrelated domains and data untouched.

## Local reversibility

[SOURCE-CHANGES.patch](SOURCE-CHANGES.patch) contains only the create wrapper's two tag replacements relative to task start. Reverse-apply validation passes. No migration or database restore is needed. Twelve matching before/after cases establish local parity, not cloud recovery.

## Follow-up local recovery boundary

`SOURCE-CHANGES.patch`, `GATEWAY-CORS-REPAIR.patch` and `PROXY-MIGRATION.patch` contain task-owned deltas against captured pre-edit bytes. All three pass reverse-applicability checks without applying them. Preserve unrelated owner changes; do not use a broad reset/checkout. The Proxy patch restores the original middleware entry point and removes only its added behavioral tests. The gateway patch is separate from the marketing source archive. No Worker was deployed, so no new hosted Worker rollback artifact exists. Restore local source only through reviewed exact patches, rebuild the affected runtime and recheck routing, origins and anchors; a source revert is not a hosted rollback.


## Latest resolution patch

[RESOLUTION-REPAIRS.patch](RESOLUTION-REPAIRS.patch) records the 14 task-owned paths changed since the prior packet. It includes the content/translation corrections, directory indexing policy and matching contract, and decorative-image priority change. Its reverse applicability is checked without changing source. Review exact overlap before any reversal; preserve earlier fixes and unrelated owner work. No database rollback is needed.
