'use client'

import { Badge, Banner, Button, Card, Section, Textarea } from '@letbuyy/ui'

export interface MarketplaceListingStatus {
    id: string
    product_id: string
    status: string
    rejection_reason: string | null
}

export function MarketplaceReviewPanel({
    listing,
    loaded,
    correction,
    error,
    submitting,
    hasUnsavedChanges,
    onCorrectionChange,
    onResubmit,
}: {
    listing: MarketplaceListingStatus | null
    loaded: boolean
    correction: string
    error: string | null
    submitting: boolean
    hasUnsavedChanges: boolean
    onCorrectionChange: (value: string) => void
    onResubmit: () => void
}) {
    if (!loaded || (!listing && !error)) return null

    return <Card>
        <Section title="Marketplace review" description="Review status and correction feedback for this product’s marketplace listing.">
            {!listing && error && <Banner variant="critical" title="Marketplace review status unavailable">{error}</Banner>}
            {listing && <>
                <Badge label={listing.status.replaceAll('_', ' ')} variant={listing.status === 'approved' ? 'success' : listing.status === 'rejected' ? 'warning' : 'default'} />
                {listing.status === 'rejected' && <>
                    {listing.rejection_reason && <div className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                        <p className="mb-[var(--lb-space-1)] font-medium">Reviewer feedback</p>
                        <p className="m-0 whitespace-pre-wrap">{listing.rejection_reason}</p>
                    </div>}
                    <Textarea
                        label="What did you correct?"
                        value={correction}
                        minLength={8}
                        maxLength={500}
                        onChange={(event) => onCorrectionChange(event.target.value)}
                        helperText="Save product edits before submitting the corrected revision."
                    />
                    {error && <Banner variant="critical" title="Resubmission needs attention">{error}</Banner>}
                    <Button type="button" variant="primary" onClick={onResubmit} loading={submitting} disabled={submitting || hasUnsavedChanges || correction.trim().length < 8}>
                        {hasUnsavedChanges ? 'Save product before resubmitting' : 'Resubmit for marketplace review'}
                    </Button>
                </>}
                {listing.status === 'pending_review' && <p className="m-0 text-[var(--lb-color-text-subdued)]">This revision is waiting for marketplace review.</p>}
                {listing.status === 'approved' && <p className="m-0 text-[var(--lb-color-text-subdued)]">This revision is approved for marketplace discovery.</p>}
            </>}
        </Section>
    </Card>
}
