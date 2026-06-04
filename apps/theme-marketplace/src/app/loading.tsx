import { Card, Page, PageContent, PageHeader, Skeleton } from '@letbuyy/ui';

export default function ThemeMarketplaceLoading() {
    return (
        <Page className="theme-marketplace-page">
            <PageHeader
                title="Loading theme marketplace"
                eyebrow="Theme marketplace"
                description="Preparing marketplace data and actions."
                identity="themes"
                showEyebrow
                showDescription
            />
            <PageContent>
                <div className="grid gap-[var(--lb-density-section-gap)] lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]">
                    <Card layout="stack" className="gap-[var(--lb-space-4)] p-[var(--lb-density-card-padding)]">
                        <Skeleton lines={2} />
                        <Skeleton variant="card" className="h-24" />
                        <Skeleton variant="table" lines={5} />
                    </Card>
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2 xl:grid-cols-3">
                        <Skeleton variant="card" />
                        <Skeleton variant="card" />
                        <Skeleton variant="card" />
                    </div>
                </div>
            </PageContent>
        </Page>
    );
}
