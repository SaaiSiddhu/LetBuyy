# N1.6 runtime-command safety and next staff reproduction — 2026-10-15

> Evidence correction: the original staff suite’s four failures were fixture collisions (`sites_store_name_key`) before those probes executed. Only its positive staff creation/profile test was proved. The raw mixed run is retained. Subsequent corrected exact-source run `37a1e21f52ef` validly reproduced all four hypotheses; current repair/browser evidence is in [the staff lifecycle report](N1_6_MERCHANT_STAFF_LIFECYCLE_2026-10-15.md). Runtime safety/recovery results are unaffected.

## Verdict and retained programme scope

This is a **safety closure**, not delivery or acceptance of runtime command execution. N1.6/N1 remain open. The accepted operational ownership, independent consent, actual effects and normal-operator rehearsal requirements remain in the original programme (including N9.5 and the audit/compliance/incidents feature disposition). No original acceptance requirement has been removed or reclassified as frozen.

The existing generic command producer writes `runtime_control_commands`; its baseline claim RPC exists, but no wired source consumer of the command table/claim RPC was found. Runtime-manifest ownership prose is not proof of an operational effect. The advertised schema includes cancel/retry-workflow operations associated with prohibited machinery. The Constitution’s existing monolith/queue/outbox owners remain authoritative; no generic dispatcher, workflow engine, reserved runtime or provider control was activated.

## Actual reproduction and correction

Actual worker/PostgREST/PostgreSQL run `8ca469daba36` failed all3 probes. An eligible operator supplied a second person’s UUID and received command acceptance without independent consent. A failed audit left the accepted row persisted. An actual app_tenant role could call the global claim definer and change command state. All data was synthetic in disposable infrastructure; no provider or live runtime was controlled.

The legacy command POST now returns explicit503 `RUNTIME_CONTROL_UNAVAILABLE`, after the existing caller permission/payload checks, without inserting a command or fabricating approval metadata. The maintained Console no longer offers the typed-ID submission form or claims commands are executed by a control plane. Its unavailable explanation preserves historical records and distinguishes a stored status from independent approval or an actual effect. This does not make the underlying operational feature complete; its canonical approval/effect integration is still required.

Paired migration320 removes PUBLIC/anon/authenticated/app_tenant execution of `claim_operational_control_command(text,integer)` while preserving effective backend execution/grant options, the exact function definition/owner and all command rows. Its exact table-owner-authored ACL deltas and original identity/body hashes live in the existing private privilege journal. Reapply and rollback refuse changed identity, owner, body, unexpected grants or missing/altered journal. Fully missing recovery evidence also fails explicitly when the authority is already closed; it cannot be resealed as an empty preimage. Clean rollback restores exact source grants/options, while retained commands require forward recovery. The predecessor final-definer recovery test explicitly reverses320 before the older identity-bound journals.

The backend-only legacy claim primitive remains source-kept, not wired or certified as a real command consumer. Historical records and its claim/result semantics need reconciliation with the eventual canonical operational owner. No queued row, synthetic acknowledgement, dormant schema or manifest prose is provider/execution proof.

## Verification and lineage

Evidence root: `/Users/saai_mithra/Projects/LetBuyy-Workspace/Verification/LetBuyy-Codex-Continuous-Run-2026-10-14/N1.6`.

- `runtime-command-reproduction.json`: `8ca469daba36`,0/3 pass,3 failures establishing the actual unsafe boundaries.
- `runtime-safety-current.json`: `10558dbed095`,15/15 pass: command safety3, exact claim ACL recovery6 and predecessor final-definer6. Owned cleanup completed.
- `runtime-final-staff-reproduction.json`: `140702a4e258`, final320 recovery6/6 passes, including complete-journal deletion refusal. Its separate new staff suite passes1; four fixture collisions prevented the remaining probes from running. This is not proof of four staff defects and the mixed run is not green.
- Gateway fast lane:1432 tests,1431 pass,0 fail,1 retained TODO `LB-BIL-002`. Gateway/Console types pass. Maintained Console production build and44 tests pass. Current boundary/issuer/tenant/migration/dev-auth and explicit lane/route results are in `runtime-final-guards.json`.
- Private candidate source is synchronized and its safe-source manifest is checkpointed separately. The immutable63-package,77-original-package and103-feature authorities remain unchanged. No commit, reset, push, merge, deploy, real message, provider transaction or unrelated resource cleanup occurred.

Provider-sandbox delivery remains owner-confirmed pending as `ACCESS-RESEND-V1`. No normal runtime-command execution, device, hosted or full programme acceptance is claimed by these denial/recovery checks.

## Next actual-worker staff findings

The new `merchant-staff-lifecycle.postgres.test.ts` uses real worker mounts, signed identities, real PostgREST and owned PostgreSQL. It is explicitly not a normal browser sign-in or inbox-delivery proof. The real owner’s verified limited-staff creation and that user’s own employee-profile read pass. Four source hypotheses still require valid runtime reproduction; `140702a4e258` and `ad78f54bb083` failed these probes during fixture setup:

1. Test whether an unknown canonical subject inherits the owner through an asserted matching email (`resolveCustomUser`’s email fallback).
2. Test whether an active-text but `is_active=false` employee still enters the store shell.
3. Test whether active staff can discover their accessible store in the normal store-picker list.
4. Test whether a failed mandatory lifecycle audit leaves newly created access persisted.

Source inspection also finds the retired invite/accept503 path, a misleading web “invite sent” label, non-atomic seat counting/creation, and divergent staff active checks. Those findings require the coherent canonical staff lifecycle repair, not a label-only completion. The current startup contract explicitly requires full own-login invitation/revocation/permission journeys; stale comments describing the retired implementation do not override it. Implement through the existing identity/auth-core, employees/invitation ownership and maintained web/Flutter clients, preserving limited grants, wrong-site denials, retries, race safety and truthful provider verdicts.

The corrected fixture assigns each synthetic store a unique numbered tag. Its reproduction uses exact pre-repair source hashes for auth-user/stores/staff-permission, checked against the9425 safe-source manifest. Prepared fixes remain in the base checkout; the private candidate is temporarily restored to that baseline, with an explicit backup/restore record before any test.

## Subsequent staff resolution

Corrected baseline37a1e21f52ef reproduced the four actual worker failures. Canonical ID/active/discovery321 and atomic lifecycle322 repair them. Current normal owner/staff browser plus atomic fault/retry/race/role/recovery checks pass19/19 in1cdcfa0b3b13. [Current scoped report and remaining invitation/device/provider requirements](N1_6_MERCHANT_STAFF_LIFECYCLE_2026-10-15.md). The historical fixture correction above remains applicable to140702a4e258/ad78f54bb083; their collisions are never counted as runtime defects.
