import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Load the actual app-owned pure transport module without mounting Next.
const source = readFileSync(new URL('../src/lib/theme-draft-client.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const exported = {};
new Function('exports', js)(exported);
const { ThemeDraftClient, ThemeDraftConflictError, ThemeDraftValidationError } = exported;
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const ack = version => ({ version, currentVersion: version, savedAt: '2026-10-16T12:00:00Z' });
let sequence = 0;
const key = () => `owned-intent-${++sequence}`;
const config = heading => ({ themeSettings: {}, sections: { template: [{ id: 'owned', heading }] } });

test('autosave and manual save serialize exact bases instead of conflicting with themselves', async () => {
    const calls = [], a = deferred(), b = deferred();
    const client = new ThemeDraftClient(0, intent => { calls.push(structuredClone(intent)); return calls.length === 1 ? a.promise : b.promise; }, config('initial'), false, key);
    const first = client.save(config('first')), second = client.save(config('second'));
    await tick(); assert.equal(calls.length, 1); assert.equal(calls[0].baseVersion, 0);
    a.resolve(ack(1)); await first; await tick();
    assert.equal(calls[1].baseVersion, 1); assert.notEqual(calls[0].idempotencyKey, calls[1].idempotencyKey);
    b.resolve(ack(2)); await second; assert.equal(client.version, 2);
});

test('response-loss retries the immutable old intent before sending newer local edits', async () => {
    const calls = []; let attempt = 0;
    const client = new ThemeDraftClient(0, async intent => {
        calls.push(structuredClone(intent)); if (++attempt === 1) throw new Error('Synthetic response loss');
        return ack(attempt - 1);
    }, config('initial'), false, key);
    const input = config('first'); const save = client.save(input); input.sections.template[0].heading = 'mutated';
    await assert.rejects(save, /response loss/);
    await client.save(config('newer'));
    assert.deepEqual(calls[0], calls[1]); assert.equal(calls[0].draftConfig.sections.template[0].heading, 'first');
    assert.equal(calls[2].baseVersion, 1); assert.notEqual(calls[1].idempotencyKey, calls[2].idempotencyKey);
    assert.equal(client.version, 2);
});

test('stale receipt pauses saves; explicit reviewed revision still conflicts if another session wins', async () => {
    const calls = [];
    let replacementConflicts = true;
    const client = new ThemeDraftClient(0, async intent => {
        calls.push(structuredClone(intent));
        if (calls.length === 1) return { ...ack(1), currentVersion: 2 };
        if (replacementConflicts) throw new ThemeDraftConflictError();
        return ack(intent.baseVersion + 1);
    }, config('initial'), false, key);
    await assert.rejects(client.save(config('local')), ThemeDraftConflictError);
    await assert.rejects(client.save(config('newer')), ThemeDraftConflictError); assert.equal(calls.length, 1);
    await assert.rejects(client.save(config('local'), 2), ThemeDraftConflictError); assert.equal(client.paused, true);
    replacementConflicts = false;
    await client.save(config('local'), 3); assert.equal(calls.at(-1).baseVersion, 3); assert.equal(client.version, 4);
});

test('publication recovery preserves the accepted key/base and cannot publish newer dirty edits', async () => {
    const saves = [], publications = [];
    const client = new ThemeDraftClient(0, async intent => { saves.push(structuredClone(intent)); return ack(intent.baseVersion + 1); }, config('initial'), false, key);
    const saved = config('saved'); await client.save(saved);
    let attempt = 0;
    const publish = async intent => { publications.push(structuredClone(intent)); if (++attempt === 1) throw new Error('Synthetic publish response loss'); return ack(2); };
    await assert.rejects(client.publish(publish), /response loss/);
    await assert.rejects(client.save(config('new dirty edits')), /previous publication/);
    await client.publish(async () => { throw new Error('Must reuse the accepted intent transport'); });
    assert.deepEqual(publications[0], publications[1]); assert.equal(publications[0].baseVersion, 1);
    assert.equal(saves.length, 1); assert.equal(client.hasDraft, false);
    await client.save(saved); assert.equal(saves.length, 1, 'unchanged published content must not recreate a draft');
    await client.save(config('new dirty edits')); assert.equal(saves[1].baseVersion, 2);
});

test('disposed editor cannot adopt a late acknowledgement or send queued work', async () => {
    const pending = deferred(), calls = [];
    const client = new ThemeDraftClient(0, intent => { calls.push(intent); return pending.promise; }, config('initial'), false, key);
    const first = client.save(config('old')), second = client.save(config('queued'));
    const oldResult = assert.rejects(first, /loaded editor changed/), queuedResult = assert.rejects(second, /loaded editor changed/);
    await tick(); client.dispose(); pending.resolve(ack(1)); await oldResult; await queuedResult;
    assert.equal(calls.length, 1); assert.equal(client.version, 0);
});

test('malformed/future acknowledgement cannot invent a confirmed save or discard its retry key', async () => {
    const calls = []; let valid = false;
    const client = new ThemeDraftClient(0, async intent => { calls.push(structuredClone(intent)); return valid ? ack(1) : ack(99); }, config('initial'), false, key);
    await assert.rejects(client.save(config('owned')), /No confirmed draft receipt/); assert.equal(client.version, 0);
    valid = true; await client.save(config('owned')); assert.deepEqual(calls[0], calls[1]);
});


test('a definitive validation rejection allows corrected local edits while ambiguous failures retain their intent', async () => {
    const calls = []; let attempt = 0;
    const client = new ThemeDraftClient(0, async intent => {
        calls.push(structuredClone(intent));
        if (++attempt === 1) throw new ThemeDraftValidationError('Correct the field');
        return ack(intent.baseVersion + 1);
    }, config('initial'), false, key);
    await assert.rejects(client.save(config('invalid')), ThemeDraftValidationError);
    assert.equal(client.version, 0);
    await client.save(config('corrected'));
    assert.equal(calls[1].baseVersion, 0); assert.notEqual(calls[0].idempotencyKey, calls[1].idempotencyKey);
    await assert.rejects(client.publish(async () => { throw new ThemeDraftValidationError('Correct saved values'); }), ThemeDraftValidationError);
    assert.equal(client.hasPendingPublication, false);
    await client.save(config('corrected again'));
    assert.equal(client.version, 2);
});
