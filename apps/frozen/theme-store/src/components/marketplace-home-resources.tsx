import Link from 'next/link';
import {ResourceGrid} from './marketplace-content-page';
import MarketplaceFaqs from './marketplace-faqs';
import {MARKETPLACE_FAQS} from '@/lib/marketplace-content';
import MarketplaceThemeJourney from './marketplace-theme-journey';
export default function MarketplaceHomeResources(){return <>
    <MarketplaceThemeJourney />
    <section className="marketplace-section marketplace-container" aria-labelledby="explore-beyond"><div className="marketplace-section-heading"><div><h2 id="explore-beyond">More ways to find your starting point</h2><p>Explore by purpose, understand the details, or return to a design you saved.</p></div></div><ResourceGrid items={[{title:'Explore collections and website types',description:'Start with online stores, portfolios, professional profiles, landing pages, or product presentations.',href:'/collections'},{title:'Understand theme pricing',description:'Know where theme cost, license scope, platform plans, and available downloads fit together.',href:'/pricing'},{title:'Return to your themes',description:'Reopen your library, saved candidates, purchases, and available installed versions.',href:'/dashboard'}]}/></section>
    <section className="marketplace-section marketplace-container" aria-labelledby="home-questions"><div className="marketplace-section-heading"><div><h2 id="home-questions">A few things you might be wondering</h2><p>Get the details before you choose.</p></div><Link href="/faq" className="marketplace-text-link">All questions and answers</Link></div><MarketplaceFaqs items={MARKETPLACE_FAQS.filter(item=>['public-preview','free-paid','add-publish','coding'].includes(item.id))}/><div className="marketplace-hero-actions"><Link href="/support" className="marketplace-text-link">Visit the support center</Link><Link href="/legal" className="marketplace-text-link">Review legal and privacy information</Link></div></section>
</>;}
