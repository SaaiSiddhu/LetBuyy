import MarketplacePageHeader from '@/components/marketplace-page-header';
import type { Metadata } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Button, Card, Input, Page, PageContent, Select, Textarea } from '@letbuyy/ui';
import { ThemeService } from '@/lib/theme-service';

export const metadata: Metadata = {
    title: 'For Developers',
    robots: { index: false, follow: true },
};

function formStringValue(value: FormDataEntryValue | null): string {
    return typeof value === 'string' ? value.trim() : '';
}

function listValue(value: string): string[] {
    return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 30);
}

async function createListingAction(formData: FormData) {
    'use server';

    const slug = formStringValue(formData.get('slug'));
    await ThemeService.createDeveloperListing({
        slug,
        name: formStringValue(formData.get('name')),
        short_description: formStringValue(formData.get('short_description')),
        long_description: formStringValue(formData.get('long_description')),
        category: formStringValue(formData.get('category')) as 'store' | 'portfolio' | 'resume' | 'landing' | 'saas',
        industries: listValue(formStringValue(formData.get('industries'))),
        tags: listValue(formStringValue(formData.get('tags'))),
        supported_platforms: listValue(formStringValue(formData.get('supported_platforms'))) as Array<'letbuyy' | 'wordpress' | 'html' | 'react'>,
        screenshots: listValue(formStringValue(formData.get('screenshots'))),
        pricing: {
            type: formStringValue(formData.get('pricing_type')) || 'free',
            amount_inr: Number(formStringValue(formData.get('amount_inr')) || 0),
            revenue_share_rate: 15,
        },
        license_tiers: [
            {
                name: formStringValue(formData.get('license_tier')) || 'Standard',
                terms_status: 'local_terms_accepted',
            },
        ],
        bundle_manifest: {
            source: 'developer-console',
            bundle_upload_status: 'local_scanner_ready',
        },
        agreement_accepted: formData.get('agreement_accepted') === 'on',
        submit: formData.get('submit') === 'on',
    });

    revalidatePath('/developer');
    redirect('/developer?saved=1');
}

function recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function statusLabel(value: unknown, fallback: string): string {
    const status = typeof value === 'string' ? value : fallback;
    const labels: Record<string, string> = {
        active: 'Active',
        passed: 'Passed local scan',
        failed: 'Failed local scan',
        local_scanner_ready: 'Local scanner ready',
        local_provider_ready: 'Local provider ready',
        manual: 'Manual payout rail',
        local_terms_accepted: 'Developer terms accepted',
    };

    return labels[status] || status.replace(/_/g, ' ');
}

