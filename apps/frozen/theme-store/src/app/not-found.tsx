import Link from 'next/link';
import { EmptyState } from '@letbuyy/ui';
import MarketplaceContentPage from '@/components/marketplace-content-page';
export default function MarketplaceNotFound() {
    return <MarketplaceContentPage title="Let’s get you back to the right place." eyebrow="Page not found" intro="This page is not available at this address. Find a theme, return to the guides, or open the policy directory.">
        <EmptyState kind="themes" title="We couldn’t find that page" body="The address may be incomplete, or the page may have moved. Choose a destination below to continue." primaryAction={<Link href="/themes" className="marketplace-action">Browse themes</Link>} />
        <nav className="marketplace-hero-actions" aria-label="Page recovery"><Link href="/guides" className="marketplace-text-link">Theme guides</Link><Link href="/legal" className="marketplace-text-link">Legal and privacy</Link><Link href="/support" className="marketplace-text-link">Support center</Link></nav>
    </MarketplaceContentPage>;
}
