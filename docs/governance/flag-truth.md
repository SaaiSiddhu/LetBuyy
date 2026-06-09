# Flag Truth Governance

LetBuyy feature flags are truth controls, not evidence generators.

## Rules

- A disabled flag must make the feature unavailable, not return a successful mock response.
- External integrations default OFF until credentials and provider evidence exist.
- Sandbox and mock modes are allowed only when the runtime explicitly proves it is not production-like.
- Startup checks must fail closed if a production-like runtime tries to use a sentinel, mock, or missing secret for money, identity, tax, KYC, messaging, Turnstile, DNS, KMS, or observability.
- Reports and dashboards must label planned or mocked behavior as planned or mocked; they must not use success language.

## Wave Ownership

- Wave 0 enforces no new fabricated evidence through `foundation-antifabrication-gate.mjs`.
- Wave 1 removes money-path mock defaults and fabricated payout evidence.
- Wave 3 gates external production integrations behind secret preflight and human SKIP-DEPLOY runbooks.
- Wave 4 keeps session/security flags fail-closed.
- Wave 7 records remaining external credential gaps as CLASS-A SKIPs with flags OFF.
