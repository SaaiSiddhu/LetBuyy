import type { Metadata } from 'next';
import PolicyDraftPage from '@/components/policy-draft-page';
import { findMarketplacePolicy } from '@/lib/marketplace-policies';
export const metadata: Metadata = { title: 'Privacy Notice', robots: { index:false,follow:true } };
export default function PolicyPage() { const document=findMarketplacePolicy('privacy')!;return <PolicyDraftPage document={document} />; }
