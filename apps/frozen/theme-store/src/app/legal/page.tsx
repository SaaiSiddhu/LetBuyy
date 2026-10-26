import type { Metadata } from 'next';
import { Banner } from '@letbuyy/ui';
import MarketplaceContentPage, { ResourceGrid } from '@/components/marketplace-content-page';
import { MARKETPLACE_POLICIES } from '@/lib/marketplace-policies';
export const metadata: Metadata = {title:'Legal and privacy',robots:{index:false,follow:true}};
export default function LegalPage() {
    return <MarketplaceContentPage artwork="legal" title="Clear information. In one place." intro="Review the documents about marketplace use, theme rights, purchases, data, and support." eyebrow="Legal and privacy">
        <Banner variant="info" title="Documents for review">These local review copies describe current workflows and identify terms that still require approval. They are not represented as approved effective policies.</Banner>
        <ResourceGrid items={MARKETPLACE_POLICIES.map(policy=>({title:policy.title,description:policy.summary,href:`/legal/${policy.slug}`,label:'Read review document'}))} />
    </MarketplaceContentPage>;
}
