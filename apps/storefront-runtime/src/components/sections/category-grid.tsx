'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from '@letbuyy/ui';
import type { SectionModel } from '@letbuyy/theme-engine';

interface CategoryItem {
    name: string;
    slug: string;
    count?: number;
    image?: string;
    tagline?: string;
}

interface CategoryGridProps {
    section: SectionModel;
    basePath: string;
}

function normalizeCategories(section: SectionModel): CategoryItem[] {
    return (section.blocks || [])
        .filter((block) => block.isVisible !== false)
        .sort((a, b) => a.order - b.order)
        .map((block) => ({
            name: (block.settings.name as string) || '',
            slug: (block.settings.slug as string) || '',
            count: typeof block.settings.count === 'number' ? block.settings.count : undefined,
            image: (block.settings.image as string) || undefined,
            tagline: (block.settings.tagline as string) || undefined,
        }))
        .filter((category) => category.name && category.slug);
}

export default function CategoryGrid({ section, basePath }: CategoryGridProps) {
    const settings = section.settings || {};
    const categories = normalizeCategories(section);

    if (categories.length === 0) return null;

    const title = (settings.title as string) || 'Shop by Category';
    const subtitle = (settings.subtitle as string) || '';
    const columns = Math.min(Math.max(Number(settings.columns) || 3, 2), 4);
    const gridCols = columns === 2
        ? 'sm:grid-cols-2 lg:grid-cols-2'
        : columns === 4
            ? 'sm:grid-cols-2 lg:grid-cols-4'
            : 'sm:grid-cols-2 lg:grid-cols-3';

    return (
        <section className="py-10 md:py-14 px-4 md:px-8 bg-white">
            <div className="max-w-screen-xl mx-auto">
                <div className="flex items-end justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-black">
                            {title}
                        </h2>
                        {subtitle && (
                            <p className="mt-1 text-xs md:text-sm text-black/45">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    <Link
                        href={`${basePath}/shop`}
                        className="hidden md:flex items-center gap-1 text-xs font-medium text-black/55 hover:text-black transition-colors"
                    >
                        View All <ArrowRight size={12} />
                    </Link>
                </div>

                <div className={`grid grid-cols-1 ${gridCols} gap-3 md:gap-4`}>
                    {categories.map((category) => (
                        <Link
                            key={category.slug}
                            href={`${basePath}/shop?category=${encodeURIComponent(category.slug)}`}
                            className="storefront-collection-card group relative block aspect-[3/4] md:aspect-[4/3] rounded-xl overflow-hidden bg-gray-100"
                        >
                            {category.image ? (
                                <Image
                                    src={category.image}
                                    alt={category.name}
                                    fill
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                    className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                                    unoptimized
                                />
                            ) : (
                                <div className="absolute inset-0 bg-gray-200" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                            <div className="absolute inset-0 flex flex-col justify-end p-3 md:p-5">
                                {category.tagline && (
                                    <p className="hidden md:block text-white/55 text-[10px] uppercase tracking-widest font-medium mb-0.5">
                                        {category.tagline}
                                    </p>
                                )}
                                <h3 className="storefront-collection-card__title text-white text-sm md:text-xl font-bold tracking-tight">
                                    {category.name}
                                </h3>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-white/55 text-[10px] md:text-xs">
                                        {category.count ? `${category.count} Products` : 'Explore'}
                                    </span>
                                    <span className="hidden md:flex items-center justify-center w-7 h-7 rounded-full bg-white text-black group-hover:scale-110 transition-transform duration-300">
                                        <ArrowRight size={13} />
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
