import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MarketplaceReviewPanel, type MarketplaceListingStatus } from '../src/components/products/MarketplaceReviewPanel'

Object.assign(globalThis, { React })

const rejected: MarketplaceListingStatus = {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    product_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    status: 'rejected',
    rejection_reason: 'Add the country-of-origin disclosure.',
}

function render(options: Partial<React.ComponentProps<typeof MarketplaceReviewPanel>> = {}) {
    return renderToStaticMarkup(<MarketplaceReviewPanel
        listing={rejected}
        loaded
        correction="Updated origin details"
        error={null}
        submitting={false}
        hasUnsavedChanges={false}
        onCorrectionChange={() => undefined}
        onResubmit={() => undefined}
        {...options}
    />)
}

function resubmitButtonDisabled(html: string) {
    const button = /<button\b([^>]*)>/.exec(html)
    assert.ok(button, 'expected the review panel to render a resubmit button')
    return /\sdisabled(?:="")?(?=\s|$)/.test(button[1])
}

test('rejected listing shows reviewer feedback and requires saved, complete corrections before resubmit', () => {
    const unsaved = render({ hasUnsavedChanges: true })
    assert.match(unsaved, /Add the country-of-origin disclosure\./)
    assert.match(unsaved, /What did you correct\?/)
    assert.match(unsaved, /Save product before resubmitting/)
    assert.equal(resubmitButtonDisabled(unsaved), true)

    const short = render({ correction: 'fixed' })
    assert.match(short, /Resubmit for marketplace review/)
    assert.equal(resubmitButtonDisabled(short), true)

    const ready = render()
    assert.match(ready, /Resubmit for marketplace review/)
    assert.equal(resubmitButtonDisabled(ready), false)
})

test('status, submission and retry failures are visible without exposing controls for other states', () => {
    const unavailable = render({ listing: null, error: 'Could not verify listing status.' })
    assert.match(unavailable, /Marketplace review status unavailable/)
    assert.match(unavailable, /Could not verify listing status\./)
    assert.doesNotMatch(unavailable, /What did you correct\?/)

    const retryFailure = render({ error: 'The review changed; reload and try again.' })
    assert.match(retryFailure, /Resubmission needs attention/)
    assert.match(retryFailure, /reload and try again/)
    assert.equal(resubmitButtonDisabled(render({ submitting: true })), true)
})

test('pending and approved listings communicate their state without correction controls', () => {
    const pending = render({ listing: { ...rejected, status: 'pending_review' } })
    assert.match(pending, /This revision is waiting for marketplace review\./)
    assert.doesNotMatch(pending, /What did you correct\?/)

    const approved = render({ listing: { ...rejected, status: 'approved' } })
    assert.match(approved, /This revision is approved for marketplace discovery\./)
    assert.doesNotMatch(approved, /Resubmit for marketplace review/)
})
