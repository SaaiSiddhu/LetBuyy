# Proposed correction: tenant transaction and one protected publication capability

**Proposal only; not approval or implementation.** Final source release/native preparation is held. The prepared blanket-role transaction is rejected, unexecuted and must not be admitted. Its working-tree source is preserved for the reviewed correction; passing logic tests do not certify RLS. No privilege, helper, migration or protected function is changed by this proposal.

## Required correction

SEC-R9 and Constitution ART-08 require tenant data reads/writes under non-BYPASSRLS `app_tenant` with per-transaction GUC. Ownership predicates are an additional guard, not a substitute. IDN-R5 forbids deriving that GUC from raw body/query selection. The existing approved path is `resolveOwnedStoreScope` → `OwnedStoreScope.tenant` → `withTenantTx`. Reuse it for both preview/replay reads and confirmed mutation.

The route will treat body/query `store_id` only as a selection hint passed to `resolveOwnedStoreScope(c, hint)`. That canonical resolver checks the verified session principal/store binding and current ownership, builds membership/role/entitlement context and sets the resolved tenant. The execution adapter receives the resolved scope and uses `scope.tenant.siteId` and its validated actor; it must not accept a separate body-derived tenant/actor as authority. Existing error/status behavior remains explicit and source tests must exercise the canonical resolver rather than certify duplicated auth snippets.

All tenant queries move off the adapter's raw `getPooledSql`/role switch to `withTenantTx(env, scope.tenant, tx => ...)`. That existing helper starts the transaction, sets `app_tenant`, sets the validated site GUC and request GUC. Site/instance/release/receipt reads and locks, the selected-version pin, artifact enrichment and retry receipt stay in that transaction under RLS. Missing transport, inaccessible own rows or missing policies fail closed. Set any required actor/auth-sub GUC only from the validated scope, never copied from request fields. Private catalog policies currently use `auth.uid()`; any verified-subject bridge must be explicit and tested, not bypassed with a backend read.

Public/owned catalog targets must remain readable through their actual RLS policies. No fallback to privileged reads is proposed for private captures. If a current legitimate catalog policy/privilege is insufficient, report its exact positive-control failure for a separately reviewed fix; do not add permissions inside393 or normalize an empty result into success.

## Protected publisher source inspected

The effective latest source definition is migration376, not the older baseline. It preserves private drafts and already owns publication's site/release/cache/outbox/core-audit transaction. It selects the package version from the installed instance, so the outer tenant transaction must pin that verified instance before calling it. Replacing publication with a second writer or consuming private draftB through the ordinary draft-publish RPC is not a solution.

| Property | Source-defined evidence |
| --- | --- |
| Function | `public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)` |
| Source | `database/supabase/migrations/376_atomic_theme_instance_switch.sql` |
| Source SHA256 | `f9c2490cc60bde775b9298e9d4bbbae0288c00f500fe8e8a4d3028d858b53746` |
| Source-defined body MD5 | `56a6b7b15e8a7ec159341fe0331ac593` |
| Security/search path | `SECURITY DEFINER`, `search_path=public` |
| ABI/defaults | Ten inputs, three output columns, seven default arguments |
| Owner/ACL guard | Owner must match `theme_instances` owner; backend service role has EXECUTE; anon/authenticated must not |
| Grants | Migration376 revokes PUBLIC/anon/authenticated and preserves the protected ACL. No app_tenant publisher EXECUTE grant was found in migration source. |

No live database/catalog was queried: the native lane is closed. The actual owner/ACL/default AST/body/dependency profile must be read and compared in the later specifically owned qualification; unknown profiles fail closed. Root's independent finding that `app_tenant` cannot directly execute the protected publisher is consistent with the source. **No grant broadening, owner change, RPC body/ABI change or DDL is proposed.**

## Smallest additional source scope for review

Existing route/adapter and their adjacent tests remain the granted repair paths. The **one additional production edit path requested for review** is the canonical `services/api-gateway/src/lib/tenant-transaction.ts`. Extend it with one purpose-bound publication capability, rather than adding another transaction wrapper, a new logger or a generic privileged SQL callback. The existing `withTenantTx` behavior for all other callers stays intact. Existing `tenant-context.ts` is consumed, not reimplemented or edited unless an evidenced resolver defect is separately scoped.

Proposed capability API: a fixed `publishThemeReleaseInTenantTx` operation receiving the already active canonical transaction plus validated `OwnedStoreScope` and server-produced publication intent. It returns only the publisher's scalar release result. It accepts **no SQL text, function name, role name, connection factory or arbitrary callback**. Store/actor arguments are constructed exclusively from the validated scope. Its permitted reason is a fixed `theme.version_update.publish`; the body/query cannot choose a privilege reason.

