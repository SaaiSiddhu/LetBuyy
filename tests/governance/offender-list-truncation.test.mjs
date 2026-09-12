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

test('the separator is honoured, because call sites do not agree on one', () => {
    // F-STALECOUNT-2. The 14 adopted sites join with ", ", "; " and "\n" respectively. Flattening
    // them to one style would have silently rewritten eleven validators' output formats while
    // claiming to change only what they report, so the separator is a parameter and is pinned here.
    assert.equal(formatOffenderList(['a', 'b', 'c'], 20, '; '), 'a; b; c');
    assert.equal(formatOffenderList(['a', 'b'], 20, '\n'), 'a\nb');
    const many = Array.from({ length: 25 }, (_, i) => `f${i}`);
    const rendered = formatOffenderList(many, 20, '; ');
    assert.match(rendered, /showing 20 of 25; 5 more not listed/);
    // Count separators in the JOINED PORTION only. A first draft asserted 19 occurrences of '; '
    // across the whole string and failed at 20 — because the suffix "…of 25; 5 more…" contains the
    // separator too. The helper was right and the assertion was wrong; measuring the wrong span is
    // how a correct implementation gets "fixed".
    const joined = rendered.slice(0, rendered.indexOf(' (showing'));
    assert.equal(joined, many.slice(0, 20).join('; '));
    assert.equal((joined.match(/; /g) || []).length, 19);
});

test('the default separator is unchanged, so untouched call sites keep their format', () => {
    assert.equal(formatOffenderList(['a', 'b'], 20), 'a, b');
});
