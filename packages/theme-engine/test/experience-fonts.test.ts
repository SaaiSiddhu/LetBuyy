// Phase-2.5 Stream D — Experience font system.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
    EXPERIENCE_FONT_REGISTRY,
    buildExperienceFontLinkHref,
    buildGoogleFontsHref,
    collectExperienceFontFamilies,
    collectExperienceFontIssues,
    fontFamilyWithFallback,
    getExperience,
    listExperiences,
} from '../src/index.ts';

test('D: every font referenced by every experience is registered (no silent fallback gaps)', () => {
    assert.deepEqual(collectExperienceFontIssues(), []);
});

test('D: each experience yields a Google Fonts href OR null (system-only) — all non-broken', () => {
    for (const exp of listExperiences()) {
        const href = buildExperienceFontLinkHref(exp);
        if (href !== null) {
            assert.match(href, /^https:\/\/fonts\.googleapis\.com\/css2\?family=/);
            assert.match(href, /display=swap/);
        }
        // collected families are always registered (covered by collectExperienceFontIssues)
        assert.ok(collectExperienceFontFamilies(exp).length >= 1, exp.id);
    }
});

test('D: a custom-font experience (Sense → Playfair Display) emits a real stylesheet link', () => {
    const sense = getExperience('sense')!;
    const href = buildExperienceFontLinkHref(sense)!;
    assert.match(href, /Playfair\+Display/);
    assert.match(href, /family=Inter/); // body font too
});

test('D: a system-font experience (Summit → Inter only) still loads Inter (not null)', () => {
    const summit = getExperience('summit')!;
    const href = buildExperienceFontLinkHref(summit);
    assert.match(String(href), /family=Inter/);
});

test('D: buildGoogleFontsHref dedupes, ignores unknown families, and returns null when empty', () => {
    assert.equal(buildGoogleFontsHref([]), null);
    assert.equal(buildGoogleFontsHref(['Nonexistent Font']), null);
    const href = buildGoogleFontsHref(['Inter', 'Inter', 'Lato'])!;
    assert.equal((href.match(/family=Inter:/g) || []).length, 1); // deduped
    assert.match(href, /family=Lato/);
});

test('D: fontFamilyWithFallback always appends a safe fallback stack', () => {
    assert.match(fontFamilyWithFallback('Playfair Display'), /"Playfair Display", Georgia/);
    assert.match(fontFamilyWithFallback('Unknown'), /"Unknown", system-ui/);
    assert.ok(Object.keys(EXPERIENCE_FONT_REGISTRY).length >= 6);
});
