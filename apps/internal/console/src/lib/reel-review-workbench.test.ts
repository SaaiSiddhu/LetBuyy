// Real component SSR; the server action seam is inert until hydration. This is
// not normal reviewer login, inspection or mounted browser acceptance.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const modules = require('node:module') as { _load: (name: string, ...args: unknown[]) => unknown };
const original = modules._load;
modules._load = function (name, ...args) {
    if (name === 'next/navigation') return { useParams: () => ({ id: 'synthetic-review' }), usePathname: () => '/reels/synthetic-review' };
    if (name === '../actions') return { loadReelReview: () => { throw new Error('SSR must not call an inspection action'); }, reviewReel: () => { throw new Error('SSR must not mutate review'); } };
    if (name.startsWith('@/')) return original.call(this, fileURLToPath(new URL('../' + name.slice(2), import.meta.url)), ...args);
    return original.call(this, name, ...args);
};
Object.assign(globalThis, { React });
try {
    const Page = require('../app/(dashboard)/reels/[id]/page.tsx').default;
    test('reviewer entry waits for current session/revision without exposing a playable URL or approval action', () => {
        const html = renderToStaticMarkup(React.createElement(Page));
        assert.match(html, /Checking reviewer session and revision/);
        assert.match(html, /Back to queue/);
        assert.doesNotMatch(html, /<video|<iframe|Approve inspected revision|synthetic-review/);
    });
} finally { modules._load = original; }
