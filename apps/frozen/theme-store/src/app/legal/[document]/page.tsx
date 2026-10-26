import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PolicyDraftPage from '@/components/policy-draft-page';
import { findMarketplacePolicy } from '@/lib/marketplace-policies';
type Props={params:Promise<{document:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata> { const policy=findMarketplacePolicy((await params).document);return {title:policy?.title || 'Document not found',robots:{index:false,follow:true}}; }
export default async function LegalDocumentPage({params}:Props) { const policy=findMarketplacePolicy((await params).document);if(!policy)notFound();return <PolicyDraftPage document={policy}/>; }
