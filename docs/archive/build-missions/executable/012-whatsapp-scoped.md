# Task 012 - WhatsApp Scoped
Status: done
DependsOn: [001,005,010]
Covers: WhatsApp lifecycle, COD confirmation, consent
Conforms-to: V1 sections 3, 11, Appendix C row 012

## Goal

Ship scoped WhatsApp utility messages, COD reply-to-confirm, and DPDP opt-in ledger.

## Scope

In: lifecycle + COD + consent only. Out: broadcasts, campaigns, support inbox, catalog sync, in-thread checkout, Instagram, NLU/AI.

## Reuse

`whatsapp.ts`, migration `132`, notification router, WhatsApp adapter package.

## Database

`wa_templates`, `wa_sessions`, `wa_optins`, `whatsapp_messages`; no partitioning. Migration `150_executable_whatsapp_scoped.sql` with rollback proof.

## APIs

`POST /wa/webhook`, `POST /wa/send`, `POST /wa/optins` with `/whatsapp` aliases preserved.

## Events

`wa.message_received.v1`, `wa.cod_confirmed.v1`; subscribes to order/shipment/cart events.

## Acceptance

Mock BSP lifecycle send and COD reply-to-confirm are wired through the existing notification/WhatsApp route. Inbound provider messages are idempotent, DPDP opt-in consent is enforced before send, scoped `wa.message_received` and `wa.cod_confirmed` events are emitted, and no full-commerce/campaign/support/AI WhatsApp surfaces were added.

## Tests

Gateway focused WhatsApp test PASS 6/6; real local Postgres WhatsApp proof PASS; shared-types, infrastructure, event-core, and gateway typechecks PASS; gateway unit suite PASS 196/196; lint and governance PASS.

## Rollback

Disable WhatsApp sends and rollback additive DB.

## [HUMAN-REQUIRED]

`HR-WHATSAPP-LIVE`, `HR-LEGAL-DPDP-PA`.
