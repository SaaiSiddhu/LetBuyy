import assert from 'node:assert/strict';
import test from 'node:test';
import { liquidRenderFailureDiagnostics } from './liquid-render-diagnostics';

test('classifies deployment failures without logging private warning text', () => {
    const secret = 'private-bearer-value';
    const result = liquidRenderFailureDiagnostics({ status: 'error', warnings: [
        `Liquid layout template failed to render: Cannot find package jsdom from /private/${secret}`,
        `Liquid section failed to render and was skipped: https://private.invalid/?token=${secret}`,
    ] });
    assert.deepEqual(result, { status: 'error', warning_count: 2, failure_codes: ['module_unavailable', 'layout_failed', 'sections_failed'] });
    assert.doesNotMatch(JSON.stringify(result), /private|jsdom|token|https/);
});

test('known SSR, ESM, file, DOM and missing-template failures retain fixed codes', () => {
    for (const [message, code] of [
        ['Theme HTML sanitization requires the Node SSR runtime', 'node_dom_unavailable'],
        ['require() of ES Module', 'esm_interop'], ['ENOENT', 'file_unavailable'],
        ['createDOMPurify is not a function', 'dom_initialization'],
        ['Liquid template index was not found', 'template_unavailable'],
        ['Liquid rendering requires a validated portable Liquid theme bundle.', 'bundle_unsupported'],
    ]) assert.ok(liquidRenderFailureDiagnostics({ status: 'unsupported', warnings: [message!] }).failure_codes.includes(code!));
});

test('unknown warnings remain unavailable and never become log content', () => {
    assert.deepEqual(liquidRenderFailureDiagnostics({ status: 'error', warnings: ['<private HTML>'] }), {
        status: 'error', warning_count: 1, failure_codes: ['unclassified'],
    });
});
