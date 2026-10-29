# Turnstile lifecycle repair — 29 October 2026

Owner scope: inspect deployed Merchant and every active web Turnstile consumer;
research current Cloudflare behaviour; implement a professional, secure repair.
Owner clarified that the repetition affects all journeys. One agent; no schema,
payment, issuer, cookie, CSRF, tenant or rate-limit policy change.

## Current verdict

Source implementation and owned browser checks pass. Production's two missing
hostname entries were separately approved, saved and read back in Cloudflare.
The new application source is not yet production-activated. Final qualification,
staging and hosted acceptance are recorded separately below as they complete.
Do not equate a provider configuration save with deploying this source.

## Coverage and disposition

| Surface / finding | Repair and boundary |
| --- | --- |
| Merchant web | No embedded Turnstile integration exists. Actual signed-in Snaz Dashboard → Customers navigation succeeded without a challenge. This single observation does not establish that every network/browser avoids an edge challenge. No verification was added to ordinary Merchant navigation. |
| Accounts, Commerce React and both Marketing wrappers | Four SDK implementations replaced by one `@letbuyy/ui/turnstile` component and headless `turnstile-client` lifecycle; app wrappers supply only their existing runtime configuration. |
| Cold SDK loads / concurrent mounts | One pending SDK request per document; exact official SDK URL with explicit rendering, load/error handling and a 15-second deadline. A failed load requires an explicit retry, never an endless polling loop. |
| React rerenders / StrictMode / navigation | Stable callback refs, per-attempt generation checks, widget cleanup and invalidation prevent stale callbacks from restoring a prior token. A changed callback alone does not recreate the challenge. |
| Always visible status / repeated expiry reset | Managed verification uses `interaction-only` appearance; expiry refresh belongs to the SDK, with no second application reset in its expiry callback. This retains human interaction when Cloudflare requires it. |
| Used/stale tokens | Reset, timeout, failure and unmount immediately clear the form's token. Back-forward cache restoration obtains a fresh challenge. Tokens are not stored as reusable human sessions or shared between forms. |
| Marketing hidden managed widgets | Removed the `display:none` wrappers and the duplicate contact implementation. A managed challenge can remain visible and usable when interaction is required. Demo verification starts on the final step; submit waits for its token. |
| Accounts lookup / email cooldown | Lookup's account/email selection does not consume a challenge and now starts no widget; password submission retains verification. Check-email starts a widget only when resend is available. No challenge was added to OTP confirmation or verified session continuation. |
| Signup resend | Initial send failures reset the token. The OTP resend action mounts a fresh widget when its cooldown ends, instead of replaying the already-consumed initial signup token. |
| Password reset | A provider/server error no longer redirects to a false sent-email confirmation. It stays on the form with recovery feedback and a fresh token. The server's accepted response remains enumeration-safe. |
| Buyer login / recovery network failure | Both success and failure paths retire their attempt token. Buyer session, account linking and MFA authority remain unchanged. |
| Liquid native login / reviews | Both use the shared headless lifecycle without introducing a React section renderer. Native input is invalidated on expiry/error/removal. Product-page review verification starts only on form interaction or an attempted submission, not on ordinary browsing. Review network retries obtain a new token. |
| Accounts / API / mobile BFF Siteverify | One shared `auth-core/turnstile` transport validates response shape, rejects empty/oversized tokens, enforces an eight-second deadline and fails closed for HTTP/network/malformed replies. No automatic retry of a possibly-consumed token. Each runtime retains its original development and authentication policy. |
| Mobile | Existing mobile BFF proof path remains separate and is not submitted to Cloudflare a second time by Accounts. Existing native WebView sources were mapped, but this release does not change or publish a native app; physical-device challenge UX is not claimed verified. |
| Hostname configuration | Cloudflare Production Runtime initially authorized only `accounts.letbuyy.com` and `letbuyy.store`. Owner approved adding only `letbuyy.com` and `store.pixlnova.com`. Readback: four hostnames, Managed, no pre-clearance. Accounts, Commerce production and Marketing public site-key fingerprints match. No secret was displayed or rotated. |
| CSP | Existing canonical security headers already permit the official challenge script and frame origins. No broad wildcard, iframe-internal CSP workaround or WAF bypass was introduced. |

