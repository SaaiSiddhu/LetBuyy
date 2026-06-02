'use client';

import type { SectionModel, ThemeSettings } from '@letbuyy/theme-engine';
import type { ServiceItem } from '@letbuyy/cms-core';
import { motion } from 'framer-motion';
import { Palette, Code, Globe, Smartphone, Camera, PenTool, BarChart3, Megaphone } from '@letbuyy/ui';

interface Props {
    section: SectionModel;
    theme: ThemeSettings;
}

// Icon mapping for service items
const iconMap: Record<string, React.ReactNode> = {
    design: <Palette size={24} />,
    code: <Code size={24} />,
    web: <Globe size={24} />,
    mobile: <Smartphone size={24} />,
    photo: <Camera size={24} />,
    branding: <PenTool size={24} />,
    analytics: <BarChart3 size={24} />,
    marketing: <Megaphone size={24} />,
};

export default function ServicesGrid({ section, theme }: Props) {
    const settings = section.settings || {};
    const title = settings.title as string || 'Services';
    const subtitle = settings.subtitle as string || '';
    const columns = (settings.columns as number) || 3;

    const services: ServiceItem[] = (section.blocks || []).map(block => ({
        id: block.id,
        icon: block.settings.icon as string,
        title: (block.settings.title as string) || 'Service',
        description: (block.settings.description as string) || '',
        link: block.settings.link as string,
    }));

    const gridCols = columns === 2 ? 'md:grid-cols-2' : columns === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3';

    return (
        <section className="py-16 md:py-24 px-4 md:px-8">
            <div className="container mx-auto max-w-6xl">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-12"
                >
                    <h2 className="text-3xl md:text-4xl font-bold font-display mb-3">{title}</h2>
                    {subtitle && <p className="text-lg text-theme-secondary max-w-2xl mx-auto">{subtitle}</p>}
                </motion.div>

                {/* Services Grid */}
                <div className={`grid grid-cols-1 ${gridCols} gap-6`}>
                    {services.map((service, index) => (
                        <motion.div
                            key={service.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.08 }}
                            className="group card-theme p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 text-center"
                        >
                            {/* Icon */}
                            <div
                                className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform"
                                style={{ backgroundColor: `${theme.primaryColor}12`, color: theme.primaryColor }}
                            >
                                {service.icon && iconMap[service.icon.toLowerCase()] ? iconMap[service.icon.toLowerCase()] : <Globe size={24} />}
                            </div>

                            <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
                            <p className="text-sm text-theme-secondary leading-relaxed">{service.description}</p>

                            {service.link && (
                                <a
                                    href={service.link}
                                    className="inline-block mt-3 text-sm font-medium hover:opacity-70 transition-opacity"
                                    style={{ color: theme.primaryColor }}
                                >
                                    Learn more →
                                </a>
                            )}
                        </motion.div>
                    ))}
                </div>

                {/* Empty State */}
                {services.length === 0 && (
                    <div className="text-center py-12 text-theme-muted">
                        <Globe size={40} className="mx-auto mb-3 opacity-30" />
                        <p>No services listed yet</p>
                    </div>
                )}
            </div>
        </section>
    );
}
