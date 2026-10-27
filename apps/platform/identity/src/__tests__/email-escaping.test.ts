// APPID-SEC2 — identity-platform's emails treat every value they did not write as text.
//
// Until APPID-SEC2 a store name, a store type, a link, a device name, an IP address and a location
// were inserted into email HTML as given. Two public routes let anyone supply them, so anyone could
// have LetBuyy send markup of their choosing, from LetBuyy's own address, to any inbox.

import assert from 'node:assert/strict'
import test from 'node:test'
import { escapeHtml, newDeviceLoginEmail, safeHttpUrl, storeCreatedEmail, otpEmail, passwordResetEmail } from '../lib/email/resend'


function assertOnlyBrandImage(html: string) {
    const images = Array.from(html.matchAll(/<img\b[^>]*>/gi), match => match[0])
    assert.equal(images.length, 1, 'only the system-owned LetBuyy logo is an image')
    assert.match(images[0], /src="https:\/\/[^"<>]+\/icons\/letbuyy-logo-512\.png"/)
    assert.doesNotMatch(images[0], /\son[a-z]+=/i)
    // Tokenize quoted attribute values too: harmless escaped user text inside a
    // quoted href is not an event attribute. Only actual attribute names count.
    for (const tag of html.matchAll(/<[a-z][^<>]*>/gi)) {
        const attributes = tag[0].match(/[^\s="'<>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g) || []
        for (const attribute of attributes.slice(1)) assert.doesNotMatch(attribute, /^on[a-z]+\s*=/i)
    }
}

const HOSTILE = `"><img src=x onerror="alert(1)"><a href='https://evil.example'>click</a>`

test('escapeHtml neutralises every character that can open markup or end an attribute', () => {
    assert.equal(escapeHtml(`<b>"x" & 'y'</b>`), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;')
    assert.equal(escapeHtml('Plain Store 42'), 'Plain Store 42')
})

test('a link is an http(s) URL or nothing', () => {
    assert.equal(safeHttpUrl('https://shop.letbuyy.com'), 'https://shop.letbuyy.com')
    assert.equal(safeHttpUrl('http://localhost:9000/?a=1&b=2'), 'http://localhost:9000/?a=1&amp;b=2')
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>', '//evil.example', 'evil.example', '']) {
        assert.equal(safeHttpUrl(bad), '#', bad)
    }
})

test('the store-created email carries hostile input as text', () => {
    const { subject, html } = storeCreatedEmail({
        storeName: HOSTILE,
        siteType: '<b>not-a-type</b>',
        storeUrl: 'javascript:alert(document.domain)',
        adminUrl: `https://admin.letbuyy.com/x" onmouseover="alert(1)`,
    })
    assertOnlyBrandImage(html)
    assert.ok(!html.includes("href='https://evil.example'"), 'no injected link')
    assert.ok(!html.includes('javascript:'), 'no script URL')
    assert.ok(!html.includes('" onmouseover="'), 'no attribute break-out')
    assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'), 'the name is shown, escaped')
    assert.ok(!subject.includes('<b>') && !html.includes('<b>not-a-type</b>'), 'an unknown type is not echoed')
    assert.equal(subject, 'Your LetBuyy store is ready to shape')
})

test('the store-created email still reads normally for ordinary input', () => {
    const { subject, html } = storeCreatedEmail({
        storeName: "Asha's Handloom",
        siteType: 'ecommerce',
        storeUrl: 'https://asha.letbuyy.com',
        adminUrl: 'https://admin.letbuyy.com/asha',
    })
    assert.equal(subject, 'Your LetBuyy store is ready to shape')
    assert.ok(html.includes('Asha&#39;s Handloom'))
    assert.ok(!html.includes('href="https://asha.letbuyy.com"'), 'creation mail does not imply an unpublished store is public')
    assert.ok(html.includes('href="https://admin.letbuyy.com/asha"'))
})

test('the new-device alert carries the client-written device, address and location as text', () => {
    const { html } = newDeviceLoginEmail(
        { device: HOSTILE, ip: '203.0.113.9"><script>x()</script>', location: '<i>Mumbai</i>' },
        new Date('2026-09-24T10:00:00Z'),
    )
    assertOnlyBrandImage(html)
    assert.ok(!html.includes('<script>') && !html.includes('<i>Mumbai</i>'))
    assert.ok(html.includes('203.0.113.9&quot;&gt;&lt;script&gt;'))
    assert.ok(html.includes('&lt;i&gt;Mumbai&lt;/i&gt;'))
})


test('verification codes stay in the message body and plain text, never subjects or previews', () => {
    const message = otpEmail('123456')
    assert.ok(!message.subject.includes('123456'))
    assert.ok(message.html.includes('123456'))
    assert.ok(message.text.includes('123456'))
    assert.ok(message.text.includes('\n'))
    assert.ok(!message.text.includes('\\n'))
    assertOnlyBrandImage(message.html)
})

test('reset email uses a safe encoded single-use action and the actual token expiry', () => {
    const message = passwordResetEmail('synthetic-preview-token')
    assert.match(message.html, /reset-password\?token=synthetic-preview-token/)
    assert.match(message.html, /60 minutes/)
    assert.ok(!message.subject.includes('synthetic-preview-token'))
    assertOnlyBrandImage(message.html)
})
