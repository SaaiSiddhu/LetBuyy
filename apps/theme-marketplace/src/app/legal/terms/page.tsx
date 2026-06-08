import type { Metadata } from 'next';
import PolicyDraftPage from '@/components/policy-draft-page';

export const metadata: Metadata = {
    title: 'Terms of Service',
    robots: { index: false, follow: true },
};

export default function TermsPage() {
    return (
        <PolicyDraftPage
            title="Theme Marketplace Terms"
            description="Draft operational terms for browsing, purchasing, installing, reviewing, and submitting themes."
            sections={[
                {
                    title: 'Marketplace use',
                    body: 'Merchants use the marketplace to browse themes, preview against owned stores, install drafts, publish changes, and roll back releases through authenticated workflows.',
                },
                {
                    title: 'Purchases',
                    body: 'Paid themes use the one-time INR purchase path. The gateway recalculates the theme amount server-side and issues receipt/license records only after provider verification.',
                },
                {
                    title: 'Reviews and reports',
                    body: 'Theme reviews are limited to verified purchasers and enter moderation before publication. Theme reports are tied to listing records for support and operations review.',
                },
                {
                    title: 'Developer submissions',
                    body: 'Developer listings can be saved as drafts or submitted for review. Commercial approval, scanner activation, and payout activation require program approval and provider setup.',
                },
            ]}
        />
    );
}