Before using it, verify that the transaction's current role is `app_tenant`, its site/request GUC matches the supplied resolved scope, its authenticated actor matches that scope, and its owner/site positive control is visible and locked under RLS. Verify the exact existing publisher signature/security/owner/ACL/default/body profile through catalog metadata. Refuse unexpected profiles; never repair them automatically.

Only the fixed existing publisher invocation may run through the reviewed backend capability. The proposed same-connection sequence is:

1. Under `app_tenant`, complete current ownership, target, CAS and replay checks and lock the site/instance. A replay returns here, without privilege use or another audit row.
2. Establish an internal savepoint before the privilege boundary. Temporarily select the existing backend role only for the single fixed parameterized `publish_theme_release` statement. No caller callback, target query, receipt query, instance UPDATE, enrichment or ordinary tenant audit is allowed in that role window.
3. Restore `app_tenant` immediately after the publisher and prove role/site/actor/request context restoration before returning control. Release the savepoint only after those checks. Preserve the outer transaction and its locks throughout.
4. On publisher error, roll back to that savepoint before attempting any restoration query, since PostgreSQL aborts a failed statement's transaction context. Verify restoration or abort the entire outer transaction. Never swallow a restoration failure, return a partially usable privileged handle, open another connection, or let subsequent tenant queries continue with uncertain authority. The invocation/transaction must fail closed and its connection be disposed on restoration/connection failure.
5. After restoration, append a distinct capability-use audit under `app_tenant` inside the same outer transaction. Record fixed reason, verified actor/site/request, old/target version IDs, old/new release IDs and a request fingerprint; no credentials, bearer material, raw Liquid/config or SQL. Audit failure aborts the entire update. The existing publisher's ordinary `theme.publish` audit/outbox remain unchanged. Complete release enrichment/receipt under `app_tenant`, then commit once.

The savepoint is for safe privilege restoration; **it does not allow a partial business commit**. Any capability, audit, enrichment or receipt failure propagates and rolls back the entire outer update, including the earlier instance pin. Failed-attempt telemetry uses the already verified structured/redacted logging contract; it does not falsely claim a committed database audit after rollback.

This is a proposed realization of the rule's narrow audited hatch, not an inference that an implemented generic `withServiceRole` already exists. No app_tenant grant to the publisher or service role, new database role, public function, table, policy change, or migration is part of this proposal. If the transport/capability cannot satisfy these guarantees without a privilege/schema change, stop and return that concrete requirement for Root/ARB review.393 stays catalog-only and immutable.

## Required verification before admission

The reviewed implementation needs source tests in the existing gateway update tests and existing tenant-isolation tests, plus specifically admitted native coverage. Extending the new393 suite's existing phases can preserve its parent/eight-phase structure, but its current f06 suite bytes remain frozen until Root grants that exact source edit and repins admission.

- Positive own-row controls first; actual role must be app_tenant before/after the capability. Wrong/unset GUC, forged body store, foreign store/principal/private target and ownership changes must deny with zero effects. Existing RT-1/RT-2/RT-7 must not be weakened; apply the relevant full tenancy/security suite rather than claim a mocked result as RLS proof.
- App_tenant still cannot directly execute the protected publisher; no ACL/owner/default/body drift. Only the purpose-bound helper reaches the one fixed publisher call; invalid capability/context/reason/profile refuses before escalation.
- Same target and private-draft/history conservation, explicit exact confirmation, changed-baseline CAS, exact retry and concurrent one-effect proofs remain. Use the actual selected captured2.0.1 IDs and normal mounted route.
- Successful role/GUC restoration, publisher exception, late outbox fault, capability audit fault, enrichment/receipt fault and connection/restoration failure must preserve complete rollback and safe subsequent pooled scope. No row/receipt/audit/outbox survives a refused update. No constraint or RLS disabling.
- Retain real Date/string timestamp coverage and CODE-R3 logging: known errors/conflicts unchanged, unexpected failures internally logged with safe fields and sanitized INTERNAL_ERROR externally. The frozen native late-outbox **install** rollback assertion remains unchanged.

Current source evidence remains87 focused checks, six admission/source checks and both typechecks passing, with eight verified pre-existing lint findings and zero new diagnostics. Those totals **do not qualify the rejected transaction**. No final source release, native allocation/admission, database run, migration emission, runtime launch or browser/session action is granted by this document.
