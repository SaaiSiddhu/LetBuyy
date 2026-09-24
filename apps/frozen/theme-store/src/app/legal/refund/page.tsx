import type { Metadata } from 'next';
import PolicyDraftPage from '@/components/policy-draft-page';

export const metadata: Metadata = {
    title: 'Refund Policy',
    robots: { index: false, follow: true },
};

export default function RefundPolicyPage() {
    return (
        <PolicyDraftPage
            title="Theme Marketplace Refunds"
            description="Operational refund structure for one-time theme purchases."
            sections={[
                {
                    title: 'Request intake',
                    body: 'Refund requests are recorded against a completed theme purchase and theme slug. Requests should include the reason and any relevant receipt information.',
                },
                {
                    title: 'Operator review',
                    body: 'Marketplace refund records are created locally for support and operations review. Provider-side refund execution requires approved live provider credentials and an operator decision.',
                },
                {
                    title: 'Status tracking',
                    body: 'Purchases can move to refunded status after provider execution and reconciliation. The production refund window and eligibility rules are supplied by the operator policy bundle.',
                },
                {
                    title: 'GST invoices',
                    body: 'GST invoice records include seller GSTIN, GST rate, GST amount, invoice number, and receipt metadata. Local development uses a clearly marked dev GSTIN.',
                },
            ]}
        />
    );
}
