# N1.2 — final-chain ledger source recovery — 14 October 2026

This is engineering evidence for the owner's N1–N9 execution grouping. It does
not replace the original eleven-phase/77-package programme or close Phase 2/N1.
Candidate: `letbuyy/phase2-shared-buyer-identity`, HEAD
`0862687a5008d604d0df23357b2eb511293139fa`, plus the preserved working-tree overlay.

The real Gateway `/v1/billing/ad-credits/verify` returned 500 for a valid synthetic
provider signature against the final migration chain. Migration 303 replaced the
293 resolver without its `ad_credit_purchase` branch; 305 repaired payment
compatibility while still omitting that branch. Migration 308 extends the 305
resolver with ad-credit billing ownership and leaves the other branches,
order-binding/deleted-row checks, finalizer, idempotency and posting guards intact.
Its paired rollback restores 305's resolver without deleting posted financial
or entitlement records. No applied forward migration was rewritten.

## Current proof

- Real Gateway/owned PostgREST/PostgreSQL: four concurrent independently signed
  verification requests issue one credit and one balanced cash/ad-liability
  journal. Invalid signature, second payment and wrong tenant do not add value;
  exact replay recovers the committed result. Merchant payable remains zero.
- All seven source families and payment/refund compatibility branches resolve
  seeded owned records. Mismatched order, missing/deleted source, wrong site and
  wrong tenant GUC fail closed. 308 rollback/reapply preserves other families,
  journals and privileges; repeated reapply and funding replay do not duplicate.
- Actual 284 and 291 rollback/reapply cycles leave one supported overload, retain
  scoped grants and preserve channel intent/ad ledger rows. Reapplying 291 restores
  rejection of a payload conflict. Historical SQL was already correct.
- The corrected rollback sweep passes 6/6, including its unguarded-checkout
  negative control and own-migration snapshots. Funding finalization passes 1/1,
  the new final-chain/round-trip suite 4/4, Gateway funding 1/1, and the money kernel
  and foundation money suites 1/1 each. These are 14 unique tests across six suites;
  overlapping earlier runs are not counted again. Focused billing unit contracts
  pass 8/8; Gateway typecheck, migration safety and scoped whitespace checks pass.

## Correction to audit finding A16

The audit's two signature alerts were scanner false positives, not confirmed SQL
rollback defects. Rollback 284 explicitly drops the six-argument writer before
restoring five. Rollback 291's release function has six inputs; a comma inside a
whole-line comment was incorrectly counted as a seventh. The scanner now ignores
those comments and recognizes only exact DROP targets for all current overloads.
Actual owned-database round trips establish the correction. The correct historical
rollback SQL is retained.

## Verdict and continuity

N1.2 engineering criteria are verified locally. The provider order transport is
a deterministic test double: this is not real provider-sandbox, device, hosted,
formal business or release acceptance. N8.1 retains actual provider funding/UI
requirements. No restored/shared database, production payment, deployment,
external message, backup or unrelated Docker resource was changed.

The next package is N1.1: repair generated-cache/link traversal and reconcile
stale inventories and assertions while preserving security and behavioral gates.
N1's broader identity, actual-role tenancy and privacy journeys remain open.
Raw run summaries, cleanup outcomes, source hashes and exact next actions live in
`Verification/LetBuyy-Codex-Continuous-Run-2026-10-14/N1.2/package-evidence.json`
under the workspace, with the 63-package `active-run-state.json` beside it. The
77 original packages and 103 feature dispositions remain in the audit mappings.

## 14 October rollback precondition follow-up

The new rollback 308 now requires exactly the supported three-input resolver signature and parameter names before replacing its body. The owned source-family suite passes 4/4 in run `1911761f8f79`: a deliberately injected overload reproduces the former unguarded rollback changing funding despite ABI drift; the guarded rollback refuses atomically and preserves current funding/ACLs, then normal rollback/reapply still preserves the existing journal and returns all other families correctly. This supersedes only the earlier rollback-308 fingerprint. Historical 284/291 function bodies and the prior signature correction remain intact; other baseline rollback precondition findings remain open.
