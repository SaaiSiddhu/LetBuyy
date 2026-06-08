import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AppService } from '@/lib/app-service';
import { BadgeCheck, ExternalLink, ShieldCheck, Store } from '@letbuyy/ui';
import Link from 'next/link';

export const metadata = {
    title: 'Partner directory — LetBuyy App Store',
    description: 'Verified LetBuyy app partners and published marketplace apps.',
};

export default async function PartnerDirectoryPage() {
    const partners = await AppService.getPartnerDirectory();

    return (
        <>
            <Header />
            <main className="appstore-main">
                <section className="marketplace-card marketplace-section">
                    <div className="marketplace-section-header">
                        <h1>Partner directory</h1>
                        <p>Browse approved LetBuyy app partners and the public apps they maintain.</p>
                    </div>
                    {partners.length > 0 ? (
                        <div className="partner-directory-grid">
                            {partners.map((partner) => (
                                <article key={partner.id || partner.slug || partner.company_name} className="partner-directory-card">
                                    <div className="partner-directory-card__header">
                                        <div className="marketplace-avatar marketplace-avatar--md">
                                            {(partner.company_name || 'P').charAt(0)}
                                        </div>
                                        <div>
                                            <h2>{partner.company_name}</h2>
                                            <p>{partner.description || 'Approved LetBuyy app partner.'}</p>
                                        </div>
                                    </div>
                                    <div className="app-permission-checklist">
                                        {partner.verified && (
                                            <span>
                                                <BadgeCheck size={14} aria-hidden="true" />
                                                Verified partner
                                            </span>
                                        )}
                                        <span>
                                            <Store size={14} aria-hidden="true" />
                                            {Number(partner.published_apps || 0).toLocaleString()} published apps
                                        </span>
                                        <span>
                                            <ShieldCheck size={14} aria-hidden="true" />
                                            {Number(partner.built_for_letbuyy_apps || 0).toLocaleString()} Built for LetBuyy apps
                                        </span>
                                    </div>
                                    <div className="partner-directory-card__actions">
                                        {partner.slug && (
                                            <Link href={`/developers/${partner.slug}`} className="app-install-secondary-link">
                                                View profile
                                            </Link>
                                        )}
                                        {partner.website_url && (
                                            <a href={partner.website_url} target="_blank" rel="noreferrer" className="app-install-secondary-link">
                                                Website
                                                <ExternalLink size={13} aria-hidden="true" />
                                            </a>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="app-review-empty">
                            <div className="app-review-empty__icon">
                                <Store size={20} aria-hidden="true" />
                            </div>
                            <h2>No partners listed</h2>
                            <p>No approved partners have public listings yet.</p>
                        </div>
                    )}
                </section>
            </main>
            <Footer />
        </>
    );
}
