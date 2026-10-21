import { Card, Page, Section, Skeleton } from '@letbuyy/ui'

export default function MerchantLoading() {
    return (
        <Page>
            <div role="status" aria-label="Loading page" aria-busy="true">
                <Skeleton variant="text" lines={2} />
                <Card>
                    <Section>
                        <Skeleton variant="card" />
                        <Skeleton variant="table" lines={5} />
                    </Section>
                </Card>
            </div>
        </Page>
    )
}
