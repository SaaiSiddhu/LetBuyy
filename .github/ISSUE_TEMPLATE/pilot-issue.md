---
name: Pilot Issue
about: Track merchant pilot program defects and merchant-blocking issues (Document 7 §4)
title: "[PILOT][P1] Brief description"
labels: pilot
assignees: ''
---

## Severity

- [ ] P0 — money-wrong (freeze payouts; Document 5 §5 protocol)
- [ ] P1 — merchant-blocked
- [ ] P2 — degraded (works but impaired)
- [ ] P3 — polish / friction

## Merchant

Merchant slot: M1 / M2 / M3 / M4 / M5 (or ALL)

## Description

What went wrong? Include:
- Exact user action sequence
- Expected behavior
- Actual behavior
- Timestamps (UTC)

## Evidence

- Trace/request ID:
- Ledger transaction ID (if money-affecting):
- Screenshot or log excerpt:

## Impact

- Orders affected:
- Amount at risk (₹):
- Active merchants blocked: yes / no

## P0 Protocol (fill out for P0 only)

Per Document 5 §5: freeze payouts first, diagnose second.

- [ ] Payout kill-switch toggled OFF at: ___
- [ ] Engineering owner paged at: ___
- [ ] Root cause identified: PENDING
- [ ] Fix commit: PENDING
- [ ] Payouts re-enabled at: ___
- [ ] Post-mortem ledger row: PENDING

## Fix

- Fix commit SHA: PENDING
- Governance gate: green / pending
- Ledger row: PENDING
- Verification: PENDING
