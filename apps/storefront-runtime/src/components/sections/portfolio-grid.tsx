'use client';

import { SectionModel, ThemeSettings, PortfolioProject } from '@/types/store';
import { motion } from 'framer-motion';
import { ExternalLink, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';

interface Props {
    section: SectionModel;
    theme: ThemeSettings;
}

export default function PortfolioGrid({ section, theme }: Props) {
    const settings = section.settings || {};
    const title = settings.title as string || 'My Work';
    const subtitle = settings.subtitle as string || '';
    const columns = (settings.columns as number) || 3;
    const projects: PortfolioProject[] = (section.blocks || []).map(block => ({
        id: block.id,
        title: (block.settings.title as string) || 'Project',
        description: block.settings.description as string,
        image: block.settings.image as string,
        tags: (block.settings.tags as string[]) || [],
        link: block.settings.link as string,
        linkLabel: (block.settings.linkLabel as string) || 'View Project',
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

                {/* Project Grid */}
                <div className={`grid grid-cols-1 ${gridCols} gap-6`}>
                    {projects.map((project, index) => (
                        <motion.div
                            key={project.id}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="group relative rounded-xl overflow-hidden card-theme shadow-sm hover:shadow-lg transition-all duration-300"
                        >
                            {/* Project Image */}
                            {project.image && (
                                <div className="relative aspect-[4/3] overflow-hidden">
                                    <Image
                                        src={project.image}
                                        alt={project.title}
                                        fill
                                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                        unoptimized
                                    />
                                </div>
                            )}

                            {/* Project Info */}
                            <div className="p-5">
                                <h3 className="text-lg font-semibold mb-2 group-hover:opacity-80 transition-opacity">{project.title}</h3>
                                {project.description && (
                                    <p className="text-sm text-theme-secondary line-clamp-2 mb-3">{project.description}</p>
                                )}

                                {/* Tags */}
                                {project.tags && project.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {project.tags.map((tag, i) => (
                                            <span
                                                key={i}
                                                className="px-2 py-0.5 text-xs rounded-full"
                                                style={{ backgroundColor: `${theme.primaryColor}15`, color: theme.primaryColor }}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Link */}
                                {project.link && (
                                    <a
                                        href={project.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-sm font-medium hover:gap-2.5 transition-all"
                                        style={{ color: theme.primaryColor }}
                                    >
                                        {project.linkLabel} <ArrowUpRight size={14} />
                                    </a>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Empty State */}
                {projects.length === 0 && (
                    <div className="text-center py-16 text-theme-muted">
                        <ExternalLink size={40} className="mx-auto mb-3 opacity-30" />
                        <p>No projects yet</p>
                    </div>
                )}
            </div>
        </section>
    );
}
