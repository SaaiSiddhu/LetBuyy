import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../lib/errors';
import { SaveThemeDraftSchema, PublishThemeSchema } from '@letbuyy/theme-engine';
import { ThemeEditorPayloadSchema, ThemeDraftSaveResultSchema, ThemePublishResultSchema } from '@letbuyy/shared-types';
import { isStaleThemeEditorBaseVersion, ThemeExecutionAdapter } from '../execution/theme-execution.adapter';

const intent = {
    store_id: '10000000-0000-4000-8000-000000000001',
    template_config: { themeId: 'modern', sections: { template: [] } },
    base_version: 0,
    idempotency_key: 'theme-draft-test-intent',
};

test('first draft save requires explicit zero and a retry identity', () => {
    assert.equal(SaveThemeDraftSchema.safeParse(intent).success, true);
    for (const base_version of [undefined, null, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.equal(SaveThemeDraftSchema.safeParse({ ...intent, base_version }).success, false);
    }
    for (const idempotency_key of [undefined, '', 'short', ' leading-key', 'line\nbreak-key']) {
        assert.equal(SaveThemeDraftSchema.safeParse({ ...intent, idempotency_key }).success, false);
    }
});

test('a current draft base is exact, with no omitted or future-version bypass', () => {
    for (const current of [0, 1, 10]) {
        assert.equal(isStaleThemeEditorBaseVersion(current, current), false);
        for (const invalid of [undefined, null, -1, current + 1, Number.NaN, Number.POSITIVE_INFINITY, `${current}`]) {
            assert.equal(isStaleThemeEditorBaseVersion(current, invalid), true);
        }
        if (current > 0) assert.equal(isStaleThemeEditorBaseVersion(current, current - 1), true);
    }
});

test('publication requires a concrete saved revision and retry identity', () => {
    const publish = { store_id: intent.store_id, base_version: 1, idempotency_key: intent.idempotency_key };
    assert.equal(PublishThemeSchema.safeParse(publish).success, true);
    for (const base_version of [undefined, null, 0, -1, 0.5]) {
        assert.equal(PublishThemeSchema.safeParse({ ...publish, base_version }).success, false);
    }
    assert.equal(PublishThemeSchema.safeParse({ ...publish, idempotency_key: undefined }).success, false);
});

test('missing ownership schema cannot invent a successful owned store', async () => {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'or', 'is']) chain[method] = () => chain;
    chain.single = chain.maybeSingle = async () => ({ data: null, error: { message: 'Could not find the table public.sites in the schema cache' } });
    const db = { from: () => chain } as unknown as ConstructorParameters<typeof ThemeExecutionAdapter>[0];
    await assert.rejects(new ThemeExecutionAdapter(db).verifyStoreOwner(intent.store_id, intent.store_id),
        (error: unknown) => error instanceof AppError && error.statusCode === 503 && error.code === 'THEME_STATE_UNAVAILABLE');
});


test('canonical response contracts preserve no-draft zero and require confirmed receipt metadata', () => {
    assert.equal(ThemeEditorPayloadSchema.shape.version.safeParse(0).success, true);
    assert.equal(ThemeEditorPayloadSchema.shape.draft.safeParse({ exists: false, version: 0, updated_at: null }).success, true);
    const saved = { saved_at: '2026-10-16T12:00:00Z', version: 1, replayed: false, current_version: 1,
        draft: { id: intent.store_id, version: 1, auto_saved_at: '2026-10-16T12:00:00Z' } };
    assert.equal(ThemeDraftSaveResultSchema.safeParse(saved).success, true);
    assert.equal(ThemeDraftSaveResultSchema.safeParse({ ...saved, replayed: undefined }).success, false);
    assert.equal(ThemeDraftSaveResultSchema.safeParse({ ...saved, current_version: undefined }).success, false);
    assert.equal(ThemePublishResultSchema.shape.version.safeParse(0).success, false);
});
