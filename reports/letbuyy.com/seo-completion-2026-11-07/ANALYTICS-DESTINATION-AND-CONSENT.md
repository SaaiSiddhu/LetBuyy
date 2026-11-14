# Analytics destination and consent — tracking remains off

The owner accepted the recommended option on 7 November: **keep tracking off and prepare a consent-first implementation proposal**. No GA4 setting, stream URL, measurement ID, tag, consent default or transmitted event was changed. There is no approved active marketing collector.

The November3 authenticated inspection found two inactive URL-unspecified Web streams in the existing `letbuy-y` and `let-buyy` properties. Those are historical observations; neither is selected by this proposal. Firebase application DAU is not marketing organic-signup data. Today's Search Console access confirms search reporting, not GA4 configuration or a conversion sink.

## Concrete implementation order after policy/destination approval

1. Select **one existing approved marketing stream**, its real public domain, environment separation and owner. Avoid mixing buyer-app/merchant telemetry unless explicitly intended. Record its property/stream identifiers without secrets. No duplicate property is created merely to complete a checklist.
2. Have the owner approve purpose, event set, retention, consent categories and cross-domain treatment. Default optional measurement to denied. Reuse canonical consent authority where applicable; the footer's local preferences alone are not proof of a complete cross-domain/server consent pipeline.
3. Connect the existing marketing → Accounts → canonical billing journey using the current identity and billing authorities. Use aggregate, allowlisted events; never synthesize paid activation from a browser callback. No new analytics service or identity system.
4. Verify denied/no-choice and withdrawal produce **no optional collector request**, accepted consent produces one event per real transition, refresh/back/retry do not double count, and internal/test traffic cannot pollute production. Prove payload filtering and origin/environment routing.
5. Request specific approval for the resulting settings/source release only after local acceptance. Then verify actual received events and joins in the selected property. No production event is sent as a local test.

| Event | Authoritative trigger | Allowlisted dimensions | Explicit exclusions |
|---|---|---|---|
| `landing_view` | Consented actual navigation | Normalized path/template,locale,environment | Full query, private IDs, referrer secrets |
| `pricing_view` | Actual pricing page view | Locale, availability state | Purchase/revenue inference |
| `plan_cta` | Available plan CTA activation | Canonical slug,source template | Client price as authority |
| `signup_started` | Accounts form actually starts | Approved anonymous journey context | Email,password,OTP |
| `signup_completed` | Canonical Identity completion | Approved aggregate/environment | Browser redirect as completion proof |
| `store_setup_completed` | Persisted canonical transition | Aggregate site type/environment | Publicly identifying store data |
| `billing_started` | Server-created supported checkout | Canonical plan and test/live mode | Provider token,signature,card data |
| `plan_activated` | Verified canonical payment/invoice and activation | Approved aggregate plan/mode | Mock or sandbox revenue as live revenue |

Do not use essential sign-in consent as marketing consent. Do not transmit email, tokens, private identifiers, addresses, card details or sensitive URLs. An unconfigured wrapper would not make this work integrated, so no dormant tracking scaffold was added. Current state: **proposal complete; instrumentation/configuration/received-event acceptance not executed**.

[Owner decision](evidence/owner-decisions.json) · [Prior property/source evidence](../../letbuyy-seo-release-readiness-2026-11-03/MEASUREMENT-AND-CONVERSION-BASELINE.md)
