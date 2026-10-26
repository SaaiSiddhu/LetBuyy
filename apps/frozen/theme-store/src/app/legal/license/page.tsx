import type { Metadata } from 'next';
import PolicyDraftPage from '@/components/policy-draft-page';
import { findMarketplacePolicy } from '@/lib/marketplace-policies';
export const metadata: Metadata = { title: 'Theme License Information', robots: { index:false,follow:true } };
export default function PolicyPage() { const document=findMarketplacePolicy('license')!;return <PolicyDraftPage document={document} />; }
