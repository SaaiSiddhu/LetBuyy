import { notFound } from 'next/navigation';
import { StoreService } from '@/lib/store-service';
import PolicyPage from '@/components/policy-page';

type Props = {
    params: Promise<{ subdomain: string }>;
};

export default async function ReturnsPage({ params }: Props) {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);

    if (!store) return notFound();

    const storeName = store.name;

    return (
        <PolicyPage
            title="Returns & Exchange Policy"
            icon="returns"
            lastUpdated="January 2026"
            store={store}
        >
            <p>
                At <strong>{storeName}</strong>, we want you to be completely satisfied with your purchase. If you're not happy with your order, we're here to help with our hassle-free returns and exchange policy.
            </p>

            <h2>1. Return Window</h2>
            <ul>
                <li>You may return or exchange products within <strong>7 days</strong> of delivery</li>
                <li>The return window begins from the date of delivery as per the tracking information</li>
                <li>Items must be unused, unwashed, and in original packaging with all tags attached</li>
            </ul>

            <h2>2. Eligible Items for Return</h2>
            <p>The following items are eligible for return:</p>
            <ul>
                <li>Incorrect product delivered</li>
                <li>Damaged or defective product</li>
                <li>Size/fit issues (for applicable products)</li>
                <li>Product significantly different from the description</li>
            </ul>

            <h2>3. Non-Returnable Items</h2>
            <p>The following items cannot be returned or exchanged:</p>
            <ul>
                <li>Innerwear, lingerie, and swimwear</li>
                <li>Customized or personalized products</li>
                <li>Products marked as "Final Sale" or "Non-Returnable"</li>
                <li>Items without original tags and packaging</li>
                <li>Items used, washed, or altered after delivery</li>
            </ul>

            <h2>4. How to Initiate a Return</h2>
            <ol>
                <li>Email us at <a href="mailto:help@letbuyy.com">help@letbuyy.com</a> with your order number</li>
                <li>Describe the reason for return and attach photos if applicable</li>
                <li>Our team will review and approve eligible returns within 24-48 hours</li>
                <li>Once approved, you'll receive pickup instructions or a return shipping label</li>
            </ol>

            <h2>5. Exchange Process</h2>
            <ul>
                <li>Exchanges are subject to product availability</li>
                <li>For size exchanges, the replacement will be shipped once we receive the original item</li>
                <li>If the exchange item is of higher value, you'll need to pay the difference</li>
                <li>If the exchange item is of lower value, the difference will be refunded</li>
            </ul>

            <h2>6. Refund Process</h2>
            <ul>
                <li>Refunds are processed within 5-7 business days after we receive the returned item</li>
                <li>Refunds will be credited to the original payment method</li>
                <li>Shipping charges are non-refundable unless the return is due to our error</li>
                <li>You will receive an email confirmation once your refund is processed</li>
            </ul>

            <h2>7. Refund Timeline</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Payment Method</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Refund Timeline</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>Credit/Debit Card</td>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>5-7 business days</td>
                    </tr>
                    <tr>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>UPI / Net Banking</td>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>2-3 business days</td>
                    </tr>
                    <tr>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>Wallet</td>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>Instant - 24 hours</td>
                    </tr>
                </tbody>
            </table>

            <h2>8. Contact Us</h2>
            <p>
                For any questions about returns or exchanges, please contact our customer support team at <a href="mailto:help@letbuyy.com">help@letbuyy.com</a>.
            </p>
        </PolicyPage>
    );
}
