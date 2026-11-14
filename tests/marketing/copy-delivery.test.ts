import assert from 'node:assert/strict'
import test from 'node:test'
import { COPY } from '../../apps/marketing/web/src/lib/i18n/copy-catalog'
import { getCopyMessages, translateCopy } from '../../apps/marketing/web/src/lib/i18n/copy'
import { formatCopy } from '../../apps/marketing/web/src/lib/i18n/copy-format'
import { BRAND_PROFILES } from '@letbuyy/shared-types/brand'
import { BRAND_PROFILES as originalBrandProfiles } from '../../packages/shared-types/src/brand'

test('the selected client catalogue preserves every translation and variable substitution', () => {
    for (const language of ['en', 'hi', 'ta']) {
        const selected = getCopyMessages(language)
        if (language === 'en') assert.deepEqual(selected, {})
        for (const source of Object.keys(COPY)) {
            const variables = Object.fromEntries([...source.matchAll(/\{(\w+)\}/g)].map(([, name]) => [name, `value-${name}`]))
            assert.equal(formatCopy(source, selected, variables), translateCopy(language, source, variables), `${language}: ${source}`)
        }
    }
})

test('unknown copy and literal prototype names fall back safely without altering unresolved placeholders', () => {
    for (const language of ['en', 'hi', 'ta', 'unknown']) {
        const selected = getCopyMessages(language)
        for (const text of ['constructor', '__proto__', 'hasOwnProperty', 'Unknown {name} / {remaining}']) {
            assert.equal(formatCopy(text, selected, { name: 'merchant' }), text.replace('{name}', 'merchant'))
        }
    }
})

test('the lightweight public brand export remains the canonical brand contract', () => {
    assert.equal(BRAND_PROFILES, originalBrandProfiles)
})
