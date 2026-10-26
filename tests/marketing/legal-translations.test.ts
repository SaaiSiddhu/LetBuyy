import assert from 'node:assert/strict'
import test from 'node:test'
import { LEGAL_DOCUMENTS, getLegalDocument } from '../../apps/marketing/web/src/lib/legal/documents'
import { legalSourceText, localizeLegalContent } from '../../apps/marketing/web/src/lib/i18n/legal-content'

for (const { slug } of LEGAL_DOCUMENTS) {
    for (const language of ['hi', 'ta']) {
        test(`${language}/${slug}: preserves every clause, list and stable anchor without mutating English`, () => {
            const source = getLegalDocument(slug)!
            const before = JSON.stringify(source)
            const { document, translated } = localizeLegalContent(source, language)
            assert.equal(translated, true)
            assert.notEqual(document.title, source.title)
            assert.equal(legalSourceText(document).length, legalSourceText(source).length)
            assert.deepEqual(document.clauses.map(c => c.id), source.clauses.map(c => c.id))
            for (let i = 0; i < source.clauses.length; i++) {
                assert.equal(document.clauses[i].body.length, source.clauses[i].body.length)
                assert.equal(document.clauses[i].list?.length, source.clauses[i].list?.length)
                assert.equal(Boolean(document.clauses[i].note), Boolean(source.clauses[i].note))
            }
            assert.equal(document.slug, source.slug)
            assert.equal(document.group, source.group)
            assert.equal(document.audience, source.audience)
            assert.equal(JSON.stringify(source), before)
        })
    }
}

test('a changed English clause rejects an outdated translation instead of shifting content', () => {
    const source = structuredClone(getLegalDocument('grievance')!)
    source.clauses[0].body[0] += ' Source revision.'
    assert.throws(() => localizeLegalContent(source, 'ta'), /Outdated or incomplete/)
})

test('English remains the original policy object', () => {
    const source = getLegalDocument('terms')!
    assert.equal(localizeLegalContent(source, 'en').document, source)
})
