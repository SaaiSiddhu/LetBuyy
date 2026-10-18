# N1.6 — independent money-resolution consent, 15 October 2026

Status: implemented and scoped local/API/database/browser verified. N1.6, N1 and the full programme remain open. This is operator review of an existing reconciliation break, not provider reconciliation acceptance or a new accounting writer.

## Reproduction and resulting behavior

Real worker/PostgREST/PostgreSQL run `e03d35d6626c` contains4 tests:1 passes and3 fail. An eligible but unconsenting approver UUID authorizes a resolution; a bridge plus supplied actor fields authorizes it without a human session; and an unavailable mandatory audit still returns200 after persisting the annotation. The correctly passing case proves the developer/app ecosystem remains404 under its unchanged default freeze.

Migration316 reuses the existing approval table, durable Console sessions, permission snapshot, independent decision/read functions, payload hash and immutable intent/receipt controls introduced by313–315. It adds two private invoker RPCs for money request creation and atomic execution. It creates no table, issuer, provider, ledger writer or runtime.

The exact resolution, reason, provider reference and optional canonical journal reference are bound to the requester session, target store, source reconciliation state and payload hash. A different current active platform super admin consents with their own current MFA session. The ten-minute window is shortened by the remaining requester/checker session and MFA windows. Journal references are checked against the target store and rechecked before execution; they are references for human review, not proof that a provider settled funds or that a suspense balance is remedied.

The canonical shared permission vocabulary now includes `money:reconcile`. The existing admin tier includes it; lower default tiers do not. Explicit named grants use the existing permission resolver, source witness, session revocation and break-glass provenance. Queue reads require the existing `payout:view` scope plus an actual live Console session. The sole cross-site query is paginated, restricted to the reconciliation projection, optionally filtered by store, and registered in the existing operator-read contract. No ordinary tenant guard is disabled. Audit actor identity and actor type derive from the actual human session.

Execution rechecks both sessions, current independent-super-admin eligibility, the canonical permission witness, exact intent, expiry and reviewed reconciliation state under locks. Annotation or the existing canonical refresh, mandatory audit, retained approval receipt and grant usage commit together. Acknowledgment/provider explanation leave the break mismatched. Request-recheck calls the existing canonical reconciliation refresh; only that calculation can produce verified variance0. This workflow never invents an adjustment journal or moves provider funds. Retries return the stored receipt with one effect.

## Normal Console path and failure recovery

The existing finite approval BFF now dispatches request,request-money,decision and execute. It retains the same strict Origin check, durable cookie gate and shared transport schemas. Approval consent and business effects remain Gateway/database-owned. The inventory stays214 routes; this is one existing dynamic proxy route with a fourth explicit operation, not another endpoint owner.

The money page replaces the typed second-approver field with an independently reviewed request. The review page displays the store, resolution, reason, variance, wallet projection, canonical payable and evidence references before consent. The existing client form retains the same request/approval packet on errors. Native303 fallback remains available.

`fd0a2d2bd63d`:20 workflow tests pass and the new read-outage test fails. The old read returns500 with the injected raw relation detail. Source also contains zero-valued/healthy metric fallbacks on that error path. The correction removes the empty-local-schema fallback from this financial route, returns a sanitized503, and displays unavailable financial metrics/queue. Browser proof below verifies the corrected actual outage and recovery; no provider availability is inferred.

## Current evidence

- `d99270f4c0b4`:23/23 pass, zero skips. This consists of21 real money API/database tests,1 normal finance-admin/super-admin browser journey and1 current merchant browser regression.
- Money browser:133 real Gateway calls; visible local-development magic-link sign-ins and two distinct TOTP factors; no positive cookie/token injection. It reviews exact money evidence, obtains independent consent, loses only the reply after the actual execution committed, retries the same form and observed packet, and proves one effect audit, zero journal mutations and an unchanged mismatch. It also proves three unavailable metrics, sanitized projection failure, recovery and sibling-Origin denials.
- Merchant browser:111 real Gateway calls; original independent consent, lost committed request reply, retained intent/key and JSON/native replay remain verified.
- `4cbb8778d401`:30/30 pass including money20,approval recovery8 and both browsers before the final read-outage case. `33d3bbba248e`:the corrected actual employee audit attribution passes the20-case workflow.
- `ded3f9cf330e`:money17,merchant21 and final-definer6 pass. Approval recovery7/8 exposes a repeated316 rollback referring to a column already removed by315. The rollback now checks column presence; the later8/8 recovery verifies the fix. The historical combined run remains failed.
- Material money cases cover all three resolutions, self/ordinary-checker denial, missing session/consent, exact payload/site/requester binding, scope and role injection denial, creation idempotency/conflicts, concurrent separate-worker execution, actual audit/receipt failures and retry, checker revocation/re-addition, fresh requester session, changed source projection, unknown journal reference, already-verified rows, actual remaining checker MFA expiry, named permission removal between Gateway and SQL, actual ordinary-role RPC denial with a valid site GUC, retained-evidence rollback refusal and concurrent forward reapply.
- Current Gateway and SDK typechecks and Console production build pass. Console32 unit plus12 session/federation checks pass. Canonical RBAC/operator-read11 checks and lane/API-inventory18 checks pass. The lane inventory explicitly includes both new suites; compiler warmup uses fresh unknown UUIDs rather than fixed sentinels. Neither guard is weakened.
- Domain boundary214, sole issuer, tenant isolation302 with zero direct service-role bypasses, migration safety and dev-auth guards pass. Diff whitespace review and the safe-source checkpoint conserve the existing overlay and immutable63/77/103 programme authorities.

Detailed JSON and logs are in the enclosing workspace's `Verification/LetBuyy-Codex-Continuous-Run-2026-10-14/N1.6/`. Failed reproductions and intermediate failures are retained.

## Scope retained for continuation

The app/developer ecosystem remains FROZEN under the103-feature authority and startup contract. Its positive ecosystem journeys are not an accepted V1 activation; default404 is tested without setting an activation flag. Conditional source security requirements are retained for a separately accepted activation. No dormant family is represented as positively verified.

The refund.approve/payout.release names also occur in merchant-scoped own-money MFA flows. Those realms, ownership checks and N6/N7 provider/financial acceptance remain separate requirements; this operator policy does not silently impose a new platform approval rule on every merchant refund or transfer.

Next live operator review:trust-and-safety reinstatement, including its actual Console/operations ingress, original-reviewer segregation, case/takedown ownership, restoration state, mandatory audit and atomic recovery. Runtime control commands require their existing accepted/frozen topology classification checked before any implementation or activation. Staff own-login/invite/revoke/permission journeys, recovery and the remaining protected actions remain open. Console global summary/analytics guard defects are separately retained. Resend access remains owner-confirmed pending as ACCESS-RESEND-V1; no email/provider, device, hosted, release or complete programme acceptance is claimed.
