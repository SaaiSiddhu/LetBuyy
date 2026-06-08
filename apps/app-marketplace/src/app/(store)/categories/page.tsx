import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CategoryGrid } from '@/components/CategoryGrid';
import { AppService } from '@/lib/app-service';

export const metadata = {
    title: 'All Categories — LetBuyy App Store',
    description: 'Browse apps by category. Find tools for products, selling, shipping, marketing, analytics, and more.',
};

export const revalidate = 300;

export default async function CategoriesPage() {
    const categories = await AppService.getCategoriesWithFallback();

    return (
        <>
            <Header />
            <main className="appstore-main">
                <section className="appstore-section">
                    <div className="marketplace-page-header">
                        <h1 className="marketplace-page-title">App Categories</h1>
                        <p className="marketplace-page-subtitle">Browse apps by category to find the perfect tools for your store.</p>
                    </div>
                    <CategoryGrid categories={categories} />
                </section>
            </main>
            <Footer />
        </>
    );
}