export default async function DeveloperPage({ searchParams }: { searchParams?: Promise<{ saved?: string }> }) {
    const params = await searchParams;
    const dashboard = await ThemeService.getDeveloperDashboard();
    const listings = Array.isArray(dashboard?.listings) ? dashboard.listings as Record<string, unknown>[] : [];
    const payoutAccount = recordValue(dashboard?.payout_account);

    return (
        <Page>
            <MarketplacePageHeader artwork="create"
                title="Developer Console"
                eyebrow="Theme developer program"
                description="Create listings, submit themes for review, and track payout readiness from the marketplace backend."
                identity="themes"
                showEyebrow
                showDescription
            />
            <PageContent>
                <div className="grid gap-[var(--lb-density-section-gap)] lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                    <Card layout="stack" className="gap-[var(--lb-space-4)] p-[var(--lb-density-card-padding)]">
                        <div>
                            <h2 className="m-0 text-[length:var(--lb-font-size-heading-3)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                Listing builder
                            </h2>
                            <p className="m-0 text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text-subdued)]">
                                Saved listings enter the review pipeline when submitted. Local scanner checks and the 15% payout default are applied before review.
                            </p>
                        </div>

                        {params?.saved === '1' && (
                            <p className="m-0 rounded-[var(--lb-radius-md)] border border-[var(--lb-component-banner-success-border)] bg-[var(--lb-component-banner-success-bg)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-component-banner-success-text)]">
                                Listing saved.
                            </p>
                        )}

                        <form action={createListingAction} className="grid gap-[var(--lb-space-3)]">
                            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                                <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                    Theme name
                                    <Input unstyled name="name" required minLength={3} maxLength={120} className="min-h-[44px] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]" />
                                </label>
                                <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                    Slug
                                    <Input unstyled name="slug" required minLength={3} maxLength={80} pattern="[a-z0-9][a-z0-9-]*" className="min-h-[44px] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]" />
                                </label>
                            </div>
                            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                                <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                    Category
                                    <Select
                                        unstyled
                                        name="category"
                                        required
                                        className="min-h-[44px] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]"
                                        options={['store'].map((category) => ({ label: category, value: category }))}
                                    />
                                </label>
                                <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                    Pricing type
                                    <Select
                                        unstyled
                                        name="pricing_type"
                                        className="min-h-[44px] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]"
                                        options={[
                                            { label: 'Free', value: 'free' },
                                            { label: 'One-time INR', value: 'one_time' },
                                        ]}
                                    />
                                </label>
                            </div>
                            <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                Short description
                                <Input unstyled name="short_description" required minLength={10} maxLength={280} className="min-h-[44px] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]" />
                            </label>
                            <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                Long description
                                <Textarea unstyled name="long_description" rows={4} maxLength={5000} className="rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]" />
                            </label>
                            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                                <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                    Industries
                                    <Input unstyled name="industries" placeholder="fashion, retail" className="min-h-[44px] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]" />
                                </label>
                                <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                    Tags
                                    <Input unstyled name="tags" placeholder="minimal, conversion" className="min-h-[44px] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]" />
                                </label>
                            </div>
                            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                                <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                    Supported platforms
                                    <Input unstyled name="supported_platforms" defaultValue="letbuyy,html,react" className="min-h-[44px] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]" />
                                </label>
                                <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                    Amount INR
                                    <Input unstyled name="amount_inr" type="number" min="0" step="1" defaultValue="0" className="min-h-[44px] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]" />
                                </label>
                            </div>
                            <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                Screenshot URLs
                                <Input unstyled name="screenshots" placeholder="https://..." className="min-h-[44px] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]" />
                            </label>
                            <label className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                License tier
                                <Input unstyled name="license_tier" defaultValue="Standard" className="min-h-[44px] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]" />
                            </label>
                            <div className="grid gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                                <label className="flex items-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]">
                                    <Input unstyled name="agreement_accepted" type="checkbox" className="h-4 w-4" />
                                    Developer agreement accepted for this submission
                                </label>
                                <label className="flex items-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]">
                                    <Input unstyled name="submit" type="checkbox" className="h-4 w-4" />
                                    Submit for review now
                                </label>
                            </div>
                            <Button unstyled type="submit" className="inline-flex min-h-[var(--lb-density-button-height)] w-fit items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-primary-border)] bg-[var(--lb-component-button-primary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-primary-text)]">
                                Save listing
                            </Button>
                        </form>
                    </Card>

                    <div className="grid gap-[var(--lb-density-section-gap)]">
                        <Card layout="stack" className="gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                            <h2 className="m-0 text-[length:var(--lb-font-size-heading-3)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                Program status
                            </h2>
                            <dl className="m-0 grid gap-[var(--lb-space-3)]">
                                {[
                                    ['Revenue share', payoutAccount.revenue_share_rate ? `${payoutAccount.revenue_share_rate}%` : '15%'],
                                    ['Payout schedule', typeof payoutAccount.payout_schedule === 'string' ? payoutAccount.payout_schedule : 'monthly'],
                                    ['Payout provider', typeof payoutAccount.payout_provider === 'string' ? payoutAccount.payout_provider : 'manual'],
                                    ['Onboarding', statusLabel(payoutAccount.onboarding_status, 'active')],
                                ].map(([term, detail]) => (
                                    <div key={String(term)} className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                                        <dt className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase text-[color:var(--lb-color-text-muted)]">{term}</dt>
                                        <dd className="m-0 text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]">{String(detail)}</dd>
                                    </div>
                                ))}
                            </dl>
                        </Card>

                        <Card layout="stack" className="gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                            <h2 className="m-0 text-[length:var(--lb-font-size-heading-3)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                Listings
                            </h2>
                            {listings.length > 0 ? (
                                <div className="grid gap-[var(--lb-space-3)]">
                                    {listings.map((listing) => (
                                        <div key={String(listing.id || listing.slug)} className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                                            <p className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                                {String(listing.name || listing.slug || 'Untitled listing')}
                                            </p>
                                            <p className="m-0 text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                                                {statusLabel(listing.submission_status, 'draft')} · {statusLabel(listing.asset_scan_status, 'passed')}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="m-0 text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text-subdued)]">
                                    No developer listings yet.
                                </p>
                            )}
                        </Card>
                    </div>
                </div>
            </PageContent>
        </Page>
    );
}
