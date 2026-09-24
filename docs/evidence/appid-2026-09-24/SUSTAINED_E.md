# SUSTAINED-E — operator identity: investigation, a BLOCKED_DECISION, and one bounded fix

Branch `letbuyy/sustained-e-console-mfa-hardening`, base `ceb2d4c` (develop, includes merged
SUSTAINED-B/C/D3).

## What was investigated

The owner's SUSTAINED-E directive asked to wire `apps/internal/console`'s login through
identity-platform, enforce operator eligibility from platform authority, and enforce MFA/step-up —
while explicitly forbidding "an independent console password store or token issuer" and inventing
a security-sensitive MFA/bootstrap/recovery policy.

Measured, not assumed: `apps/internal/console/src/lib/console-auth-server.ts` (now split; see
below) already owns a **complete, independent** authentication system — its own email allowlist
(`PLATFORM_CONSOLE_ALLOWED_EMAILS`), its own hand-rolled TOTP (`PLATFORM_CONSOLE_TOTP_SECRETS`),
and its own session cookie (`console-session.ts`) — with zero calls to identity-platform anywhere
in the flow. This is exactly the "independent console password store" the directive says never to
create. It predates this phase; nothing in SUSTAINED-A through D3 touched it.

It is also **not live**: `login/route.ts` explicitly refuses outside development —
`if (process.env.NODE_ENV === 'production') return redirectWithError(request,
'magic_link_delivery_not_configured')` — because no email-delivery provider is configured for it.
This matches `CLOUD_HANDOFF.md`'s own known-gaps list: "Operator sign-in, MFA and step-up:
APPID-P5a, not started."

## The decision recorded as BLOCKED, not invented

Replacing this scaffold with a real identity-platform-wired operator realm — first-party
authorization code + PKCE for the console client, platform-authority-only eligibility, real
MFA/step-up policy, a bootstrap path for the first operator identity — is comparable in scope to
`APPID-P4a` through `P4d`, the equivalent buyer-identity work, which took **four separate dedicated
phases** to design and ship safely. It requires the owner's word on: which MFA/step-up mechanism is
canonical for operators, how the first operator account is bootstrapped without a seeded production
credential, and what the recovery path is when a factor is lost. The directive is explicit that
this session must not invent that policy. Recorded here as `BLOCKED_DECISION`; not attempted.

## What was fixed instead — a real, bounded, safe gap in the existing scaffold

`verifyConsoleTotp` had none of the three properties an OTP check needs against a live guesser:

1. **No lockout at all.** A caller holding only the pre-MFA session cookie (set the moment the dev
   magic link is followed, before MFA) could `POST /api/console-auth/mfa` without limit — 10^6
   possible codes, 3 valid 30-second windows accepted per submission, and nothing ever counted a
   failure.
2. **No replay rejection.** The same valid code could be resubmitted any number of times within its
   ~90-second acceptance window.
3. **A plain `===` comparison** — a per-character timing side-channel.

None of these three needs the identity-platform migration decision to fix; they are properties of
this one endpoint.

## What changed

`console-mfa.ts` (new): the allowlist/TOTP logic extracted from `console-auth-server.ts`, with no
`server-only`/Next.js import — the original file's `import 'server-only'` throws when imported
outside a Next.js Server Component context, which is why this logic had **zero tests** before this
phase (nothing could import it from a plain `node --test` run). `console-auth-server.ts` now
re-exports everything from it; every existing caller is unaffected (confirmed by a clean package
typecheck).

`verifyConsoleTotp` now: locks a principal out for 5 minutes after 5 failures; refuses a code whose
30-second window has already been accepted for that principal, even if the comparison would
otherwise succeed; compares with `node:crypto`'s `timingSafeEqual`. The MFA route surfaces a
distinct `too_many_attempts` error on a locked attempt, and does not touch session state.

**Honestly stated limitation:** the lockout/replay state is an in-memory `Map`, process-local. A
real multi-instance deployment needs a shared store (KV/Postgres), which this app has none of wired
today (no identity-platform integration at all). Documented in the module's own header as a floor,
not the final answer — the correct final answer is the identity-platform migration this phase
deliberately did not attempt.

## Proof

`apps/internal/console/src/lib/console-mfa.test.ts`, 8 tests: a valid code is accepted, a wrong one
refused; the identical valid code resubmitted is refused as a replay; a 6th attempt after 5
failures is locked out even when correct; a lockout is scoped to one principal (a different email's
attempt is unaffected); a success clears the failure count (an unrelated later run of failures
needs its own 5, not a resumed total); no secret configured and a malformed code are both refused
without reaching the crypto path.

Real revert-and-watch: disabling just the lockout check (`if (false && lockState && ...)`) failed
exactly the two lockout-dependent tests, leaving the other six green — proving the tests are
specific to the property they claim to prove, not a coincidence of test order. Restored; 8/8, diff
clean.

## Validation run

- `npx tsc --noEmit` (package-scoped, `apps/internal/console`): clean.
- `pnpm run typecheck` (repo-wide, turbo): 81/81 successful, unchanged.
- `pnpm --filter @letbuyy/admin-web run test`: two chained invocations, both exit 0 — this phase's
  new `console-mfa.test.ts` (8/8) then the central `tests/federation/admin-web-thin-client.test.mjs`
  + `tests/auth/session-verifier.test.mjs` (11/11, unchanged).
- `pnpm --filter @letbuyy/admin-web run lint`: exit 0, 0 errors, 114 warnings — the same count
  `CLOUD_HANDOFF.md` §7 already documented for this package; unchanged.
- Not run standalone this phase: the full repo-wide gate. This phase's diff is two library files
  plus a route file plus a test file plus one package-script line, already covered precisely by the
  package-scoped `tsc`/`test`/`lint` runs above.

## Not done

The identity-platform migration itself (`BLOCKED_DECISION`, above). Operator RBAC-from-platform-
authority-only, step-up on sensitive operator actions, and audit-event coverage for the new
lockout/replay outcomes are all part of that same larger, undecided piece — not started.
