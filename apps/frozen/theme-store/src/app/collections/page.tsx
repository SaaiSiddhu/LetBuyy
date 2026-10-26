import type { Metadata } from 'next';
import Link from 'next/link';
import MarketplaceContentPage, { ResourceGrid } from '@/components/marketplace-content-page';
import { DISCOVERY_PATHS } from '@/lib/marketplace-content';
import { ThemeService } from '@/lib/theme-service';
import { stringValue } from '@/lib/theme-catalog';
export const metadata: Metadata = { title:'Explore theme collections',description:'Discover LetBuyy themes by store design, industry and published collections.' };
export default async function CollectionsPage() {
    const [collections,industries]=await Promise.all([ThemeService.getCollections(),ThemeService.getIndustries()]);
    const published=collections.filter(item=>/^[a-z0-9-]+$/.test(stringValue(item,'slug')));
    return <MarketplaceContentPage artwork="discover" title="Find a direction that feels right." eyebrow="Explore themes" intro="Find a storefront style, explore your industry, or narrow the catalog around the features your store needs.">
        <section><h2>A few ways to begin</h2><ResourceGrid items={DISCOVERY_PATHS} /></section>
        <section><h2>Build your online store</h2><ResourceGrid items={[
            {title:'Online stores',description:'Product pages, collection navigation, and layouts for your catalog.',href:'/themes/category/store'},
        ]} /></section>
        {industries.length>0 && <section><h2>Explore an industry</h2><p>Industry is a starting point. Review each theme’s features to decide whether it fits your content.</p><div className="marketplace-category-nav">{Array.from(new Set(industries)).map(industry=><Link key={industry} href={`/themes?industry=${encodeURIComponent(industry)}`}>{industry.replaceAll('-',' ')}</Link>)}</div></section>}
        <section><h2>Published collections</h2>{published.length>0?<ResourceGrid items={published.map(item=>({title:stringValue(item,'title',stringValue(item,'name','Theme collection')),description:stringValue(item,'description','Explore the themes in this published collection.'),href:`/collections/${encodeURIComponent(stringValue(item,'slug'))}`}))}/>:<div className="marketplace-content-note"><p>Published collections are not available here right now. You can still use the full catalog’s filters and sorting to explore the available themes.</p><Link className="marketplace-text-link" href="/themes">Browse the full catalog</Link></div>}</section>
    </MarketplaceContentPage>;
}
