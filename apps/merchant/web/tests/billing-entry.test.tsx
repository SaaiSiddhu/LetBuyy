import assert from 'node:assert/strict'
import test from 'node:test'
import React, { act } from 'react'
import { createRequire } from 'node:module'
import { BillingPaymentMethods } from '../src/components/billing/BillingPaymentMethods'
import { ToastProvider } from '@letbuyy/ui'
import { renderToStaticMarkup } from 'react-dom/server'
import TrialBanner from '../src/components/TrialBanner'
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime.js'
import SelectPlanClient from '../src/app/[store]/access_account/checkout/select-plan/SelectPlanClient'
import type { SubscriptionPlanView } from '../src/lib/billing/plan-ui'
import { gstStateCodeFromName } from '../src/lib/india/gst-states'
Object.assign(globalThis, { React })

test('saved billing jurisdiction resolves known selected state labels and never guesses unknown input', () => {
    for (const [name, code] of [['Karnataka', '29'], ['Tamil Nadu', '33'], ['Jammu and Kashmir', '01'], ['Dadra and Nagar Haveli and Daman and Diu', '26'], ['  Karnataka  ', '29']]) {
        assert.equal(gstStateCodeFromName(name), code)
    }
    for (const value of [null, undefined, '', 'Unknown', '29', 'Not Karnataka']) assert.equal(gstStateCodeFromName(value), '')
})
test('trial entry links to the selected store plans and does not promise an extension or all features', () => {
    const markup = renderToStaticMarkup(<TrialBanner storeSlug="alpha-store" trialStatus="active" trialEndsAt={new Date(Date.now() + 3 * 86400000).toISOString()} />)
    assert.match(markup, /href="\/alpha-store\/access_account\/checkout\/select-plan"/)
    assert.doesNotMatch(markup, /href="#"|all features|Unlimited products|Extend your trial/)
})
test('unknown, invalid, expired and paid trial states do not display a fabricated active trial', () => {
    const future = new Date(Date.now() + 3 * 86400000).toISOString()
    for (const [status, end] of [[null, future], ['expired', future], ['active_paid', future], ['active', 'invalid'], ['active', new Date(Date.now() - 10000).toISOString()]]) {
        assert.equal(renderToStaticMarkup(<TrialBanner storeSlug="alpha-store" trialStatus={status} trialEndsAt={end} />), '')
    }
})

test('plan picker uses subscription/trial state rather than a leftover future or expired trial date', () => {
    const router: AppRouterInstance = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} }
    const renderHeading = (currentPlan: string | null, trialStatus: string | null, trialEndsAt: string) => {
        const markup = renderToStaticMarkup(<AppRouterContext.Provider value={router}><SelectPlanClient plans={[]} currentPlan={currentPlan} trialStatus={trialStatus} trialEndsAt={trialEndsAt} storeName="Synthetic store" storeSlug="alpha-store" storeId="11111111-1111-4111-8111-111111111111" siteType="store" /></AppRouterContext.Provider>)
        return markup.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1] || ''
    }
    const future = new Date(Date.now() + 3 * 86400000).toISOString(), past = new Date(Date.now() - 10000).toISOString()
    assert.equal(renderHeading('growth', 'active_paid', future), 'Manage your plan')
    assert.equal(renderHeading('growth', 'active_paid', past), 'Manage your plan')
    assert.doesNotMatch(renderHeading(null, 'active_paid', future), /trial/i)
    assert.doesNotMatch(renderHeading(null, null, future), /trial/i)
    assert.match(renderHeading(null, 'active', future), /left in your trial/)
    assert.match(renderHeading(null, 'expired', past), /trial has ended/)
})


