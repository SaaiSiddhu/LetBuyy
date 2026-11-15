# Returns presentation cohort

This continues the owner's frontend-only assignment in the same dirty worktree. The existing ReturnService, SDK, server routes, schemas and both route entries have been read. The previous implementation uses one persistent service provider, renders its list directly, discards exact pagination metadata, and has centered create/reference forms. The service has no durable list cache.

Permitted changes in the existing service are limited to read presentation: captured existing request context, latest read generation, disposal, store/record admission, current-denial retirement, and bounded current-query/page metadata from the already returned exact server count/page/limit. Preserve the existing HTTP list query/options and return type. Metadata is neither permission nor another business authority.

MerchantReturn getters and all command, security, journal and upsert method bodies remain unchanged. Do not change the missing-to-zero getter; display raw optional amounts honestly. Preserve command payloads, UI restock default true, service default false, three refund-method values, original MFA/proof/journal order, record IDs and notes.

The existing createReturn command accepts an optional idempotencyKey. The UI may retain one immutable request/key in memory across an uncertain acknowledgement and retry that same request using this existing argument. No new persistence, journal, background recovery or authorization policy is added. A process restart cannot be represented as retaining this in-memory attempt. Current owner retirement must withhold its private presentation and further dispatch.

The list will own the applied server status/page and matching rows. Query changes retire rows and counts before the new read; same-query refresh may retain explicitly unconfirmed rows with actions disabled. Current denial or invalid foreign rows removes them. Pagination uses the exact returned total/page/limit, never an assumption that a full page implies another page.

Creation is a complex full-page editor; completion reference is a short canonical sheet. Stable controllers, dirty Back, current-route callbacks, shell progress and enlarged/narrow geometry use the existing shared UI owners. No server/BFF/SQL/RLS/authentication, financial/domain, storage/infra or deployment behavior is changed. Native/web integration and the wider 119-feature programme remain separately unaccepted until evidenced.

Qualification must compare all protected service command/model bodies, original read API arguments, original typed create result fields/defaults and completion command/proof inputs against the retained Orders13 source. Populated read negatives, supersession, disposal, exact pagination, form request payload/retry, owner changes and useful layout tests supplement broad Flutter/governance checks. The existing protected Staff namespace failure remains outside this scope.

## Shared reader and already open form denial

After source4 was archived and its compile-only artifacts preserved, neighboring UI checks exercise a current service denial while an editor is already open and while an original create attempt is uncertain. Store/session identity can remain the same when current access is withdrawn. A store-view guard alone is insufficient for this observation.

The same allowed read-presentation repair includes ephemeral current-context/store denial metadata and the revision of a successful page read in the existing ReturnService. A latest denial must withhold previously displayed rows, open private forms, stale callbacks and pending-attempt presentation across every mounted reader. An outage cannot clear observed denial. Only a subsequent successful authorized read in the same current context may restore presentation. Keep the original uncertain request/key in memory while access is withheld; do not discard it, write a new journal, or dispatch it using a cached grant. Page freshness is attached to the actual accepted read revision, not merely matching counts or query labels.

Use the existing service notifier and canonical store guard/sheet/page/feedback owners. The UI still depends on server authorization for every command. All original model, command, journal, upsert, financial and storage bodies remain unchanged; no new durable authorization/recovery policy or backend change is included. These observations require a new fixed-source qualification; source4 evidence remains bounded to the checks that actually ran.
