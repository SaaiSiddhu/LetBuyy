// F-STALECOUNT-1 — an offender list must never let a cap pass for a count.
//
// Every validator in this tree rendered `list.slice(0, N).join(", ")`. A reader saw N entries with
// nothing to say whether N was the total or the ceiling, which is the failure this programme names
// "a count is not a set" — sitting inside the lane that exists to enforce it. gate.sh:104 asks a
// reader to confirm stale-artifact's offenders are "100% generated dirs"; against the truncated
// message that question was unanswerable, and when it was finally asked properly the real list was
// 54 entries, not the 20 shown.

import assert from 'node:assert/strict';
import test from 'node:test';
import { formatOffenderList } from '../../scripts/validators/governance-common.mjs';

test('a list at or under the cap is rendered whole, with no misleading suffix', () => {
    assert.equal(formatOffenderList(['a', 'b'], 20), 'a, b');
    assert.equal(formatOffenderList(Array.from({ length: 20 }, (_, i) => `f${i}`), 20).includes('showing'), false);
});

test('a list over the cap reports the TOTAL and how many were withheld', () => {
    const rendered = formatOffenderList(Array.from({ length: 54 }, (_, i) => `f${i}`), 20);
    assert.match(rendered, /showing 20 of 54; 34 more not listed/);
    // and the sample itself is still there to be read
    assert.match(rendered, /^f0, f1, /);
});

test('duplicates are collapsed before counting, so the total is a SET size', () => {
    // The validators pass raw offender arrays that can repeat a path; a total that counted
    // duplicates would overstate the problem as surely as a cap understates it.
    assert.equal(formatOffenderList(['a', 'a', 'b'], 20), 'a, b');
    const rendered = formatOffenderList([...Array.from({ length: 30 }, (_, i) => `f${i}`), 'f0', 'f1'], 20);
    assert.match(rendered, /showing 20 of 30; 10 more not listed/);
});

test('the cap is honoured exactly at the boundary', () => {
    const twentyOne = Array.from({ length: 21 }, (_, i) => `f${i}`);
    assert.match(formatOffenderList(twentyOne, 20), /showing 20 of 21; 1 more not listed/);
});
