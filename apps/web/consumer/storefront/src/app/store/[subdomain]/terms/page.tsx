import { notFound } from 'next/navigation';
import { StoreService } from '@/lib/store-service';
import PolicyPage from '@/components/policy-page';

type Props = {
    params: Promise<{ subdomain: string }>;
};

export default async function TermsPage({ params }: Props) {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);

    if (!store) return notFound();

    const storeName = store.name;

    return (
        <PolicyPage
            title="Terms of Service"
            icon="terms"
            lastUpdated="January 2026"
            store={store}
        >
            <p>
                Welcome to <strong>{storeName}</strong>. By accessing and using our website, you agree to be bound by these Terms of Service. Please read them carefully before placing an order.
            </p>

            <h2>1. Acceptance of Terms</h2>
            <p>
                By accessing or using {storeName}, you agree to comply with and be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using this site.
            </p>

            <h2>2. Products and Pricing</h2>
            <ul>
                <li>All product descriptions, images, and specifications are provided for informational purposes</li>
                <li>Prices are displayed in Indian Rupees (INR) and include applicable taxes unless stated otherwise</li>
                <li>We reserve the right to modify prices without prior notice</li>
                <li>In case of pricing errors, we reserve the right to cancel orders</li>
            </ul>

            <h2>3. Orders and Payment</h2>
            <ul>
                <li>Placing an order constitutes an offer to purchase products</li>
                <li>Order confirmation does not guarantee acceptance; we may decline orders for any reason</li>
                <li>Payment is processed securely through Razorpay</li>
                <li>Full payment is required before order dispatch</li>
            </ul>

            <h2>4. User Account</h2>
            <p>You are responsible for:</p>
            <ul>
                <li>Maintaining the confidentiality of your account information</li>
                <li>All activities that occur under your account</li>
                <li>Providing accurate and complete information</li>
                <li>Notifying us immediately of any unauthorized use</li>
            </ul>

            <h2>5. Intellectual Property</h2>
            <p>
                All content on {storeName}, including text, graphics, logos, images, and software, is the property of {storeName} and protected by intellectual property laws. You may not reproduce, distribute, or create derivative works without our written consent.
            </p>

            <h2>6. Limitation of Liability</h2>
            <p>
                {storeName} shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of our products or services. Our total liability shall not exceed the amount paid for the product in question.
            </p>

            <h2>7. Governing Law</h2>
            <p>
                These Terms of Service are governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in India.
            </p>

            <h2>8. Changes to Terms</h2>
            <p>
                We reserve the right to update these Terms of Service at any time. Changes will be effective immediately upon posting. Continued use of {storeName} after changes constitutes acceptance of the new terms.
            </p>

            <h2>9. Contact Us</h2>
            <p>
                For questions about these Terms of Service, please contact us at <a href="mailto:help@letbuyy.com">help@letbuyy.com</a>.
            </p>
        </PolicyPage>
    );
}
