// Initial SSR state only. Actual persistence/interactions require owned browser proof.
import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const modules = require('node:module') as { _load: (name: string, ...args: unknown[]) => unknown }
const original = modules._load
modules._load = function (name, ...args) {
    if (name === 'next/navigation') return { useParams: () => ({ store: 'synthetic-store' }) }
    if (name.startsWith('@/')) return original.call(this, fileURLToPath(new URL('../src/' + name.slice(2), import.meta.url)), ...args)
    return original.call(this, name, ...args)
}
Object.assign(globalThis, { React })
try {
    const Page = require('../src/app/[store]/content/reels/page.tsx').default
    const { MerchantSecurityContext } = require('../src/components/security/MerchantSecurityContext.tsx')
    test('normal merchant entry remains an explicit private loading state with no upload or approval promise', () => {
        const html = renderToStaticMarkup(<MerchantSecurityContext.Provider value={{ actorId: 'synthetic-actor', store: 'synthetic-store' }}><Page /></MerchantSecurityContext.Provider>)
        assert.match(html, /Checking private reel access/)
        assert.match(html, /Saving a draft does not publish or approve it/)
        assert.match(html, /Generic public uploads cannot be submitted as reels/)
        assert.doesNotMatch(html, /<video|<iframe|type="file"/)
    })
} finally { modules._load = original }
