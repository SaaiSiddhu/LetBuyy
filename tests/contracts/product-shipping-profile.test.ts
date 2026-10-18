// CAP-FB-SHIPPING-PRODUCT — a product's shipping profile, and the two gates it has to pass.
//
// The trap this exists for: UpdateProductSchema and PRODUCT_UPDATE_FIELDS are SEPARATE gates. A field
// the schema accepts but the allowlist omits is silently dropped — the request succeeds, the merchant
// sees no error, and the value never lands. Adding a field to one and not the other is a one-line
// omission that looks complete in review.
//
// What is NOT asserted here, deliberately: that a product cannot use another site's profile. That is
// a composite foreign key in migration 226 and is proven by executing SQL against a real database,
// because no schema test can demonstrate a database constraint.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    PRODUCT_UPDATE_FIELDS,
    UpdateProductSchema,
    planProductUpdate,
} from '@letbuyy/commerce-core';

const PROFILE = '11111111-1111-4111-8111-111111111111';
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const migration = readFileSync(join(root, 'database/supabase/migrations/226_product_shipping_profile.sql'), 'utf8');
/// SQL with comments stripped. Asserting a token is ABSENT from raw source cannot tell a use from a
/// mention, so the migration's own explanation of why those Firestore fields are NOT recreated trips
/// the rule that wants them absent. This is the third time this session the same defect appeared
/// (the HS256 issuer guard, the buyer-route store_id guard, here) — it is a property of
/// absence-assertions over documented code, not three separate slips.
const migrationCode = migration.replace(/^\s*--.*$/gm, '');

test('a shipping profile passes BOTH gates, not just the schema', () => {
    assert.ok(UpdateProductSchema.safeParse({ shipping_profile_id: PROFILE }).success, 'schema must accept it');
    assert.ok(
        (PRODUCT_UPDATE_FIELDS as readonly string[]).includes('shipping_profile_id'),
        'PRODUCT_UPDATE_FIELDS is the second gate — omitting it drops the value silently',
    );
    assert.ok(
        'shipping_profile_id' in planProductUpdate({ shipping_profile_id: PROFILE }).safeUpdates,
        'the planned update must actually carry the field',
    );
});

test('null is preserved — it resets a product to the site default', () => {
    // Dropping null instead of writing it would make "use the site default again" impossible to
    // express, and the merchant would see the old profile stay assigned with no error.
    assert.ok(UpdateProductSchema.safeParse({ shipping_profile_id: null }).success);
    assert.ok('shipping_profile_id' in planProductUpdate({ shipping_profile_id: null }).safeUpdates);
});

test('a non-uuid is refused', () => {
    assert.ok(!UpdateProductSchema.safeParse({ shipping_profile_id: 'not-a-uuid' }).success);
});

test('the cross-site guard is a COMPOSITE foreign key, not application code', () => {
    // A plain REFERENCES shipping_profiles(id) would accept another merchant's profile: both rows are
    // individually legitimate, so nothing downstream would object. The pair is what makes the
    // mismatch impossible.
    assert.match(migration, /UNIQUE \(id, site_id\)/, 'shipping_profiles needs the composite target');
    assert.match(
        migration,
        /FOREIGN KEY \(shipping_profile_id, site_id\)\s*\n?\s*REFERENCES public\.shipping_profiles \(id, site_id\)/,
        'products must reference the (id, site_id) PAIR',
    );
});

test('deleting a shipping profile must not delete products', () => {
    // ON DELETE CASCADE here would let removing a shipping profile silently destroy catalogue.
    assert.match(migration, /REFERENCES public\.shipping_profiles \(id, site_id\)\s*\n?\s*ON DELETE SET NULL/);
    assert.ok(
        !/REFERENCES public\.shipping_profiles \(id, site_id\)\s*\n?\s*ON DELETE CASCADE/.test(migration),
        'ON DELETE CASCADE would destroy products when a profile is removed',
    );
});

test('no second shipping model is introduced', () => {
    // The register described Firestore's per-product fields. Recreating them would compete with the
    // shipping stack migration 145 already installs.
    for (const firestoreField of ['shippingDays', 'shippingPrice', 'freeShippingAbove', 'expressDelivery']) {
        assert.ok(
            !migrationCode.includes(firestoreField),
            `${firestoreField} would be a second shipping model beside shipping_rates/zones/profiles`,
        );
    }
});
