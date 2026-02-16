import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CategoryGrid } from '@/components/CategoryGrid';

export const metadata = {
    title: 'All Categories — LetBuyy App Store',
    description: 'Browse apps by category. Find tools for products, selling, shipping, marketing, analytics, and more.',
};

export default function CategoriesPage() {
    return (
        <>
            <Header />
            <main className="appstore-main">
                <section className="appstore-section">
                    <h1 className="appstore-section-title" style={{ fontSize: 26, marginBottom: 8 }}>
                        App Categories
                    </h1>
                    <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 28 }}>
                        Browse apps by category to find the perfect tools for your store.
                    </p>
                    <CategoryGrid />
                </section>
            </main>
            <Footer />
        </>
    );
}
