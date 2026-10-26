import MarketplacePageHeader from '@/components/marketplace-page-header';
import type { Metadata } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Card, Page, PageContent } from '@letbuyy/ui';
import DeveloperListingBuilderForm from '@/components/developer-listing-builder-form';
import { ThemeService } from '@/lib/theme-service';

export const metadata: Metadata = {
    title: 'Create theme listing',
    robots: { index: false, follow: false },
};

function formStringValue(value: FormDataEntryValue | null): string {
    return typeof value === 'string' ? value.trim() : '';
}

function listValue(value: string): string[] {
    return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 30);
}

async function submitDeveloperListingAction(formData: FormData) {
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
            { name: formStringValue(formData.get('license_standard')) || 'Standard', terms_status: 'local_terms_accepted' },
            { name: formStringValue(formData.get('license_extended')) || 'Extended', terms_status: 'local_terms_accepted' },
        ],
        bundle_manifest: {
            source: 'developer-listing-builder',
            bundle_upload_status: 'local_scanner_ready',
            zip_url: formStringValue(formData.get('zip_url')),
            asset_urls: listValue(formStringValue(formData.get('asset_urls'))),
        },
        agreement_accepted: formData.get('agreement_accepted') === 'on',
        submit: formData.get('submit') === 'on',
    });

    revalidatePath('/developer');
    redirect('/developer?saved=1');
}

export default function NewDeveloperListingPage() {
    return (
        <Page>
            <MarketplacePageHeader artwork="create"
                title="Create Theme Listing"
                eyebrow="Developer console"
                description="Build a marketplace listing with pricing, license tiers, screenshots, upload metadata, and review submission status."
                identity="themes"
                showBreadcrumbs
                showDescription
                showEyebrow
                breadcrumbs={[
                    { label: 'Developer', href: '/developer' },
                    { label: 'Create listing' },
                ]}
                primaryAction={{ label: 'Developer dashboard', href: '/developer' }}
            />
            <PageContent>
                <Card layout="stack" className="gap-[var(--lb-space-5)] p-[var(--lb-density-card-padding)]">
                    <DeveloperListingBuilderForm action={submitDeveloperListingAction} />
                </Card>
            </PageContent>
        </Page>
    );
}
