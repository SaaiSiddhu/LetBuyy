# Verified custom-domain registration

Owner approved the bounded workflow on 29 October 2026. This document records its
implementation and operating boundaries; it is not proof of hosted activation.

## Existing owners

- The shared UI owns the SDK/token lifecycle for all themes and forms. First-party
  store and checkout hosts inherit the approved `letbuyy.store` provider entry.
- Merchant's existing domain verification command proves store ownership, its TXT
  challenge, routing and HTTPS before requesting an external hostname addition.
- The existing signed domain-maintenance job repeats that work for verified
  primary domains. A missing ownership token cannot enroll a legacy host.
- The API's existing coordinator serializes additions to one configured widget.
  The infrastructure adapter is the only provider configuration caller. No new
  runtime, identity issuer, SQL schema, shared clearance cookie or token relay.
- Domain status GET is read-only at the provider. Merchant displays customer
  verification separately from SSL, and the connection wizard completes only
  after storefront HTTPS, checkout HTTPS and customer verification are ready.

## Credential and capacity

`TURNSTILE_DOMAIN_MANAGEMENT` is a private encrypted API Worker binding containing
`accountId`, `siteKey`, `apiToken`, and a UUID `configurationId`. It is distinct
from the existing Siteverify secret. Use Turnstile Sites Write on the LetBuyy
account only; do not grant DNS, Workers, account-settings or billing access. The
provider permission can manage that account's widgets; application code pins one
explicit widget. Staging and production configurations point to their respective
existing widgets. Verify the configured widget against each deployed public
site-key fingerprint before activation. Never print or commit credential values.

The owner accepted using the existing single Free widget. Ten hostname entries
is a hard ceiling, including existing platform entries. Children of an authorized
hostname need no additional slot. Capacity is reported explicitly; no automatic
extra widget, paid upgrade, Any Hostname mode, deletion or security bypass occurs.
This is maintained automation with finite provider capacity, not a promise of
unlimited external domains or permanent credentials.

Production currently has 64 variable/secret bindings. The source removes only
the invalid disabled-sandbox Twilio account placeholder to reserve the new secret
slot. Before hosted configuration, prove that the live value is still that
placeholder and the existing sandbox provider/mode are unchanged. If an actual
Twilio credential has replaced it, stop and preserve it. No real key or feature
flag may be removed. Keep a recoverable private configuration snapshot and
independently read back all other bindings and secret names.

## Mutation and recovery

The provider adapter reads the exact widget, requires Managed/no-pre-clearance,
preserves existing hostnames and settings, adds only the requested exact hostname,
and verifies the update reply plus independent readback. Unsupported configuration,
provider failure and capacity never become success. Provider response bodies and
widget secrets do not reach Merchant or logs.

The coordinator writes durable intent before a possible provider update. Lost
replies, process termination or uncertain readback hold subsequent writes. A
read-only check may still prove an existing hostname ready. Do not blindly retry
PUT, delete the widget or rotate its Siteverify secret to clear this condition.
An operator must reconcile the exact provider state and original intended change,
preserve all accepted domains/settings, then explicitly version `configurationId`
in the encrypted management binding. The new coordinator identity starts only
after that reconciliation. Independent privileged dashboard edits cannot be
serialized by LetBuyy; retain provider change discipline during provisioning.

Management-token expiry or revocation blocks new registrations/readback, not
previously authorized challenges or the separate Siteverify credential. Rotate
management access before its approved expiry and recheck the exact account/widget.

## Qualification

Focused unit controls cover preserving settings, child-host inheritance, capacity,
invalid inputs, configuration drift, failures, uncertainty, prerequisite checks
and concurrent additions. Owned integration drives real signed Gateway requests,
PostgreSQL ownership, the native coordinator and a labelled provider fixture;
unverified/foreign/anonymous requests cannot enroll a host. Merchant tests retain
instructions after failure and forbid false completion. Actual provider canary,
staging and final production journeys must be recorded separately after they run.

Primary provider contracts: [management API](https://developers.cloudflare.com/turnstile/get-started/widget-management/api/),
[hostname inheritance](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/),
[plan capacity](https://developers.cloudflare.com/turnstile/plans/).
