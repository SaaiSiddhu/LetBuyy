/**
 * Urban Kicks — Dynamic Home Page Component
 * 
 * Server component that renders the store home page using real data.
 * This is a theme-specific version of the generic store home page.
 * It renders sections based on the store's templateConfig.
 */

import { StoreService } from '@/lib/store-service';
import { ProductService } from '@/lib/product-service';
import { notFound } from 'next/navigation';

import HeroSection from '@/components/sections/hero';
import ProductGrid from '@/components/sections/product-grid';
import TestimonialsSection from '@/components/sections/testimonials';
import AboutSection from '@/components/sections/about-section';
import NewsletterSection from '@/components/sections/newsletter';
import FeaturedProducts from '@/components/sections/featured-products';
import CtaSection from '@/components/sections/cta-section';
import { SectionModel, ProductModel } from '@/types/store';

// ISR — regenerate every 5 minutes
export const revalidate = 300;

interface DynamicHomePageProps {
    subdomain: string;
}

export default async function DynamicHomePage({ subdomain }: DynamicHomePageProps) {
    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return notFound();

    const sections = store.templateConfig.sections
        .filter(s => s.isVisible !== false)
        .sort((a, b) => a.order - b.order);

    // Pre-fetch products for store-type sites
    let productsMap = new Map<string, ProductModel>();
    if (store.siteType === 'store') {
        const allProductIds = new Set<string>();
        sections
            .filter(s => s.type === 'productGrid' || s.type === 'featuredProducts')
            .forEach(section => {
                const ids = (section.settings.productIds as string[]) || [];
                ids.forEach(id => allProductIds.add(id));
            });
        store.selectedProductIds.forEach(id => allProductIds.add(id));
        const allProducts = await ProductService.getProductsByIds(Array.from(allProductIds));
        productsMap = new Map(allProducts.map(p => [p.id, p]));
    }

    const getProducts = (section: SectionModel): ProductModel[] => {
        const sectionIds = (section.settings.productIds as string[]) || [];
        const ids = sectionIds.length > 0 ? sectionIds : store.selectedProductIds;
        return ids.map(id => productsMap.get(id)).filter((p): p is ProductModel => !!p);
    };

    const theme = store.templateConfig.themeSettings;

    return (
        <div>
            {sections.map(section => {
                switch (section.type) {
                    case 'heroBanner':
                        return <HeroSection key={section.id} section={section} theme={theme} />;
                    case 'productGrid':
                        return store.siteType === 'store' ? (
                            <ProductGrid key={section.id} section={section} products={getProducts(section)} theme={theme} />
                        ) : null;
                    case 'featuredProducts':
                        return store.siteType === 'store' ? (
                            <FeaturedProducts key={section.id} section={section} products={getProducts(section)} theme={theme} />
                        ) : null;
                    case 'testimonials':
                        return <TestimonialsSection key={section.id} section={section} theme={theme} />;
                    case 'aboutSection':
                        return <AboutSection key={section.id} section={section} theme={theme} />;
                    case 'newsletter':
                        return <NewsletterSection key={section.id} section={section} theme={theme} />;
                    case 'ctaSection':
                        return <CtaSection key={section.id} section={section} theme={theme} />;
                    case 'header':
                    case 'footer':
                        return null;
                    default:
                        return null;
                }
            })}
        </div>
    );
}
