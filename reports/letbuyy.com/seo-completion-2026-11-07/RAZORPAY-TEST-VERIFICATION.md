# Razorpay Test Mode — externally blocked

On 7 November a single read-only `GET https://api.razorpay.com/v1/plans?count=1` authenticated with the existing local test-prefixed key pair returned **HTTP 401, BAD_REQUEST_ERROR,“Authentication failed.”** The evidence records presence/mode/status only; no key, secret, authorization header or provider identifier is saved.

The owner then confirmed **“No valid keys available yet.”** Retries stopped. No order, subscription, payment, webhook, invoice or live charge was created. Source, environment files, provider settings and signatures were not changed. Test Mode prefix alone does not prove that credentials authenticate.

Next dependency: the owner replaces the pair in the approved local secret location, without posting it in chat. Restart only the owned gateway process, perform one read-only auth check, and proceed only if authenticated Test Mode is verified. Use owned disposable database fixtures rather than the shared restored database. A new public webhook/tunnel needs separate authorization before exposure.

Required provider acceptance remains unexecuted: actual test checkout success/cancel/failure; server amount/currency/plan authority; valid and invalid signatures; duplicate verify/webhook behavior; persisted canonical billing/activation and UI readback; recovery/reconciliation. Earlier captured-provider fixtures prove only their stated integration behavior. They cannot substitute for a real Razorpay sandbox result.

[Sanitized authentication receipt](evidence/razorpay-auth-readonly.json) · [Owner answer](evidence/owner-decisions.json)
