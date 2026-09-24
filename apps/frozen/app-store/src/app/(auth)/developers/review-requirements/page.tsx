import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AppService } from '@/lib/app-service';
import { ShieldCheck } from '@letbuyy/ui';

export const metadata = {
    title: 'App review requirements — LetBuyy App Store',
    description: 'Current LetBuyy app review requirements.',
};

export default async function ReviewRequirementsPage() {
    const policy = await AppService.getReviewPolicy();
    const sections = policy?.sections?.length ? policy.sections : [
        {
            heading: 'Submission checks',
            items: [
                'Valid manifest JSON and declared extension/function surfaces',
                'OAuth redirect URIs and privacy policy URL',
                'Permission scopes that match the app use case',
                'Accurate pricing, trial, and support information',
                'Usage-based billing claims must include metering and merchant approval details',
            ],
        },
    ];

    return (
        <>
            <Header />
            <main className="appstore-main">
                <section className="marketplace-card marketplace-section">
                    <div className="marketplace-section-header">
                        <h1>{policy?.title || 'App review requirements'}</h1>
                        <p>{policy?.summary || 'LetBuyy reviews submitted apps for security, merchant clarity, billing accuracy, and data handling before publication.'}</p>
                    </div>
                    <div className="policy-section-list">
                        {sections.map((section) => (
                            <section key={section.heading} className="policy-section">
                                <h2>{section.heading}</h2>
                                <div className="app-permission-checklist">
                                    {section.items.map((item) => (
                                        <span key={item}>
                                            <ShieldCheck size={14} aria-hidden="true" />
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                    <div className="marketplace-banner marketplace-banner--info">
                        <strong>Review queue</strong>
                        <span>Submitted apps receive automated checks first, then a marketplace review decision with notes when action is required.</span>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    );
}
