import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import CapabilityArtwork from '../../apps/marketing/web/src/components/CapabilityArtwork'

const appRequire = createRequire(new URL('../../apps/marketing/web/package.json', import.meta.url))
const { createElement } = appRequire('react')
const { renderToStaticMarkup } = appRequire('react-dom/server')

test('decorative capability icons remain eager without competing image preloads', () => {
    for (const module of ['storefronts', 'orders', 'inventory', 'payments', 'customers', 'analytics', 'ai', 'b2b']) {
        const html = renderToStaticMarkup(createElement(CapabilityArtwork, { module }))
        assert.doesNotMatch(html, /<link\b[^>]*as="image"/iu, module)
        assert.match(html, /fetchPriority="low"/iu, module)
        assert.match(html, /loading="eager"/u)
        assert.match(html, /width="256" height="256"/u)
        assert.match(html, /alt=""/u)
        assert.match(html, /aria-hidden="true"/u)
        assert.ok(html.includes(`/illustrations/capabilities/icons/${module}-v2.webp`))
    }
})
