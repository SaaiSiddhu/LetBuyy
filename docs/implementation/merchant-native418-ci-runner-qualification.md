# Native418 CI runner and Merchant cookie fixture qualification

The Merchant read, logout and proxy unit fixtures still supplied the old cookie
constant after their runtime consumers adopted the shared environment-bound
resolver. They now import that canonical resolver. Production and staging logout
controls verify the cookie read, the forwarded cookie and the one cleared cookie;
the cookie-write refusal must actually attempt the write. Runtime source, session
policy, native418 SQL, paired rollback and provider configuration are unchanged.

The retained failed CI startup log reports Docker's predefined address pools were
fully subnetted. The unchanged-source isolated lifecycle command passed all 22
checks, including the three failed controls. Other projects' networks and stopped
container references were preserved. Original CI attempt 1 remains failed despite
all 275 database suites passing 2,243 assertions; attempt 2 was explicitly canceled when
local package qualification found the later cookie fixture failures. Neither is
a passing release gate.

A real pressure check held two additional owned default-pool networks. It
reproduced exhaustion in two lifecycle controls, cleaned up its two allocations,
and targeted no other project network. A count of networks alone was not a
sufficient capacity check. The fixture therefore supports a checked, opt-in
private network pool with a distinct `/28` per allocation. It keeps owner/run/role
labels, retries only confirmed overlapping-subnet refusals, and reconciles a lost
acknowledgement only against an exact owned allocation. Defaults remain unchanged;
there is no daemon reconfiguration or deletion of another project's network.
Host-route and Docker-subnet checks found no overlap for the proposed owned
`10.233.0.0/16` range. The corrected allocator then ran all 215 canonical pure/live suites with two
owned default-pool neighbours still live: 3,206 passed, 0 failed and 15 existing
provider-dependent skips. Both live neighbours passed identity/consumer checks
and were removed with 0 cleanup failures. An extra machine-wide inventory
assertion failed; its global before/after comparison could not attribute unrelated
network changes, so that wrapper remains failed. The corrected scoped witness
separately passed with two live neighbours and the focused real lifecycle control.
This does not relabel the failed wrapper as green.

The workflow supports an optional Unit-only runner label and a measured database
worker budget, retaining the existing general-runner fallback and hosted default
of one. Turbo declares that budget and the optional network pool in strict test-task inputs instead of silently
dropping it. A real subprocess control also proves an undeclared variable stays
excluded. No test, security/money/tenancy assertion, timeout or required gate is
removed. The owned Mac plan is two finite slots: Unit first, then one general
slot after Unit's lifecycle phase finishes, with two independent database workers
per job. Per-suite races and prepared transactions remain unchanged. The former
three-heavy-slot launch is not reused.

Local qualification on the test-only patch:

- Corrected read/logout/proxy fixture: 41 passed, 0 failed, 0 skipped.
- Complete Merchant command:323, 818 and 295 passed in its three separate phases;
  every phase has 0 failures and 0 skips.
- Unchanged runtime's predecessor-source package checks: Gateway 1,850 passed;
  Auth Core 53 passed; Accounts 73 and 6 passed in separate phases; no skips.
- Actual strict Turbo subprocess control passed; the old configuration failed
  the real dropped-budget negative control as expected.
- Final allocator/strict environment controls: 9 passed, 0 failed, 0 skipped.
- Final private-pool pure lane: 215 suites, 3,221 checks, 3,206 passed, 0 failed
  and 15 existing provider-dependent skips.
- Full governance in the owned source mirror: 114 passed, 0 failed, 0 blocked,
  0 skipped and 1 not applicable.

These are local, scoped results. Final-source governance and complete exact-source
CI, fresh admitted recovery bindings, staged acceptance, branch alignment,
production activation and actual iPhone sign-in remain independent requirements.
No hosted migration, application/flag/alias activation or physical acceptance is
claimed by this document. Recovery remains the owner's native418-only admission.
