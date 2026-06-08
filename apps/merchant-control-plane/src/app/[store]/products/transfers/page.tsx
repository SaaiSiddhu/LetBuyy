'use client'

import { Button, Banner,
    Card,
    EmptyState,
    Page,
    PageHeader,
    RefreshCw,
    Section,
    Truck,
} from '@letbuyy/ui'

export default function TransfersPage() {
    return (
        <Page>
            <PageHeader
                title="Transfers"
                description="Move stock between locations and keep inventory balanced."
                breadcrumbs={[{ label: 'Products' }, { label: 'Transfers' }]}
            />

            <Banner variant="info" title="Transfers are not available yet">
                You can still adjust stock from Inventory while location transfers are prepared for this store.
            </Banner>

            <Card>
                <Section title="Location transfers" description="Reserve, ship, and receive stock between locations.">
                    <EmptyState
                        icon={<RefreshCw className="h-[var(--lb-size-icon-lg)] w-[var(--lb-size-icon-lg)]" aria-hidden="true" />}
                        title="Move inventory between locations"
                        body="Transfers will help balance stock across warehouses, stores, and fulfillment locations."
                        primaryAction={<Button type="button" disabled>Create transfer</Button>}
                        secondaryAction={(
                            <Button type="button" variant="secondary" disabled>
                                <Truck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                Receive transfer
                            </Button>
                        )}
                    />
                </Section>
            </Card>
        </Page>
    )
}
