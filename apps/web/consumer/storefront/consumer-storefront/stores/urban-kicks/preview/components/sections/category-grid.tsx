'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SectionModel } from '@/types/store';

interface CategoryItem {
    name: string;
    slug: string;
    count: number;
    image: string;
    tagline: string;
}

const DEFAULT_CATEGORIES: CategoryItem[] = [
    {
        name: 'Sneakers',
        slug: 'Sneakers',
        count: 5,
        image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?q=80&w=600&h=800&fit=crop',
        tagline: 'Step into the future',
    },
    {
        name: 'Apparel',
        slug: 'Apparel',
        count: 4,
        image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=600&h=800&fit=crop',
        tagline: 'Wear the culture',
    },
    {
        name: 'Accessories',
        slug: 'Accessories',
        count: 3,
        image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?q=80&w=600&h=800&fit=crop',
        tagline: 'Complete the look',
    },
];

interface CategoryGridProps {
    section: SectionModel;
    basePath?: string;
}

export default function CategoryGrid({ section, basePath = '/theme-preview/urban-kicks' }: CategoryGridProps) {
    const settings = section.settings || {};
    const title = (settings.title as string) || 'Shop by Category';
    const subtitle = (settings.subtitle as string) || 'Find exactly what you\'re looking for';
    const columns = (settings.columns as number) || 3;

    // Use blocks if defined, otherwise fall back to defaults
    const categories: CategoryItem[] = section.blocks?.length
        ? section.blocks
            .filter(b => b.isVisible !== false)
            .sort((a, b) => a.order - b.order)
            .map(b => ({
                name: (b.settings.name as string) || '',
                slug: (b.settings.slug as string) || '',
                count: 0,
                image: (b.settings.image as string) || '',
                tagline: (b.settings.tagline as string) || '',
            }))
        : DEFAULT_CATEGORIES;

    return (
        <section className="py-10 md:py-14 px-4 md:px-8 bg-white">
            <div className="max-w-screen-xl mx-auto">
                {/* Header */}
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-black">
                            {title}
                        </h2>
                        {subtitle && (
                            <p className="mt-1 text-xs md:text-sm text-black/40">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    <Link
                        href={`${basePath}/shop`}
                        className="hidden md:flex items-center gap-1 text-xs font-medium text-black/50 hover:text-black transition-colors"
                    >
                        View All <ArrowRight size={12} />
                    </Link>
                </div>

                {/* Category Cards */}
                <div
                    className="grid gap-3 md:gap-4"
                    style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                >
                    {categories.map((cat) => (
                        <Link
                            key={cat.slug}
                            href={`${basePath}/shop?category=${cat.slug}`}
                            className="group relative block aspect-[3/4] md:aspect-[4/3] rounded-xl overflow-hidden bg-gray-100"
                        >
                            {/* Image */}
                            <img
                                src={cat.image}
                                alt={cat.name}
                                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                            />

                            {/* Gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

                            {/* Content */}
                            <div className="absolute inset-0 flex flex-col justify-end p-3 md:p-5">
                                <p className="hidden md:block text-white/50 text-[10px] uppercase tracking-widest font-medium mb-0.5">
                                    {cat.tagline}
                                </p>
                                <h3 className="text-white text-sm md:text-xl font-bold tracking-tight">
                                    {cat.name}
                                </h3>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-white/50 text-[10px] md:text-xs">
                                        {cat.count > 0 ? `${cat.count} Products` : 'Explore'}
                                    </span>
                                    <span className="hidden md:flex items-center justify-center w-7 h-7 rounded-full bg-white text-black group-hover:scale-110 transition-transform duration-300">
                                        <ArrowRight size={13} />
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Mobile "View All" */}
                <div className="mt-4 md:hidden text-center">
                    <Link
                        href={`${basePath}/shop`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-black/50 hover:text-black transition-colors"
                    >
                        View All Products <ArrowRight size={12} />
                    </Link>
                </div>
            </div>
        </section>
    );
}
