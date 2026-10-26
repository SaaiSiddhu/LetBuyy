import Link from 'next/link';
import { Banner } from '@letbuyy/ui';
import MarketplaceContentPage from './marketplace-content-page';
import { MARKETPLACE_POLICIES, POLICY_REVISION, POLICY_VERSION, policySectionId, type MarketplacePolicy } from '@/lib/marketplace-policies';
export default function PolicyDraftPage({ document }: { document: MarketplacePolicy }) {
    return <MarketplaceContentPage artwork="legal" title={document.title} intro={document.summary} eyebrow="Legal and privacy" parent={{label:'Policy directory',href:'/legal'}}>
        <Banner variant="info" title="Review copy · Not effective terms">This document is available for local review. Verified operator details and the relevant commercial and legal approvals are required before effective publication.</Banner>
        <dl className="marketplace-document-meta"><div><dt>Status</dt><dd>For review</dd></div><div><dt>Revision</dt><dd>{POLICY_REVISION}</dd></div><div><dt>Version</dt><dd>{POLICY_VERSION}</dd></div></dl>
        <div className="marketplace-reading-layout"><aside className="marketplace-contents"><nav aria-label="On this page"><strong>In this document</strong>{document.sections.map(section=><a key={section.title} href={`#${policySectionId(section.title)}`}>{section.title}</a>)}</nav><Link href="/legal" className="marketplace-text-link">All policies and notices</Link></aside><article className="marketplace-article">{document.sections.map(section=><section className="marketplace-detail-anchor" key={section.title} id={policySectionId(section.title)}><h2>{section.title}</h2>{section.body.map(body=><p key={body}>{body}</p>)}</section>)}<div className="marketplace-content-note"><h2>Questions about this document?</h2><p>Use the contact route for the relevant theme, account, or purchase. Include only the information needed to understand your question.</p><Link href="/contact" className="marketplace-text-link">Contact options</Link></div></article></div>
        <nav className="marketplace-policy-links" aria-label="Related policies">{MARKETPLACE_POLICIES.filter(policy=>policy.slug!==document.slug).map(policy=><Link key={policy.slug} href={`/legal/${policy.slug}`}>{policy.title}</Link>)}</nav>
    </MarketplaceContentPage>;
}
