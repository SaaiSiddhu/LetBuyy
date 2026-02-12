import { notFound } from 'next/navigation';
import { StoreService } from '@/lib/store-service';
import PolicyPage from '@/components/policy-page';

type Props = {
    params: Promise<{ subdomain: string }>;
};

export default async function PrivacyPolicyPage({ params }: Props) {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);

    if (!store) return notFound();

    const storeName = store.name;

    return (
        <PolicyPage
            title="Privacy Policy"
            icon="privacy"
            lastUpdated="January 2026"
            store={store}
        >
            <p>
                At <strong>{storeName}</strong>, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our store.
            </p>

            <h2>1. Information We Collect</h2>
            <p>We collect information that you provide directly to us, including:</p>
            <ul>
                <li><strong>Personal Information:</strong> Name, email address, phone number, shipping address, and billing address</li>
                <li><strong>Payment Information:</strong> Credit card details (processed securely through Razorpay)</li>
                <li><strong>Order Information:</strong> Products purchased, order history, and preferences</li>
                <li><strong>Communication Data:</strong> Messages, feedback, and support inquiries</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
                <li>Process and fulfill your orders</li>
                <li>Send order confirmations and shipping updates</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Improve our products and services</li>
                <li>Send promotional communications (with your consent)</li>
                <li>Detect and prevent fraud</li>
            </ul>

            <h2>3. Information Sharing</h2>
            <p>{storeName} does not sell, trade, or rent your personal information to third parties. We may share your information with:</p>
            <ul>
                <li><strong>Service Providers:</strong> Payment processors (Razorpay), shipping carriers, and analytics providers</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
            </ul>

            <h2>4. Data Security</h2>
            <p>
                We implement industry-standard security measures to protect your personal information. All payment transactions are encrypted using SSL technology and processed through Razorpay's secure payment gateway.
            </p>

            <h2>5. Cookies</h2>
            <p>
                We use cookies and similar technologies to enhance your browsing experience, remember your preferences, and analyze site traffic. You can control cookie settings through your browser preferences.
            </p>

            <h2>6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
                <li>Access and receive a copy of your personal data</li>
                <li>Correct inaccurate personal information</li>
                <li>Request deletion of your personal data</li>
                <li>Opt-out of marketing communications</li>
            </ul>

            <h2>7. Contact Us</h2>
            <p>
                If you have any questions about this Privacy Policy or our data practices, please contact us at <a href="mailto:help@letbuyy.com">help@letbuyy.com</a>.
            </p>
        </PolicyPage>
    );
}
