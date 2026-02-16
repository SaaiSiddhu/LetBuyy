import { StoreService } from '@/lib/store-service';
import { ProductService } from '@/lib/product-service';
import { notFound } from 'next/navigation';

// === COST OPTIMIZATION: ISR - Regenerate pages every 5 minutes ===
export const revalidate = 300; // seconds
import HeroSection from '@/components/sections/hero';
import ProductGrid from '@/components/sections/product-grid';
import TestimonialsSection from '@/components/sections/testimonials';
import AboutSection from '@/components/sections/about-section';
import NewsletterSection from '@/components/sections/newsletter';
import FeaturedProducts from '@/components/sections/featured-products';
import PortfolioGrid from '@/components/sections/portfolio-grid';
import SkillsSection from '@/components/sections/skills-section';
import ExperienceTimeline from '@/components/sections/experience-timeline';
import ContactForm from '@/components/sections/contact-form';
import CtaSection from '@/components/sections/cta-section';
import ServicesGrid from '@/components/sections/services-grid';
import { SectionModel, ProductModel } from '@/types/store';

export default async function StorePage({ params }: { params: Promise<{ subdomain: string }> }) {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);

    if (!store) return notFound();

    const isStoreSite = store.siteType === 'store';

    // Get visible sections sorted by order
    const sections = store.templateConfig.sections
        .filter(s => s.isVisible !== false)
        .sort((a, b) => a.order - b.order);

    // Pre-fetch products ONLY for store-type sites
    let productsMap = new Map<string, ProductModel>();

    if (isStoreSite) {
        const productSections = sections.filter(s =>
            s.type === 'productGrid' || s.type === 'featuredProducts'
        );

        const allProductIds = new Set<string>();
        productSections.forEach(section => {
            const sectionProductIds = (section.settings.productIds as string[]) || [];
            sectionProductIds.forEach(id => allProductIds.add(id));
        });
        store.selectedProductIds.forEach(id => allProductIds.add(id));

        const allProducts = await ProductService.getProductsByIds(Array.from(allProductIds));
        productsMap = new Map(allProducts.map(p => [p.id, p]));
    }

    // Helper to get products for a section
    const getProductsForSection = (section: SectionModel): ProductModel[] => {
        const sectionProductIds = (section.settings.productIds as string[]) || [];
        const idsToUse = sectionProductIds.length > 0 ? sectionProductIds : store.selectedProductIds;
        return idsToUse
            .map(id => productsMap.get(id))
            .filter((p): p is ProductModel => p !== undefined);
    };

    return (
        <div>
            {sections.map(section => {
                switch (section.type) {
                    case 'heroBanner':
                        return <HeroSection key={section.id} section={section} theme={store.templateConfig.themeSettings} />;

                    case 'productGrid':
                        return isStoreSite ? (
                            <ProductGrid
                                key={section.id}
                                section={section}
                                products={getProductsForSection(section)}
                                theme={store.templateConfig.themeSettings}
                            />
                        ) : null;

                    case 'featuredProducts':
                        return isStoreSite ? (
                            <FeaturedProducts
                                key={section.id}
                                section={section}
                                products={getProductsForSection(section)}
                                theme={store.templateConfig.themeSettings}
                            />
                        ) : null;

                    case 'testimonials':
                        return <TestimonialsSection key={section.id} section={section} theme={store.templateConfig.themeSettings} />;

                    case 'aboutSection':
                        return <AboutSection key={section.id} section={section} theme={store.templateConfig.themeSettings} />;

                    case 'newsletter':
                        return <NewsletterSection key={section.id} section={section} theme={store.templateConfig.themeSettings} />;

                    // Portfolio / Resume / Landing sections
                    case 'portfolioGrid':
                        return <PortfolioGrid key={section.id} section={section} theme={store.templateConfig.themeSettings} />;

                    case 'skillsSection':
                        return <SkillsSection key={section.id} section={section} theme={store.templateConfig.themeSettings} />;

                    case 'experienceTimeline':
                        return <ExperienceTimeline key={section.id} section={section} theme={store.templateConfig.themeSettings} />;

                    case 'contactForm':
                        return <ContactForm key={section.id} section={section} theme={store.templateConfig.themeSettings} />;

                    case 'ctaSection':
                        return <CtaSection key={section.id} section={section} theme={store.templateConfig.themeSettings} />;

                    case 'servicesGrid':
                        return <ServicesGrid key={section.id} section={section} theme={store.templateConfig.themeSettings} />;

                    // Skip header/footer as they're in layout
                    case 'header':
                    case 'footer':
                        return null;

                    // Generic placeholder for advanced sections
                    case 'trustBadges':
                    case 'faqAccordion':
                    case 'instagramFeed':
                    case 'videoHero':
                    case 'collectionFilter':
                        return (
                            <div key={section.id} className="py-12 px-4 text-center text-theme-muted card-theme-secondary">
                                <p className="text-sm font-medium">{section.type.replace(/([A-Z])/g, ' $1').trim()}</p>
                                <p className="text-xs">Coming soon</p>
                            </div>
                        );

                    default:
                        return null;
                }
            })}
        </div>
    );
}
