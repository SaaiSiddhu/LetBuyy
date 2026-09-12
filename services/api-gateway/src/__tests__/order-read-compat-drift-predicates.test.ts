// F-DRIFTGUARD-1 — what the shared schema-drift predicates actually do.
//
// CAP-C67 surveyed 49 definitions of four drift helpers across ~25 files and recorded, in its own
// guard column, that `app-store-schema-drift.test.ts` pins app-store to the canonical predicate by
// parity and that NOTHING guards the other variants. That includes the canonical implementation
// itself — `lib/order-read-compat.ts`, which is the majority form and the one 12 files share.
//
// This file changes no behaviour. It is a characterisation suite: it states what the predicates do
// today so that the unification CAP-C67 describes (one canonical predicate plus the two legitimate
// variants) has a safety net to move against, instead of being attempted against prose.
//
// TWO THINGS THAT ARE NOT CLAIMED HERE, deliberately.
//
// 1. That the substring match is a live defect. `isMissingColumnError` tests
//    `text.includes(columnName)` with no word boundary, and ORDER_LIST_COLUMN_NAMES is dense with
//    substring pairs — `id` inside `store_id`, `status` inside `payment_status`, `total` inside
//    `subtotal`. That is the shape of a defect class this programme has hit before, so it was
//    chased. It does not reach production through the column-omission paths: those
//    (`app-store.ts:75`, `products.ts:503`, `orders.ts`) use `missingColumnFromError`, which
//    EXTRACTS the name with an anchored regex rather than testing containment. The substring
//    behaviour is pinned below anyway, because it is real behaviour of a shared helper and the next
//    caller may not be as careful as the current ones.
//
// 2. That Postgres emits a hint naming a column that exists. `databaseErrorText` concatenates
//    message, details AND hint, so a name that appears only in a hint satisfies the containment
//    test — that is asserted below because it is OUR code and measurable here. Whether a real
//    server sends such a hint is UNKNOWN_LIVE_STATE from this repository; CAP-C69 blocks the local
//    stack, so it is recorded in the backlog as an open question rather than dressed up as a bug.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    databaseErrorText,
    isMissingColumnError,
    isMissingOrderItemsRelation,
    missingColumnFromError,
} from '../lib/order-read-compat';

test('databaseErrorText folds message, details and hint into one lowercased haystack', () => {
    assert.equal(
        databaseErrorText({ message: 'Column X', details: 'Detail Y', hint: 'Hint Z' }),
        'column x detail y hint z',
    );
    // Absent and empty parts are dropped rather than joined as blanks — the reason the helper
    // filters before joining, and what keeps a two-space gap out of the haystack.
    assert.equal(databaseErrorText({ message: 'only' }), 'only');
    assert.equal(databaseErrorText({ message: 'a', details: undefined, hint: 'b' }), 'a b');
    assert.equal(databaseErrorText({}), '');
    assert.equal(databaseErrorText(null as never), '');
});

test('missingColumnFromError EXTRACTS the name, so it cannot confuse a column with its prefix', () => {
    // This is the helper the column-omission paths use, and the reason the substring behaviour
    // below is not reachable through them.
    assert.equal(missingColumnFromError({ message: 'column orders.site_id does not exist' }), 'site_id');
    assert.equal(missingColumnFromError({ message: 'column site_id does not exist' }), 'site_id');
    assert.equal(
        missingColumnFromError({ message: "Could not find the 'payment_status' column of 'orders' in the schema cache" }),
        'payment_status',
    );
    // The qualified form yields the COLUMN, never the table.
    assert.notEqual(missingColumnFromError({ message: 'column orders.site_id does not exist' }), 'orders');
    assert.equal(missingColumnFromError({ message: 'permission denied for table orders' }), null);
    assert.equal(missingColumnFromError({}), null);
});

