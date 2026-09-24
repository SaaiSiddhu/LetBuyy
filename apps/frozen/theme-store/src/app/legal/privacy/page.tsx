import type { Metadata } from 'next';
import PolicyDraftPage from '@/components/policy-draft-page';

export const metadata: Metadata = {
    title: 'Privacy Policy',
    robots: { index: false, follow: true },
};

export default function PrivacyPolicyPage() {
    return (
        <PolicyDraftPage
            title="Theme Marketplace Privacy"
            description="Draft operational privacy notes for marketplace records and user-controlled preferences."
            sections={[
                {
                    title: 'Account records',
                    body: 'Authenticated marketplace workflows read account, purchase, install, review, settings, and developer listing records through the versioned API gateway.',
                },
                {
                    title: 'Device-local preferences',
                    body: 'Favorites and compare selections are non-secret preferences stored locally on the device. They are not authentication tokens and can be cleared by browser storage controls.',
                },
                {
                    title: 'Provider records',
                    body: 'Payment, notification, scanner, storage, and analytics providers require live configuration before production processing. Provider privacy notices must be reviewed before activation.',
                },
                {
                    title: 'Support requests',
                    body: 'Support requests should include only relevant marketplace identifiers such as theme slug, purchase id, receipt number, or listing slug.',
                },
            ]}
        />
    );
}
