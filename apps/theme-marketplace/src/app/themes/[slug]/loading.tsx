import { Card, Page, PageContent, PageHeader, Skeleton } from '@letbuyy/ui';

export default function ThemeDetailLoading() {
    return (
        <Page className="theme-marketplace-page">
            <PageHeader
                title="Loading theme"
                eyebrow="Theme marketplace"
                description="Fetching the selected theme details."
                identity="themes"
                showEyebrow
                showDescription
            />
            <PageContent>
                <div className="grid gap-[var(--lb-density-section-gap)] lg:grid-cols-[minmax(0,1fr)_340px]">
                    <Card className="space-y-[var(--lb-space-4)] p-[var(--lb-density-card-padding)]">
                        <Skeleton className="aspect-video min-h-[260px] w-full rounded-[var(--lb-radius-lg)]" />
                        <Skeleton className="h-8 w-2/3" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                    </Card>
                    <Card className="space-y-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                        <Skeleton className="h-8 w-1/2" />
                        <Skeleton className="h-11 w-full" />
                        <Skeleton className="h-11 w-full" />
                    </Card>
                </div>
            </PageContent>
        </Page>
    );
}
