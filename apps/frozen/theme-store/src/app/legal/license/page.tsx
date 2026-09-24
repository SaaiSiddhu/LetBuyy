import type { Metadata } from 'next';
import PolicyDraftPage from '@/components/policy-draft-page';

export const metadata: Metadata = {
    title: 'License Agreement',
    robots: { index: false, follow: true },
};

export default function LicensePage() {
    return (
        <PolicyDraftPage
            title="Theme Marketplace License"
            description="Draft operational license structure for purchased and free LetBuyy themes."
            sections={[
                {
                    title: 'License issue',
                    body: 'Completed paid purchases receive a generated license key and receipt record after provider signature verification. Free themes can be added to an authenticated store library without payment.',
                },
                {
                    title: 'Installation scope',
                    body: 'Theme installs are store-scoped actions and must pass the store ownership guard before preview, install, publish, rollback, or update workflows run.',
                },
                {
                    title: 'Artifacts',
                    body: 'Standalone artifacts are entitlement-checked before download. Real package files, sizes, checksums, and signed URLs require object storage configuration.',
                },
                {
                    title: 'Developer tiers',
                    body: 'Developer listing forms capture license-tier metadata, while final tier names, limits, and commercial terms require program approval.',
                },
            ]}
        />
    );
}
