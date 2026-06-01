'use client';

import {
    Award,
    CheckCircle,
    Clock,
    CreditCard,
    Globe,
    Headphones,
    Heart,
    Lock,
    Package,
    RotateCcw,
    ShieldCheck,
    Star,
    Truck,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import type { SectionModel } from '@letbuyy/theme-engine';

const ICON_MAP: Record<string, LucideIcon> = {
    award: Award,
    'check-circle': CheckCircle,
    clock: Clock,
    'credit-card': CreditCard,
    globe: Globe,
    headphones: Headphones,
    heart: Heart,
    lock: Lock,
    package: Package,
    'rotate-ccw': RotateCcw,
    'shield-check': ShieldCheck,
    star: Star,
    truck: Truck,
    zap: Zap,
};

interface BadgeItem {
    icon: string;
    label: string;
    description: string;
}

interface TrustBadgesProps {
    section: SectionModel;
}

function normalizeBadges(section: SectionModel): BadgeItem[] {
    const blockBadges = (section.blocks || [])
        .filter((block) => block.isVisible !== false)
        .sort((a, b) => a.order - b.order)
        .map((block) => ({
            icon: (block.settings.icon as string) || 'star',
            label: (block.settings.label as string) || '',
            description: (block.settings.description as string) || '',
        }))
        .filter((badge) => badge.label);

    if (blockBadges.length > 0) return blockBadges;

    return Array.isArray(section.settings.badges)
        ? section.settings.badges
            .map((value) => value as Partial<BadgeItem>)
            .filter((badge): badge is BadgeItem => Boolean(badge.label))
        : [];
}

export default function TrustBadges({ section }: TrustBadgesProps) {
    const badges = normalizeBadges(section);
    if (badges.length === 0) return null;

    const title = (section.settings.title as string) || '';

    return (
        <section className="py-10 md:py-14 px-4 md:px-8 bg-white">
            <div className="max-w-screen-xl mx-auto">
                {title && (
                    <h2 className="text-lg md:text-xl font-bold tracking-tight text-black mb-6 text-center">
                        {title}
                    </h2>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
                    {badges.map((badge) => {
                        const IconComp = ICON_MAP[badge.icon] || Star;
                        return (
                            <div
                                key={`${badge.icon}-${badge.label}`}
                                className="flex flex-col items-center text-center p-5 md:p-6 rounded-xl border border-black/[0.06] hover:border-black/15 transition-colors group"
                            >
                                <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-black flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                    <IconComp size={18} className="text-white" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-sm md:text-base font-semibold text-black mb-0.5">
                                    {badge.label}
                                </h3>
                                {badge.description && (
                                    <p className="text-[11px] md:text-xs text-black/45">
                                        {badge.description}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
