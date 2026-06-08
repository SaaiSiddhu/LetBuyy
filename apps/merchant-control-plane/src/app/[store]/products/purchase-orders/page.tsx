'use client'

import { Button, Banner,
    Card,
    ClipboardList,
    EmptyState,
    Page,
    PageHeader,
    Section,
    Truck,
} from '@letbuyy/ui'

export default function PurchaseOrdersPage() {
    return (
        <Page>
            <PageHeader
                title="Purchase orders"
                description="Plan inbound stock and keep supplier orders visible."
                breadcrumbs={[{ label: 'Products' }, { label: 'Purchase orders' }]}
            />

            <Banner variant="info" title="Purchase orders are not available yet">
                You can still adjust stock from Inventory while supplier ordering is prepared for this store.
            </Banner>

            <Card>
                <Section title="Inbound inventory" description="Track stock ordered from suppliers and receive it into inventory.">
                    <EmptyState
                        icon={<ClipboardList className="h-[var(--lb-size-icon-lg)] w-[var(--lb-size-icon-lg)]" aria-hidden="true" />}
                        title="Manage your purchase orders"
                        body="Purchase orders will help you track supplier commitments, expected arrivals, and inventory receiving."
                        primaryAction={<Button type="button" disabled>Create purchase order</Button>}
                        secondaryAction={(
                            <Button type="button" variant="secondary" disabled>
                                <Truck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                Receive stock
                            </Button>
                        )}
                    />
                </Section>
            </Card>
        </Page>
    )
}