test('isMissingColumnError needs BOTH the name and a drift phrase', () => {
    const drift = { message: 'column products.deleted_at does not exist' };
    assert.equal(isMissingColumnError(drift, 'deleted_at'), true);

    // The name alone is not enough: a permission error mentioning the column is not drift.
    assert.equal(isMissingColumnError({ message: 'permission denied for column deleted_at' }, 'deleted_at'), false);
    // A drift phrase alone is not enough either.
    assert.equal(isMissingColumnError({ message: 'column track_inventory does not exist' }, 'deleted_at'), false);

    // All three accepted phrases, each on its own.
    for (const message of [
        'column deleted_at does not exist',
        "could not find the 'deleted_at' column",
        "the 'deleted_at' column is missing from the schema cache",
    ]) {
        assert.equal(isMissingColumnError({ message }, 'deleted_at'), true, message);
    }

    // Case folding is applied to both sides.
    assert.equal(isMissingColumnError({ message: 'COLUMN DELETED_AT DOES NOT EXIST' }, 'Deleted_At'), true);
});

test('isMissingColumnError matches by SUBSTRING, with no word boundary', () => {
    // Pinned because it is real behaviour of a helper 12 files share, not because a caller is
    // currently harmed by it. A future caller that passes a short name would be.
    assert.equal(
        isMissingColumnError({ message: 'column orders.payment_status does not exist' }, 'status'),
        true,
        'a shorter name contained in the real one still matches',
    );
    assert.equal(isMissingColumnError({ message: 'column orders.subtotal does not exist' }, 'total'), true);
    assert.equal(isMissingColumnError({ message: 'column orders.store_id does not exist' }, 'id'), true);
    // Contrast: the extractor gets these right, which is why the omission paths use it.
    assert.equal(missingColumnFromError({ message: 'column orders.payment_status does not exist' }), 'payment_status');
    assert.equal(missingColumnFromError({ message: 'column orders.subtotal does not exist' }), 'subtotal');
});

test('a name reaching the haystack only through the HINT still satisfies the predicate', () => {
    // OUR behaviour, measurable here. Whether a real server sends this shape is UNKNOWN_LIVE_STATE
    // (CAP-C69 blocks the local stack) and is filed as an open question, not claimed as a bug.
    // The message names a DIFFERENT column, and one that does not contain the target as a
    // substring — otherwise this test would pass through the message and prove nothing about the
    // hint. The first draft used 'deleted_att', which contains 'deleted_at', and a planted
    // regression that removed the hint entirely left this test green. A control that cannot fail
    // proves nothing, so the fixture was changed until removing the hint does fail it.
    const hintNamesAColumnThatExists = {
        message: 'column orders.archived_on does not exist',
        hint: 'Perhaps you meant to reference the column "orders.deleted_at".',
    };
    assert.equal(
        databaseErrorText({ message: hintNamesAColumnThatExists.message }).includes('deleted_at'),
        false,
        'guard the guard: the message alone must not carry the name',
    );
    assert.equal(
        isMissingColumnError(hintNamesAColumnThatExists, 'deleted_at'),
        true,
        'the hint alone carries the name into the haystack',
    );
    // The extractor reads the MESSAGE form, so it reports the genuinely absent column.
    assert.equal(missingColumnFromError(hintNamesAColumnThatExists), 'archived_on');
});

test('isMissingOrderItemsRelation accepts the relationship phrase the column predicate does not', () => {
    // The two predicates share three phrases and differ by one: 'relationship', which PostgREST
    // uses when an embedded resource cannot be resolved. That asymmetry is deliberate.
    const relationship = { message: "could not find a relationship between 'orders' and 'order_items'" };
    assert.equal(isMissingOrderItemsRelation(relationship), true);
    assert.equal(isMissingColumnError(relationship, 'order_items'), true, 'this one matches via "could not find"');

    const relationshipOnly = { message: "no relationship between 'orders' and 'order_items'" };
    assert.equal(isMissingOrderItemsRelation(relationshipOnly), true);
    assert.equal(
        isMissingColumnError(relationshipOnly, 'order_items'),
        false,
        'the column predicate does not accept "relationship" as a drift phrase',
    );

    assert.equal(isMissingOrderItemsRelation({ message: 'column orders.total does not exist' }), false);
});
