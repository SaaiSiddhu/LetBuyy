import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import TrialBanner from '../src/components/TrialBanner'
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime.js'
import SelectPlanClient from '../src/app/[store]/access_account/checkout/select-plan/SelectPlanClient'
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
