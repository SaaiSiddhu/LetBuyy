import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { resolveCustomUser } from '../lib/auth-user';

function userDatabase(user: { id: string; email: string; email_verified: boolean } | null) {
    let selectedColumns = '';
    const db = {
        from: () => ({
            select: (columns: string) => {
                selectedColumns = columns;
                return {
                    eq: () => ({
                        maybeSingle: async () => ({ data: user, error: null }),
                    }),
                };
            },
        }),
    } as unknown as SupabaseClient;
    return { db, selectedColumns: () => selectedColumns };
}

test('merchant identity resolution carries persisted email verification into the store-creation guard', async () => {
    const verified = userDatabase({ id: 'verified-user', email: 'seller@example.test', email_verified: true });
    const unverified = userDatabase({ id: 'unverified-user', email: 'seller@example.test', email_verified: false });

    const verifiedUser = await resolveCustomUser(verified.db, { id: 'verified-user', email: 'seller@example.test' });
    const unverifiedUser = await resolveCustomUser(unverified.db, { id: 'unverified-user', email: 'seller@example.test' });

    assert.match(verified.selectedColumns(), /email_verified/);
    assert.equal(verifiedUser?.email_verified, true);
    assert.equal(unverifiedUser?.email_verified, false);
});

test('missing persisted merchant profile cannot satisfy the verified-contact requirement', async () => {
    const missing = userDatabase(null);
    const user = await resolveCustomUser(missing.db, { id: 'not-persisted', email: 'seller@example.test' });

    assert.equal(user?.email_verified, undefined);
});
