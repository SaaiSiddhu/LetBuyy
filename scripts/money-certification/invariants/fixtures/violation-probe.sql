-- B5 negative-control fixture for check-invariants.mjs --probe.
-- Returns exactly one row so the runner must detect it as a violation.
-- Expected: runner exits nonzero (detection confirmed).
-- This file is never run against the real ledger — only via --probe self-test.
SELECT 'probe-violation';
