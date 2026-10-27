import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_EMAIL_BRAND, ctaButton, formatEmailSender, heading, paragraph, renderEmailShell, verificationCode } from '@letbuyy/notification-core/email';

test('the one email shell contains inline light fallbacks, explicit dark overrides, a public PNG and readable brand text', () => {
    const html = renderEmailShell(DEFAULT_EMAIL_BRAND, heading('Account security') + paragraph('Sample message') + ctaButton('https://accounts.example.invalid/reset', 'Reset password'), { preheader: 'A secure action', reason: 'A request you made', category: 'security' });
    for (const token of ['#6A436B', '#F4F0F5', '#FFFFFF', '#271F2D', '#2D2431', '#6A5E70', '#D7BE98', '#8B7C90']) assert.ok(html.includes(token));
    assert.match(html, /prefers-color-scheme: dark/);
    assert.match(html, /role="presentation"/);
    assert.match(html, /letbuyy-logo-512\.png/);
    assert.match(html, />LetBuyy<\/a>/);
    assert.doesNotMatch(html, /<script|<svg|fonts\.googleapis|<link[^>]+stylesheet/i);
    assert.doesNotMatch(html, />Instagram<|>Facebook</);
    assert.match(html, /background:#6A436B/);
});
test('email sender accepts a bare or named mailbox exactly once and refuses header injection', () => {
    assert.equal(formatEmailSender('noreply@example.invalid'), 'LetBuyy <noreply@example.invalid>');
    assert.equal(formatEmailSender('LetBuyy <noreply@example.invalid>'), 'LetBuyy <noreply@example.invalid>');
    assert.throws(() => formatEmailSender('noreply@example.invalid\r\nBcc:other@example.invalid'));
    assert.throws(() => formatEmailSender('broken sender'));
});
test('untrusted action labels and code values cannot add email markup or active URLs', () => {
    const button = ctaButton('javascript:alert(1)', '<img src=x onerror=alert(1)>');
    assert.doesNotMatch(button, /href="javascript:|<img/);
    assert.match(button, /&lt;img/);
    const code = verificationCode('<script>123456</script>');
    assert.doesNotMatch(code, /<script>/);
    assert.match(code, /&lt;script&gt;/);
});
