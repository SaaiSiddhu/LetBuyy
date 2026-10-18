# N1.6 invitation prerequisite: canonical queue authority — 15 October 2026

Invitation activation remains incomplete. This change repairs the existing worker authority that durable invitation delivery needs; it does not replace the required invitation, acceptance, device or approved inbox journeys.

## Reproduction and impact

`becc86324bea` reproduced the actual worker's `POST /v1/employees/invite`503 while confirming that ordinary roles could not read retained invitation tokens. `b2446deb3f3f` retained that missing invitation behavior and additionally reproduced ordinary `app_tenant` execution of the global `claim_platform_queue_jobs` definer using an arbitrary worker label, without a permission error. The fixture inserted a job for another synthetic store. Worker IDs are lease labels and cannot stand in for authenticated backend authority. Both are real owned-PostgreSQL/worker results; neither run is represented as green. After323, the original probe `39a5b8f26751` passes token-read denial and ordinary queue-claim denial; only the still-unimplemented invitation503 assertion fails (2pass/1fail). This preserves the open requirement rather than marking the full invitation suite green.

The shared claim/complete/fail/quarantine functions form one worker protocol. Protecting claim alone would leave ordinary callers able to manipulate a known leased job through the other methods. Migration323 therefore fences exactly those four canonical functions. It preserves their source, ABI, owner, backend execution and grant options and records exact changes in the existing private privilege journal. It neither builds a generic dispatcher nor activates a reserved service.

## Repair and recovery

Ordinary `PUBLIC`, `anon`, `authenticated` and `app_tenant` execution is revoked. Service-role execution remains available. The existing journal binds each original privilege delta to the function OID, owner and body hash. Reapply validates the whole fixed object set and each marker. Concurrent application is serialized; new ordinary-role grants, altered body/identity/owner and missing partial/whole journals refuse mutation. Clean paired recovery restores the exact prior ACLs; retained platform queue jobs refuse reopening ordinary worker authority and require forward recovery.

The owned six-case recovery suite passes actual role denials for all four methods; real backend claim, completion, retryable failure and quarantine; concurrent reapply; clean rollback/reapply; PUBLIC-inherited backend execution and named grant options; drift/journal refusal; and retained-job preservation. The full-chain definer recovery suite now reverses323 before its predecessors and reapplies it last. Current run `ae3ff96d032f` passes both six-case suites,12/12 total, zero skips/TODO and no remaining owned resources. The current Gateway typecheck, owned lane inventory12/12, migration-safety guard and tenant-isolation guard pass. Source/configuration and exact recovery evidence are retained in `Verification/LetBuyy-Codex-Continuous-Run-2026-10-14/N1.6`.

## Next implementation, with the accepted scope intact

The existing `employee_invites` table is the invitation owner, and migration250 already repointed its inviter FK to `users_custom`. Its baseline schema lacks store/member binding and the maintained store-role choices. Complete it with a paired next migration rather than reintroducing GoTrue or inventing a second membership or session issuer.

A durable invitation must save pending membership, a scoped expiring invitation, lifecycle audit, stable receipt and existing-authority queue job in one transaction. Acceptance must use a normal verified canonical account, an explicit consent action, current store/inviter/member/grant version, expiry/revocation and token proof. Replay, wrong account/site, stale permissions, owner transfer, concurrent seat consumption and revoke-versus-accept must be covered. Preserve the existing verified-account direct-add capability.

Delivery belongs in the modular monolith and `queue-workers`; `notification-service` remains frozen and empty. The current worker recognizes `email.employee_invite`, but the actual durable invitation producer/consumer connection is missing. A source-inspected direct-email branch currently logs missing Resend configuration and continues; do not mistake that for successful delivery or use it to drop a new invitation job. Missing provider configuration must retain a retryable/failed record, and a wakeup failure must not lose the durable job.

Provider retries must reuse an unchanged message and key within the provider's supported window. Resend documents a 24-hour idempotency window and the SDK's second-argument `idempotencyKey` option in its [official idempotency guidance](https://resend.com/blog/engineering-idempotency-keys). This research is implementation input, not provider/inbox proof. `ACCESS-RESEND-V1` remains owner-confirmed pending; do not ask again or send real messages without the approved environment/inbox.

All63 execution packages,77 acceptance mappings and103 feature dispositions remain unchanged. N1.6/N1 and the native Goal remain in progress.
