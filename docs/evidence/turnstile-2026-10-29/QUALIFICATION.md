# Qualification observations

Source and provider observations are separate gates. The historical observations
below culminate in the [production release record](RELEASE.md), including the
retained failed full invocation, exact fixed-suite rerun and hosted limitations.

The complete owned-database run at `d89e8ee81` executed 265 suites (2,131 passing
checks, 30 failing checks in twelve suites, no skips). Its failures were retained
under `/private/tmp/letbuyy-turnstile-20261029/database-final-*`; this is not a green
deploy gate. The independent governance run at that revision passed all 114 gates.

Repairs to release controls, without changes to production guards:

- Buyer browser journeys observe the real automatic PKCE redirect instead of
  clicking an intermediate link removed by the accepted identity release.
- Console 362/363 retirement tests use their exact historical catalog profiles.
  Their current-stack mounted browser counterparts retain the full migration chain.
- Theme compatibility records identify the accepted Circuit-default export and
  identity/email workspace dependency. Original admission, proposal, default
  package and 2.0.0 package byte checks remain immutable and execute unchanged.
- Signup tests extract the delivered OTP from both branded message bodies; the
  current subject intentionally contains no code. No database OTP is substituted.
- Operator-mail checks use the canonical branded sender. Whole private field
  names, actual target factor fingerprints and capability URLs remain forbidden;
  an innocent CSS comment containing "counterpart" is not a private TOTP counter.
- Core/preview browser fixtures give Commerce the same exact local TLS checkout
  origin as the Gateway, satisfying the existing origin guard.
- Loyalty replay tests use a schema-valid different status to reach the 409
  conflict gate, and separately retain 400 refusal of a refund status patch.
- Payout replay tests first prove a nonzero commission schedule is refused, then
  exercise the existing zero-fee creation path. They retain wallet, settlement,
  provider ambiguity, concurrency, tenant, immutable lineage and paired rollback
  proofs. A zero-fee statement cannot invent a fee journal or adjustment.

The new owned domain test exercises real Gateway ownership and PostgreSQL plus
the native existing Durable Object with a strictly bounded synthetic provider.
Its initial failure was a fixture attempting to parse a ReadableStream as a
string. The corrected outbound fixture reads the actual request body, rejects
every other provider destination, and preserves all mode/hostname assertions.

Observed repaired runs:

- `domain-repair-database-results.json`: console historical controls passed;
  privacy runtime lacked a local build, and native provider/theme compatibility
  failures remained at that observation. Retained as failed evidence.
- `domain-native-r2-results.json`: native domain integration, immutable theme
  promotion and loyalty controls passed; operator-mail CSS-word check still failed.
- `policy-fixtures-r5-results.json`: operator delivery, payout replay/rollback and
  permanent zero-transaction-rake controls all pass (eight checks, zero skips).
- API unit suite with automatic host registration: 1,847 passing, no failures/skips.

The remaining browser controls must run against updated source with owned
production builds before source qualification can close. Provider registration,
staging and final production proof remain separately open.

Follow-up browser qualification passed privacy, public signup and buyer support
recovery. Core compatibility now proves the approved Circuit default before
explicitly importing the real current Core bundle through the normal file input,
with a labelled synthetic upload entitlement. An older generated Core JSON has
different presets and must not stand in for the current catalog.

The production-built local Commerce fixture uses a bounded platform-ingress
adapter for its loopback TLS proxy. Next16's custom router ignores the public
`conf` option during prepare, so the fixture supplies Next's own built-config
transport derived from its owned build. Only localhost or the already-approved
canonical fixture root, exact local ports, and matching forwarding headers reach
the application. Caller-supplied private Next configuration is refused. This is
not a deploy configuration change or a waiver of production origin binding;
actual hosted provider checks remain a separate required gate.
