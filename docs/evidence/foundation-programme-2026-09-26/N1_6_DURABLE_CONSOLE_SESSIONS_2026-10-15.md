# N1.6: durable Console session binding and approval storage

Date: 15 October 2026. Candidate: `letbuyy/phase2-shared-buyer-identity` at
`0862687a5008d604d0df23357b2eb511293139fa`, plus the preserved working overlay.
This is implementation and bounded local evidence. N1.6, N1 and the programme
remain open. All 63 execution packages, 77 original packages and 103 feature
dispositions retain their existing acceptance requirements.

## Confirmed defects and changes

The actual Gateway merchant-moderation path accepted an unknown, inactive,
ordinary-staff or eligible-but-unconsenting second person's UUID and suspended
the synthetic site. Run `f0c80e82e410` had 2 passing denials and 4 failing consent
checks. **That typed-ID route bypass remains open.** A session binding or table
privilege correction alone is not independent approval.

Ordinary `anon`, `authenticated` and `app_tenant` roles could also manufacture
same-site approval records. Migration 313 now fences the existing
`sensitive_action_approvals` table, preserving backend writes and journaling
actual table/column privileges, grant options, identity and definition. Its
paired rollback restores only that exact original authority and refuses drift.
The initial reproduction was 1 pass / 3 failures (`25096362e960`); the seven
recovery tests pass in `b26bd8939b83`. The broader table assertion was corrected
to distinguish writable backend approval authority from read-only source
evidence. The final-table suite then passed 8/8 in `a7cbae267a54`.

The Console's existing signed platform cookie now carries a unique session ID
and MFA timestamp. The Gateway verifies that credential with the configured
Console session secret, and migration 314 binds its digest to the existing
`principals`, `account_links` and `sessions_v2` owners. This does not activate
the dormant in-memory session service or change Identity's asymmetric issuer,
merchant authorization, buyer identity or the owner's seven-day legacy
store-customer compatibility decision.

Session registration resolves a verified canonical account and active platform
membership. Typed user/MFA payload fields are refused. MFA rotation requires
the same person's live predecessor session and atomically replaces it.
Registration, its mandatory audit and identity creation are one transaction.
Registration retries return the same session without duplicate records or
audits. Logout revokes durable authority before reporting successful sign-out.
An audit receipt prevents registration from resurrecting a previously issued
cookie after a canonical principal deletion cascades its session row.

Membership removal, downgrade and identity/principal changes revoke existing
admin sessions. Restoring a membership, verification flag or principal status
does not reactivate those cookies. The identity-change trigger has narrowly
scoped definer authority, pinned search path and no ordinary-role EXECUTE;
it can revoke only admin Console sessions associated with the actual changed
user/principal row. Ordinary roles cannot forge global principals or sessions,
including with valid tenant context and their own subject claim.

Console server pages/actions, API handlers and the proxy consult current
durable session state. The proxy no longer clears a signed cookie merely
because storage is unavailable: access is denied, the retry credential remains,
and login does not redirect back into a protected-page loop. MFA also checks
the current Console email allowlist before issuing its elevated session.

## Current bounded proof

Raw sanitized results are under the existing continuous-run directory:
`Verification/LetBuyy-Codex-Continuous-Run-2026-10-14/N1.6/`.

- `session-baseline.json`: missing durable endpoint reproduced, 0/1 passing.
- `session-first-fixed.json` (`4c5248a44e35`): registration, MFA rotation,
  cross-worker validation and irreversible logout pass through the actual
  Gateway, PostgREST and PostgreSQL.
- `session-revocation-fixed.json` (`f8aeff58a3a4`): 8 session checks plus
  8 final-table checks pass. This includes real MFA races, registration retry,
  membership revocation, role denials and actual audit-relation outage/recovery.
- `session-identity-revocation-baseline.json` (`0df70e0b3c06`): principal
  disable/re-enable resurrected its cookie; a separate invalid synthetic tag
  prevented the newly strengthened valid-tenant test from running. Both failures
  are retained, without relabeling the fixture error as product proof.
- `session-identity-recovery-fixed.json` (`0905131d53fd`): all 10 expanded
  session tests and the actual browser journey pass. Four legacy definer
  recovery checks correctly refuse to roll migration 309 back while 313 still
  owns its journal columns. The fixture now reverses both later journals in
  order; its separate rerun `definer-later-journal-recovery.json`
  (`69cdab3a8688`) passes all 6 checks, including the final closed definer ACLs.
- `console-browser.json` (`53a69284b6ce`): normal local development magic-link
  form, actual per-user TOTP, browser restart, logout and replay denial pass;
  the four client resource-ownership checks also pass.
- `console-browser-recovery.json` (`787bad530203`) retains the actual browser
  outage failure: the proxy discarded the cookie during storage unavailability.
  The corrected browser in `0905131d53fd` passes actual RPC privilege outage,
  exact ACL restoration, sign-out retry and stale-cookie denial, with 43 Gateway
  calls, two durably registered sessions and zero active sessions after logout.

The browser uses ordinary local forms and the app's visibly labelled local
development magic link. No external email is sent, no MFA bypass is enabled,
and no cookie/token/API injection supplies the positive journey. Restart and
the negative replay use state captured from that real browser login. This is
**local development browser proof**, not provider delivery or a hosted login.
Production compilation is recorded separately. Unit transport fixtures are
explicitly marked and are not substituted for these database/browser results.

The same browser logs also expose existing HTTP 500s from Console `/summary`
and `/analytics`: their global `sites` counts use the ordinary tenant-guarded
client without an appropriate operator read contract. The authentication test
does not certify those dashboard data reads. Preserve the tenant guard; repair
these with canonical live operator permissions and scoped aggregate reads as
part of the remaining operator journey.

The private client supervisor accepts the fixed Console root, loopback API
URLs and a per-process Next output directory. Hosted URL overrides, app env
files and arbitrary executable/loader overrides are refused. Only owned
process groups and labelled fixture databases are stopped. Restored containers,
other chats' emulators, shared ADB and original environment files remain intact.

## Remaining acceptance and exact next action

Provider inbox delivery remains owner-confirmed pending (R10). Production login
continues to fail closed without its approved delivery wiring; compilation is
not a provider verdict. MFA recovery/enrollment, staff own-login invitations,
full permission journeys, device/hosted checks and independent acceptance remain
open. This work does not establish distributed TOTP replay/attempt custody or
complete the Console configuration-allowlist lifecycle.

Next, replace typed-ID approval with the canonical approval request, independent
authenticated super-admin consent, exact action/payload/session/expiry binding,
atomic mandatory audit/effect and replay-safe result. Reuse the canonical
permission resolver and existing `merchant:suspend` scope; do not invent a
parallel permission matrix. Preserve all protected families: merchant and
developer suspension, refunds, payouts, reconciliation, trust reinstatement
and runtime commands. Prove allowed independent execution beside self,
unconsenting, stale/revoked, payload/target substitution, concurrency, retry and
recovery denials. No package or phase is closed by this checkpoint.