async function mountPaymentMethods(plan: string | null, transport: typeof fetch) {
    const requireUI = createRequire(new URL('../../../../packages/typescript/ui/package.json', import.meta.url))
    const { JSDOM } = requireUI('jsdom')
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:9001/synthetic/settings/billing', pretendToBeVisual: true })
    const names = ['window', 'document', 'navigator', 'self', 'HTMLElement', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'fetch', 'IS_REACT_ACT_ENVIRONMENT']
    const previous = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
    for (const name of names) {
        const value = name === 'fetch' ? transport : name === 'IS_REACT_ACT_ENVIRONMENT' ? true
            : name === 'window' || name === 'self' ? dom.window
                : typeof dom.window[name] === 'function' && ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(name) ? dom.window[name].bind(dom.window) : dom.window[name]
        Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
    }
    const { createRoot } = await import('react-dom/client')
    const root = createRoot(dom.window.document.getElementById('root')!)
    let changed = 0
    await act(async () => { root.render(<ToastProvider duration={0}><BillingPaymentMethods store="synthetic" mandates={[]} currentPlanSlug={plan} currentBillingPeriod="monthly" onChanged={() => { changed++ }} /></ToastProvider>) })
    const click = async (label: string) => {
        const button = [...dom.window.document.querySelectorAll('button')].find((b: HTMLButtonElement) => b.textContent?.trim() === label) as HTMLButtonElement | undefined
        assert.ok(button, `Missing ${label}`)
        await act(async () => { button.click() })
    }
    const close = async () => {
        await act(async () => root.unmount()); dom.window.close()
        for (const name of names) { if (previous[name]) Object.defineProperty(globalThis, name, previous[name]!); else Reflect.deleteProperty(globalThis, name) }
    }
    return { document: dom.window.document as Document, click, close, changed: () => changed }
}

test('payment-method UI preserves Launch/Growth and the request key after uncertain response, and labels sandbox setup honestly', async () => {
    for (const plan of ['launch', 'growth']) {
        const calls: { body: Record<string, unknown>; key: string | null }[] = []
        const fixture = await mountPaymentMethods(plan, (async (_input, init) => {
            calls.push({ body: JSON.parse(String(init?.body)), key: new Headers(init?.headers).get('X-Idempotency-Key') })
            if (calls.length === 1) throw new Error('Synthetic response lost after processing')
            return new Response(JSON.stringify({ data: { mandate: { provider_mode: 'sandbox', status: 'active' } } }), { status: 201 })
        }) as typeof fetch)
        try {
            await fixture.click('Add payment method'); await fixture.click('Set up with Razorpay')
            assert.equal(fixture.changed(), 0)
            await fixture.click('Set up with Razorpay')
            assert.equal(calls.length, 2); assert.equal(calls[0].body.plan_slug, plan)
            assert.equal(calls[1].body.plan_slug, plan); assert.ok(calls[0].key); assert.equal(calls[0].key, calls[1].key)
            assert.equal(fixture.changed(), 1)
            assert.match(fixture.document.body.textContent || '', /Sandbox payment method created/)
            assert.match(fixture.document.body.textContent || '', /No bank or UPI mandate was authorised/)
            assert.doesNotMatch(fixture.document.body.textContent || '', /AutoPay is set up/)
        } finally { await fixture.close() }
    }
})

test('billing without a selected plan offers plan selection and cannot silently request Starter', async () => {
    let requests = 0
    const fixture = await mountPaymentMethods(null, (async () => { requests++; return new Response('{}') }) as typeof fetch)
    try {
        const button = [...fixture.document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Add payment method')
        assert.ok(button); assert.equal(button.disabled, true)
        assert.equal(fixture.document.querySelector('a')?.getAttribute('href'), '/synthetic/access_account/checkout/select-plan')
        await fixture.click('Add payment method'); assert.equal(requests, 0)
    } finally { await fixture.close() }
})


test('annual savings badge is derived from purchasable prices and disappears for a same-price founding quote', () => {
    const router: AppRouterInstance = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} }
    const plan = (monthly: number, annualPerMonth: number, status = 'available'): SubscriptionPlanView => ({
        id:'synthetic-growth',slug:'growth',name:'Growth',tagline:'Synthetic plan',is_popular:true,
        price_monthly_inr:monthly,price_yearly_inr:annualPerMonth,gmv_percentage:0,promo_price_inr:0,promo_months:0,promo_label:null,
        features:[],compare_features:[],requires_contact:false,status,purchasable:status==='available',founding_price_inr:69900,
    })
    const render = (plans: SubscriptionPlanView[]) => renderToStaticMarkup(<AppRouterContext.Provider value={router}><SelectPlanClient plans={plans} currentPlan={null} trialStatus={null} trialEndsAt={null} storeName="Synthetic store" storeSlug="synthetic" storeId="11111111-1111-4111-8111-111111111111" siteType="store" /></AppRouterContext.Provider>)
    assert.doesNotMatch(render([plan(69900,69900)]), /Save 20%|Save up to/)
    assert.match(render([plan(99900,79900)]), /Save up to 20%/)
    assert.doesNotMatch(render([plan(99900,10000,'coming_soon')]), /Save up to/)
})
