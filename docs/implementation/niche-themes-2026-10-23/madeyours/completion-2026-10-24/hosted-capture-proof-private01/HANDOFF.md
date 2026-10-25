# Hosted capture metadata — private proposal sealed

The private correction makes the descriptive flag reflect the existing canonical capture, including a webhook-owned capture. It preserves the original durable capture key and the existing event/notification owner and retry behavior. Main and Runtime07 are unchanged.

Current verification: **15 source-block checks pass; semantic type diagnostics0**. Native execution remains **NOT_RUN**. [Exact patch](proposal.patch), [structured handoff](HANDOFF.json), [before/after native plan](NATIVE_REPRODUCTION_PLAN.json). The unchanged baseline must actually fail the new webhook-first metadata assertion before native causation is claimed.

Prepared native cases cover guest/bound browser-first, webhook-first, concurrent callbacks, original-key lost hosted acknowledgement, a first queue failure, wrong bindings, amount/currency refusal, one order/capture/stock effect, exact debit/credit totals and stable outbox keys. Raw queue submissions, accepted jobs and a unique logical key are separate from consumer/provider delivery. No native or email/provider request ran here.

The plain existing-event suppression attempt is retained under superseded-outbox-read-attempt01 and excluded from the final patch: event persistence does not prove successful notification delivery. The metadata-only repair does not grant a notification exactly-once certificate. [Exact existing helper/consumer extension request](NOTIFICATION_EXTENSION_REQUEST.json) identifies the additional files and acceptance needed; those paths were not edited.

[Existing completed sessions](EXISTING_COMPLETED_SESSION_DISPOSITION.json) retain their observed flags and accepted financial proof. Their early completed-receipt branch is unchanged; no backfill, second capture, notification replay or existing-data edit was performed or authorized.

This first sealed handoff ends the private allocation. All frozen MadeYours visual pins rechecked exact; original23 remain0run/23NOT_RUN. No Main, sealed candidate, shared queue, app, database, browser, native, build, provider, secret or public-ingress action occurred.
