/**
 * Urban Kicks — Dynamic Home Page Component
 *
 * Server component that renders the store home page using real data.
 * Uses the SectionRenderer to map section types to components.
 */

import { StoreService } from '@/lib/store-service';
import { ProductService } from '@/lib/product-service';
import { notFound } from 'next/navigation';
import { SectionModel, ProductModel } from '@/types/store';
import SectionRenderer from '../section-renderer';

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
            {sections.map(section => (
                <SectionRenderer
                    key={section.id}
                    section={section}
                    theme={theme}
                    products={getProducts(section)}
                    siteType={store.siteType}
                />
            ))}
        </div>
    );
}
