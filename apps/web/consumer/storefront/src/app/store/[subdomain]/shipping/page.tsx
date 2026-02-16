import { notFound } from 'next/navigation';
import { StoreService } from '@/lib/store-service';
import PolicyPage from '@/components/policy-page';

type Props = {
    params: Promise<{ subdomain: string }>;
};

export default async function ShippingPage({ params }: Props) {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);

    if (!store) return notFound();

    const storeName = store.name;

    return (
        <PolicyPage
            title="Shipping Policy"
            icon="shipping"
            lastUpdated="January 2026"
            store={store}
        >
            <p>
                At <strong>{storeName}</strong>, we strive to deliver your orders quickly and safely. Please review our shipping policy below for details on delivery timelines, costs, and procedures.
            </p>

            <h2>1. Shipping Coverage</h2>
            <p>We currently ship to all serviceable pin codes across India. International shipping is not available at this time.</p>

            <h2>2. Processing Time</h2>
            <ul>
                <li>Orders are processed within 1-2 business days after payment confirmation</li>
                <li>Orders placed on weekends or holidays will be processed on the next business day</li>
                <li>You will receive a confirmation email once your order is shipped</li>
            </ul>

            <h2>3. Delivery Options</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Delivery Type</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Timeline</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Cost</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>Standard Shipping</td>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>5-7 business days</td>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>Free on orders above ₹499</td>
                    </tr>
                    <tr>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>Express Shipping</td>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>2-3 business days</td>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>₹99</td>
                    </tr>
                </tbody>
            </table>

            <h2>4. Order Tracking</h2>
            <p>
                Once your order is shipped, you will receive a tracking number via email and SMS. You can track your order status using the tracking link provided by our shipping partner.
            </p>

            <h2>5. Delivery Attempts</h2>
            <ul>
                <li>Our delivery partner will attempt delivery up to 3 times</li>
                <li>If delivery fails after 3 attempts, the order will be returned to us</li>
                <li>Please ensure someone is available to receive the package at the delivery address</li>
            </ul>

            <h2>6. Shipping Delays</h2>
            <p>
                While we strive to deliver on time, delays may occur due to unforeseen circumstances such as weather conditions, natural disasters, or logistics issues. We will notify you of any significant delays.
            </p>

            <h2>7. Damaged or Lost Packages</h2>
            <ul>
                <li>Inspect your package upon delivery</li>
                <li>If the package appears damaged, please note it on the delivery receipt</li>
                <li>Contact us within 24 hours at <a href="mailto:help@letbuyy.com">help@letbuyy.com</a> for damaged or lost packages</li>
            </ul>

            <h2>8. Contact Us</h2>
            <p>
                For shipping inquiries, please contact us at <a href="mailto:help@letbuyy.com">help@letbuyy.com</a>.
            </p>
        </PolicyPage>
    );
}
