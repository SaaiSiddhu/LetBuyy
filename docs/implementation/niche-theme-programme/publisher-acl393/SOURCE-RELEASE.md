# ACL393 source release for independent review

2026-10-24. **Source candidate only. No native/database execution or source emission is admitted.** Root allocated393 to the exact publisher ACL closure and reserved394 for later catalog work. This release implements only the bounded source lease in `publisher-acl393-source-allocation.json`.

The candidate UP removes only direct non-grantable app_tenant EXECUTE on `public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)`. Existing postgres-owner and service_role privileges are preserved, without replacement grants. DOWN is the exact guarded historical inverse for a later separately owned rollback proof; it deliberately recreates the unsafe tenant grant, then qualification must re-UP and finish denied. No refusal-only DOWN or additional policy/approval mechanism was introduced.

## Candidate contract

Both candidates use the existing managed/provider-admin catalog fence and native locks on the actual catalogs inspected, plus a canonical administrative transaction context. They accept only the known376 implementation/owner/ABI/default/security/search-path/comment profile and either its three-grantee baseline ACL or already-hardened two-grantee ACL. Unexpected grantor, grant option, effective inheritance, overload, function attribute or dependency refuses before mutation. No CASCADE or direct catalog row updates are used.

The source-defined ordinary dependency expectation is public namespace plus plpgsql language, using per-database OIDs; an extra dependency refuses. This precise expectation has not been queried by this new suite and must be checked by the admitted native positive control, without weakening it to pass. All non-ACL pg_proc fields, raw default AST, body/owner/ABI, ordinary dependencies, comments and unrelated privileges remain exact. The only permitted shared-catalog delta is the target's single ACL-role dependency on app_tenant, removed by UP and restored by DOWN. Replay validates and leaves the corresponding state unchanged. Service-role access, PUBLIC/anon/authenticated denial, and role memberships remain unchanged.

No schema/table/role/policy/function definition, default privilege, historical privilege journal or commerce row is changed by the pair. Candidate SQL remains in this documentation folder, outside the migration/rollback scan. Actual migration source is still321 UP files/max392; no393/394 file was emitted there.

## Dedicated future native proof

`services/api-gateway/src/__tests__/owned-db/theme-publisher-acl.postgres.test.ts` is one new suite using the unchanged owned guard, synthetic-tenant helper and real mounted Gateway. Its strict admission prefix executes before obtaining the owned DB handle, requires exact source/manifest/allocation/closure hashes and baseline321/max392/no ceiling, and rejects emitted393/394. No app/browser/runtime imports or fixture reuse.

There is one parent and seven ordered phases: **eight expected native TAP tests**. This is a separate security suite, not the historical nine-test Playfield catalog source. The phases require:

1. Complete baseline publisher/role/ACL/dependency/business profiles captured before assertions, then a fresh own/foreign synthetic setup and real selected Threadline install/editor positive controls.
2. Candidate UP/replay, exact non-ACL/ordinary/unrelated catalog conservation, all-public-table business hash parity, and the single expected shared ACL dependency removal.
3. Actual app_tenant valid-payload publisher42501 with a positive own-row check in the same transaction first; own/foreign/unset GUC variations and anon/authenticated direct denial, all with zero business effects. These cases do not claim a successful exploit or that caller-supplied GUC is legitimate authority.
4. Real canonical service-backed save/publish and reviewed release rollback. Exact save/publish/rollback retry, stale CAS and foreign-owner rejection, restored target content, preserved unpublished private draft and one rollback audit/outbox effect are asserted. This preserves nested service EXECUTE without granting tenant access.
5. Ordinary transactional ALTER/GRANT/COMMENT controls for unknown cost, security mode, search path, owner, grantee, grant option, comment and extension dependency, against both candidate directions. Each emits its full mutant profile before assertions and requires guard refusal plus complete rollback. No manual SQL catalog edits or new role/function/policy is used.
6. Exact DOWN/replay restores only the historical ACL/dependency while preserving business state; no tenant publisher or updater runs in that unsafe state. Re-UP/replay must restore the exact hardened snapshot, followed by actual denial again.
7. Final hardened full profiles, unrelated catalog/role state, dependency cardinality and frozen input hashes remain exact.

Full profiles are emitted before parent and phase assertions and around migrations, so a new positive-profile failure has raw provenance; the cleaned515b failure is not retroactively given a missing profile. The separately supplied read-only936e diagnostic is bound only as provenance, not accessed by this suite. Raw mounted API proofs redact token/secret/cookie/authorization/password fields.

## Verification completed in this source lease

[Eight pure source/admission checks](source-contracts-02-final.tap) pass, zero fail/skip/cancel/todo. They exercise the exact pre-owned admission prefix with an **in-memory simulated grant only**, including missing/pending/wrong hash, dependency/SQL tampering and emitted393/394 refusals. They do not import or run the owned native module and do not execute SQL.

The single full Gateway noEmit compile [passed](gateway-noemit-01.log) before a final native-only correction to aggregate all table hashes through VALUES/object aggregation, avoiding PostgreSQL's fixed function-argument limit. The exact final native root and all its transitive imports then passed the [focused semantic compile](native-semantic-final.log), using the same project options; other Gateway source was unchanged. No second full Gateway loop was run. The [final new-native ESLint report](native-source-eslint-final.json) has zero errors/warnings. These are source/type checks, **not PostgreSQL syntax, privilege, rollback, API or runtime acceptance**.

The separate [input closure](source-input-closure.json) binds1071 files,1998 literal internal edges, zero nonliteral imports, package manifests/lockfile, all321 UP/paired rollback sources, canonical runner/bootstrap/support, both candidate SQL files, current allocation/diagnostic and immutable historical inputs. The old1079 closure and old aa26 native source were not refreshed. A deliberately invalid pending admission template is provided; actual `publisher-acl393/admission.json` does not exist.

All old1079 source inputs, five catalog393 artifacts/admissions,61 factory pins and the failed-native source bytes remain exact. The original19 accepted default392 tests and107 focused updater tests were not rerun. Existing RT1…RT9, especially RT1/RT2/RT7, are unchanged; their actual default393 execution remains a later separately allocated gate, as do the full future catalog394/update role-restoration/audit/concurrency cases.

Root must independently review the exact pair, new native source, closure and receipts, then write an actual admission and allocate a fresh owned baseline392 + explicit393 candidate run. No PostgreSQL execution, emission or394 work is authorized by passing source checks. Current936e Editor, persistent Marketplace and retained Threadline preview/login/tabs were untouched.
