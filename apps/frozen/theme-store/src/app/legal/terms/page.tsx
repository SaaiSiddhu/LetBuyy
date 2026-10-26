import type { Metadata } from 'next';
import PolicyDraftPage from '@/components/policy-draft-page';
import { findMarketplacePolicy } from '@/lib/marketplace-policies';
export const metadata: Metadata = { title: 'Marketplace Terms', robots: { index:false,follow:true } };
export default function PolicyPage() { const document=findMarketplacePolicy('terms')!;return <PolicyDraftPage document={document} />; }
