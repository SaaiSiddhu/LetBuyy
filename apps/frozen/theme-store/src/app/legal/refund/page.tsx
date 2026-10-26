import type { Metadata } from 'next';
import PolicyDraftPage from '@/components/policy-draft-page';
import { findMarketplacePolicy } from '@/lib/marketplace-policies';
export const metadata: Metadata = { title: 'Refunds and Cancellation', robots: { index:false,follow:true } };
export default function PolicyPage() { const document=findMarketplacePolicy('refund')!;return <PolicyDraftPage document={document} />; }