## Provider configuration acceptance

- Production widget: existing LetBuyy Production Runtime, same keys.
- Final hostnames: `accounts.letbuyy.com`, `letbuyy.store`, `letbuyy.com`,
  `store.pixlnova.com`. Cloudflare also permits child hostnames beneath each entry.
- Existing CLI OAuth lacks widget-read permission (HTTP403); the existing signed-in
  Cloudflare UI supplied the mode/hostname evidence and the approved update.
- An Enter key unexpectedly submitted an intermediate three-host form. That
  addition was restored to the original two-host list, verified, then the owner
  explicitly approved the final two additions before their save.
- Do not enable Any Hostname, invisible widget mode or pre-clearance to mask a
  lifecycle defect. Future verified custom domains need provider hostname coverage;
  the current Free limit is ten entries per widget, not unlimited custom-domain support.
- Environment records do not prove secret values. Sensitive values omitted from
  readback are classified unreadable, not missing. Public configuration only was
  compared for the deployed key groups.

## Evidence and commands

Private working evidence: `/private/tmp/letbuyy-turnstile-20261029/`.
No codes, cookies, passwords, signing keys or login URLs are included in this report.

- UI suite: 71 checks, including cold-load failure/deadline, shared loads,
  StrictMode, fresh resets, stale callbacks, concurrent forms, expiry, manual
  recovery, configuration errors and back-forward restoration.
- Auth-core: 47 checks, including Siteverify missing/oversized input, strict success,
  expired/duplicate denial, HTTP/JSON/network failure and cancellation deadline.
- Accounts source: 54 checks plus existing identity boundary/password suites.
- Mobile BFF: 17 existing transport and session checks.
- Gateway security: 12 existing CSRF, rate-limit, verification and encryption checks.
- Commerce: 2,191 checks across five existing suite segments.
- Marketing: 184 checks across its two existing suite segments.
- `pnpm test:turnstile`: one owned Chromium scenario traverses actual Accounts
  components through reset failure/retry, signup failure/retry/OTP resend and
  lookup/password retries. Cloudflare SDK and HTTP are labelled synthetic fixtures;
  this is neither a real provider solve nor hosted sign-in evidence.
- Identity, Commerce, Marketing, Gateway, BFF and auth-core TypeScript checks pass;
  auth-core requires the existing shared-types project build first.
- Initial governance observation: 113 pass, one fail because the wrapper's explicit
  development guard was inlined. Its named guard has been restored; the existing
  dev-auth validator now passes without changing the validator. The gate's cleanup
  removed generated workspace dependencies; frozen offline reinstall restored them.
  Remaining complete gates belong in the isolated qualification copy, never beside
  an active runtime/test process. The initial observation is not a final green gate.

## Hosted and release gates still open

A new source candidate needs the current complete governance/security/build gates,
staging observation, then a release decision for any specifically documented hosted
staging limitation. Earlier cart/payment/domain release approvals do not certify
this new security candidate. Final production browser verification must distinguish
normal sign-in, wrong-password recovery, signup/resend, reset, buyer continuation,
Marketing lead submission and a custom-host review challenge. No production test
email, account, order or financial operation was initiated by this repair.

Server action/hostname enforcement is not silently tightened using browser-provided
host values. The existing configured widget allowlist remains the provider boundary;
this repair adds no shared clearance/session bypass, durable human-cookie authority
or cross-origin challenge relay. Broader anti-abuse policy or mobile proof replay
changes require their own mapped callers, durable semantics and qualification.

## Primary research

Reviewed current official documentation on 29 October 2026:

- [Widget configuration](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/): appearance and execution are different controls; supported sizes, expiry, timeout and retry ownership informed the lifecycle.
- [Explicit rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/): explicit SDK loading, independent widget handles and cleanup fit SPA/native-island composition.
- [Server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/): server verification is mandatory; a token lasts five minutes and is single-use, so a retry cannot reuse it.
- [Hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/): entries cover their child hostnames; the Free configuration has a finite per-widget hostname limit.
- [Client errors](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/): invalid keys and unauthorized domains require configuration recovery instead of repeated automatic challenges.
- [CSP](https://developers.cloudflare.com/turnstile/reference/content-security-policy/): the official script/frame origin is already permitted by the canonical parent policy.
