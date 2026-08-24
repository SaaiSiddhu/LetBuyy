// T2a-fix/W2/CAP-C19 — regression guard for the composition-engine's head-asset assembly step.
//
// The historical bug: theme-renderer.ts always correctly produced the theme's :root token block
// and lb-* base stylesheet (packages/theme-engine/test/liquid-l2-assets.test.ts proved that end
// for years), but composition-engine.tsx's renderLiquidPlan destructured only
// { header, contentForLayout, footer } off the render result and concatenated them — silently
// dropping the head assets before they ever reached a React component. A renderer-level test alone
// could never have caught this; the gap was entirely on the composition-engine side. This file
// exercises assembleLiquidPageFromRenderResult directly (a pure function, no live DB/store data
// needed) so a future regression here fails fast.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { LiquidRenderedTheme } from '@letbuyy/theme-engine';
import { assembleLiquidPageFromRenderResult } from './liquid-page-assembly';

function fixture(overrides: Partial<LiquidRenderedTheme> = {}): LiquidRenderedTheme {
    return {
        templateKey: 'index',
        layoutHtml: '<!doctype html><html><head></head><body></body></html>',
        contentForLayout: '<main>body</main>',
        sections: [],
        header: '<header>header</header>',
        footer: '<footer>footer</footer>',
        headStyleText: ':root{--primary:#8B5CF6;}.lb-hero-banner{color:red;}',
        ...overrides,
    };
}

test('assembleLiquidPageFromRenderResult carries headStyleText through, not just header/body/footer', () => {
    const result = assembleLiquidPageFromRenderResult(fixture());
    assert.equal(result.html, '<header>header</header><main>body</main><footer>footer</footer>');
    assert.equal(result.headStyleText, ':root{--primary:#8B5CF6;}.lb-hero-banner{color:red;}');
    // The exact assertion that would have caught the historical bug: headStyleText is non-empty
    // and distinct from html — proving it was not silently merged into / dropped alongside the
    // header+contentForLayout+footer concatenation.
    assert.ok(result.headStyleText.length > 0, 'headStyleText must not be empty when the renderer produced one');
    assert.doesNotMatch(result.html, /--primary:/, 'the :root token block must NOT be smuggled into the body HTML');
});

test('assembleLiquidPageFromRenderResult tolerates a missing headStyleText (renderer field is optional)', () => {
    const result = assembleLiquidPageFromRenderResult(fixture({ headStyleText: undefined }));
    assert.equal(result.headStyleText, '', 'missing headStyleText must degrade to an empty string, never throw');
    assert.equal(result.html, '<header>header</header><main>body</main><footer>footer</footer>');
});

test('assembleLiquidPageFromRenderResult tolerates missing header/footer templates (chrome-less Liquid page)', () => {
    const result = assembleLiquidPageFromRenderResult(fixture({ header: undefined, footer: undefined }));
    assert.equal(result.html, '<main>body</main>');
    assert.equal(result.headStyleText, ':root{--primary:#8B5CF6;}.lb-hero-banner{color:red;}');
});
