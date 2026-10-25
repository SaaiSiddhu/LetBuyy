import assert from 'node:assert/strict';
import test from 'node:test';
import { isAppStoreUuid } from '../src/app-platform.ts';

test('marketplace UUIDs use the canonical five-group form, including seeded and generated IDs', () => {
    for (const id of [
        '11111111-1111-4111-8111-111111111203',
        '550e8400-e29b-41d4-a716-446655440000',
        '550E8400-E29B-41D4-A716-446655440000',
    ]) assert.equal(isAppStoreUuid(id), true, id);
});

test('slugs, malformed IDs and unbounded query fragments are not UUIDs', () => {
    for (const id of [
        'letbuyy-analytics-demo', '',
        '11111111-1111-4111-8111111111203',
        '550e8400-e29b-41d4-7716-446655440000',
        '550e8400-e29b-41d4-a716-44665544000',
        '550e8400-e29b-41d4-a716-446655440000.extra',
    ]) assert.equal(isAppStoreUuid(id), false, id);
});
