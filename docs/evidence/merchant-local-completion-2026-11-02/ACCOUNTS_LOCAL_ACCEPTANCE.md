# Local Accounts acceptance

This is bounded evidence, not full feature or release acceptance. No hosted credentials, data, CAPTCHA or provider calls were used.

Owned PostgreSQL/PostgREST cohort `8425fff1804c` passed **40 checks in three suites**: staff lifecycle, challenge authority and store password admission. These exercise the actual mounted Gateway, constraints and current permission checks. They do not independently prove RLS or native UI.

Owned cohort `b4939cfe48a1` passed **five tests in four suites**: isolated provider admission (two), public signup (one), staff invitation browser (one), MFA browser (one). The production-built local Identity and Merchant applications use the actual Gateway and owned database. Synthetic prerequisites in staff/MFA differ from the unseeded public signup flow.

Signup proves mail transport failure/retry, wrong OTP refusal, successful verification, purpose-bound password creation, OTP/password-intent replay refusal, normal store creation and Merchant dashboard navigation. Invitation proves normal password sign-in, wrong-account recovery, explicit staff consent, current downgrade and removal. MFA proves enrollment/activation/step-up recovery after lost replies, protected refund refusal/reconciliation, cancellation fencing and stale-account denial.

Turnstile's SDK and Siteverify transport are explicitly simulated by an owned loopback fixture. The supervisor validates run/database/capability ownership, permits only its fixed preload, and blocks external fetches in that Identity process. Browser routes fulfill the exact SDK locally and refuse undeclared external requests. Tokens are random, expiring, fixture-bound and one-use. This is not proof of Cloudflare human verification. Mail is captured at the existing provider transport; it is not inbox delivery.

Both passing database cohorts report no remaining owned containers, networks or volumes. The earlier `accounts-browser-v2` failures are retained: one fixture-admission test omitted a required environment argument; duplicate client shutdown masked an otherwise completed invitation journey and left its bridge open. The owned runner was interrupted through its cleanup handler, both test defects were repaired, and v3 passed with clean disposal.

Current native catalog/isolation subset passes **102 tests** (`catalog-isolation-flutter-v2.log`). This is service/widget and transport-fixture evidence, not emulator acceptance. New local credential/cache/command isolation and canonical product-status recovery still require full-suite and integrated readback qualification.

Next: qualify magic-link/reset behavior, the new product-status recovery UI, then the remaining store/catalog/inventory and subsequent groups. Entries remain open wherever their required local UI or cross-surface proof is absent.

## Recovery follow-up

Current owned cohort `2071399380d1` passes **65 tests in nine suites**, including the earlier three database suites. These counts overlap older cohorts and must not be added together. The unseeded signup browser story now also captures password-reset delivery failure/retry, follows the real reset form, rejects expired/replayed links, revokes prior sessions, rejects the old password, signs in normally with the new password, and exercises normal magic-link sign-in/replay for an account without MFA.

Negative control `9d51e714c941` reproduced a real defect: a normal emailed magic link established a session for an MFA-enrolled Merchant without its authenticator. The existing private Gateway lookup now returns current MFA admission, fails closed on a factor read error, and never returns factor material. Identity binds the link to its recorded principal and routes enrolled/unknown MFA admission to the existing password/MFA flow before issuing any session. The updated MFA browser story proves no session is created through the link; its earlier enrollment, refund-recovery and stale-account tests continue to pass.

The complete Flutter suite now passes **812 tests**, with full analysis reporting no issues. New status selection uses existing versioned product edits with encrypted original per-product keys; it retains uncertain replies across recreation, confirms individual outcomes, and requires explicit review before reapplying conflicts. The real Products widget exercises selection, a committed reply loss and saved-request retry. Local environment guards reject hosted defaults, and local session/store/cache/command namespaces do not adopt hosted state. These remain local service/widget proofs until emulator and connected cross-surface journeys are completed.
