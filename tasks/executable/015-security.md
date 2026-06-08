# Task 015 - Security
Status: done
DependsOn: [001]
Covers: identity, customer, DPDP, RBAC, field encryption
Conforms-to: V1 sections 2, 3, Appendix C row 015

## Goal

Enforce layered tenant isolation, RBAC, claims-to-GUC, field-level PII encryption, webhook verify, DPDP DSR, maker-checker, and step-up.

## Scope

In: mock KMS, DSR export/erasure, payout/refund step-up. Out: live KMS/SSO/legal signoff.

## Reuse

`auth.ts`, `customers.ts`, `two-factor.ts`, `tenant-context.ts`, `auth-core`, `tenant-core`, date formatting from `@letbuyy/ui`.

## Database

Forward migration `153_executable_identity_security.sql` creates `consents`, `store_credit`, `store_credit_ledger_entries`, `customer_dsr_exports`, `step_up_challenges`, and `sensitive_action_approvals`; adds encrypted PII columns to existing customer tables; and applies RLS+FORCE+tenant GUC policies to new and relevant existing PII tables.

## APIs

`POST /v1/security/step-up/challenges`, `POST /v1/security/dsr/export`, `POST /v1/security/dsr/erase`; payout settle and payment refund paths require shared step-up evidence.

## Events

`auth.login.v1`, `auth.stepup.v1`, `customer.created.v1`, `customer.updated.v1`, `customer.dsr_requested.v1`.

## Acceptance

Cross-tenant denied fail-closed; DSR export/erase works with mock KMS field encryption; replayed/forged webhook protections remain in the shared verifier; step-up is enforced on payout/refund; maker-checker rejects self-approval; date-format validator is green.

## Tests

PASS: `services/api-gateway/src/__tests__/security-v1.test.ts` 4/4; `tests/executable/security-postgres.test.mjs` real local Postgres proof 1/1; `tests/executable/human-required-live-paths.test.mjs` 13 skipped live assertions; event-core typecheck/test; gateway typecheck; gateway unit 207/207; lint; stale-artifact; architecture; governance 172.

## Rollback

Run `database/supabase/rollback/153_executable_identity_security.rollback.sql`; live controls remain mock-default and privacy-safe data handling is preserved.

## [HUMAN-REQUIRED]

`HR-KMS-LIVE`, `HR-TURNSTILE-LIVE`, `HR-LEGAL-DPDP-PA`.
