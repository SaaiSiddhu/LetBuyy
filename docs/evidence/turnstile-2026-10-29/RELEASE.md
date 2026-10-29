# Production activation — 29 October 2026

Qualified runtime source: `55975acd0da3fd39bcff56168e19b05ff598bc43`.
This documentation follow-up records the completed activation; it changes no
runtime, schema, provider configuration, credential or business policy.

## Authorization and qualification

The owner approved this exact Turnstile release and accepted the documented
TEST-R8 hosted/CI limitations in `call_86b8b5702ef94dcca2aa54956058dab3`.

- Final governance: 114 passed. Root contract tests: 362 passed.
- Full owned PostgreSQL invocation: 266 suites, 2,163 passing checks and three
  cancellations in `operator-mutation-integrity.postgres`. There were no failed
  assertions or skips. The original invocation remains recorded as failed.
- The sole affected fixture was corrected to reserve the actual aggregate
  rate-limit admission time before concurrent request barriers. Production
  middleware, actors, rate limits and assertions were preserved. Its exact rerun
  passed all 12 checks. All other tests and production source were unchanged.
- The composed qualification therefore covers 266 unique suites and 2,166 passing
  checks, with no unresolved failure, cancellation or skip. Both runs cleaned up
  their owned database resources. This is not a claim that the original full
  invocation itself passed.
- Twenty native SQLite Durable Object/domain checks passed. The complete owned
  Merchant, theme, buyer and checkout browser journey also passed inside the full
  invocation. SDK/provider fixtures in those browser controls remain synthetic.
- Staging API/BFF and encrypted configuration were deployed. Fifteen hosted HTTP
  health/negative checks passed. A real Cloudflare staging-widget adapter canary
  added only the approved QA hostname and independently checked settings readback.

## Production activation and readback

Remote `develop`, `staging` and `main` were fast-forwarded to the qualified source.
The isolated release clone proved `main..staging = 0`; the user-edited primary
checkout was preserved. Duplicate automatic builds from those exact pushes were
cancelled while retaining the prepared production artifacts and live aliases.

| Runtime | Active artifact/version |
| --- | --- |
| API Worker | `c019c298-aa8d-4b34-8c0a-46d8f2743a02` |
| Mobile BFF Worker | `984c46ab-17d9-4a8b-9320-9a089fcfef84` |
| Accounts | `dpl_bLKMyqtNFgjZYVWYU9EP4BwaXJCN` |
| Merchant | `dpl_2JupiBEshwA1dMjtKRKQbDdPn7iF` |
| Commerce | `dpl_3uTkusfsJN4PY7EZdQgV4EQNGsSi` |
| Marketing | `dpl_5mfMjBSLECNWxYHQK4rsy2yG7nFU` |

The web artifacts were built from `a72196c6e`; the Worker modules were built from
`e9aa14379`. Exact diff inspection proves the later candidate changes are owned
test infrastructure, one test fixture and lease documentation, with unchanged
production build inputs. Uploaded Worker module hashes were independently read
back and matched. All web promotions reused production-target READY artifacts.

The API's encrypted management binding replaces only the confirmed disabled
Twilio placeholder, retaining Free's 64-variable limit. The BFF's previously
absent verification binding now uses the existing production widget secret.
Every other binding and existing secret name was preserved. The widget's four
hostname entries, Managed mode, no-pre-clearance setting and Siteverify secret
were independently confirmed unchanged.

The first Worker upload stopped before Wrangler deployment because the
repository's explicit production consent flag had not been supplied. Independent
version/etag readback proved no code upload occurred. The approved retry supplied
the flag backed by the recorded owner decision; both uploads then passed.

## Observed production acceptance

- Fifteen API/BFF checks passed: healthy services, configured BFF verification,
  refusal of missing/invalid/oversized/bypass-shaped proofs, and authenticated
  store/domain command boundaries.
- All 21 configured web domain assignments were verified. Eighteen production
  assignments point to the approved artifacts; three staging assignments stayed
  on their prior staging deployments.
- Six public route checks passed: Accounts lookup/signup/recovery, Marketing,
  the custom-store login route and the wildcard QA storefront.
- In the current Saai Chrome profile, the existing authenticated Accounts session
  reached the store chooser, then Snaz's real Merchant dashboard without an
  unnecessary challenge. This is existing-session continuation evidence.
- Snaz's domain detail displayed ownership verified, DNS routed, SSL active,
  **Customer verification ready**, and live/secure. Its checkout status displayed
  `checkout.store.pixlnova.com` as HTTPS ready.
- The owner separately confirmed **“Fresh sign-in worked”** in
  `call_6cd656f48c7e4aaaa2572569a8d77517`. Passwords and codes stayed private.

## Operating limits and remaining boundaries

- Future platform store subdomains inherit the existing platform-root widget
  authorization. External domains register only after the existing ownership,
  routing and HTTPS checks, through the configured environment's widget and
  existing durable coordinator. Capacity/provider failures and uncertain writes
  stay explicit; verification is not bypassed.
- Free currently permits ten hostname entries per widget. Production uses four.
  The account-scoped management credential expires on **27 January 2027** and
  requires renewal. It is retained encrypted; no secret value is tracked here.
- GitHub's final-commit Governance job could not start because billing/spending
  limits blocked it. The current annotation confirms this; hosted CI is not green.
- Full hosted staging Accounts/Merchant sign-in remains unconfigured. The real
  provider canary and owned browser/database controls were separate gates. A new
  authenticated external-domain onboarding journey on production has not been
  demonstrated by the existing Snaz readiness observation.
- This does not claim individual real submissions of every signup/resend/reset,
  Marketing lead or review form, or physical mobile-device acceptance. No real
  lead email, review, account, order, payment or native release was initiated here.
- No migration, paid upgrade, new widget, Any Hostname mode, shared human-cookie
  authority, MFA/CSRF/tenant weakening or managed/live payment activation occurred.

Private receipts and encrypted recovery material are under
`/private/tmp/letbuyy-turnstile-20261029/`. The exact release review, composed
database receipt, Worker/web deployment receipts, alias/widget readbacks, browser
observations and original failed attempts remain distinct. Earlier production
Worker versions and web artifacts are retained for recovery.
