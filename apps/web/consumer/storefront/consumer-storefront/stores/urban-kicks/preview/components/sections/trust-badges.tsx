'use client';

import {
    Truck, ShieldCheck, RotateCcw, Headphones,
    Award, Star, Heart, Zap, Lock, Clock,
    Globe, CheckCircle, Package, CreditCard,
    type LucideIcon,
} from 'lucide-react';
import { SectionModel } from '@/types/store';

const ICON_MAP: Record<string, LucideIcon> = {
    'truck': Truck,
    'shield-check': ShieldCheck,
    'rotate-ccw': RotateCcw,
    'headphones': Headphones,
    'award': Award,
    'star': Star,
    'heart': Heart,
    'zap': Zap,
    'lock': Lock,
    'clock': Clock,
    'globe': Globe,
    'check-circle': CheckCircle,
    'package': Package,
    'credit-card': CreditCard,
};

interface BadgeItem {
    icon: string;
    label: string;
    description: string;
}

const DEFAULT_BADGES: BadgeItem[] = [
    { icon: 'truck', label: 'Free Shipping', description: 'On orders above ₹999' },
    { icon: 'shield-check', label: '100% Authentic', description: 'Guaranteed genuine products' },
    { icon: 'rotate-ccw', label: 'Easy Returns', description: '7-day hassle-free returns' },
    { icon: 'headphones', label: '24/7 Support', description: 'We\'re here to help' },
];

interface TrustBadgesProps {
    section: SectionModel;
}

export default function TrustBadges({ section }: TrustBadgesProps) {
    const settings = section.settings || {};
    const title = (settings.title as string) || '';

    // Use blocks if defined, otherwise fall back to defaults
    const badges: BadgeItem[] = section.blocks?.length
        ? section.blocks
            .filter(b => b.isVisible !== false)
            .sort((a, b) => a.order - b.order)
            .map(b => ({
                icon: (b.settings.icon as string) || 'star',
                label: (b.settings.label as string) || '',
                description: (b.settings.description as string) || '',
            }))
        : (settings.badges as BadgeItem[]) || DEFAULT_BADGES;

    return (
        <section className="py-10 md:py-14 px-4 md:px-8 bg-white">
            <div className="max-w-screen-xl mx-auto">
                {title && (
                    <h2 className="text-lg md:text-xl font-bold tracking-tight text-black mb-6 text-center">
                        {title}
                    </h2>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                    {badges.map((badge) => {
                        const IconComp = ICON_MAP[badge.icon] || Star;
                        return (
                            <div
                                key={badge.label}
                                className="flex flex-col items-center text-center p-5 md:p-6 rounded-xl border border-black/[0.06] hover:border-black/15 transition-colors group"
                            >
                                <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-black flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                    <IconComp size={18} className="text-white" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-sm md:text-base font-semibold text-black mb-0.5">
                                    {badge.label}
                                </h3>
                                <p className="text-[11px] md:text-xs text-black/40">
                                    {badge.description}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
