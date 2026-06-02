'use client';

import type { SectionModel, ThemeSettings } from '@letbuyy/theme-engine';
import type { ExperienceItem } from '@letbuyy/cms-core';
import { motion } from 'framer-motion';
import { Briefcase, GraduationCap } from '@letbuyy/ui';

interface Props {
    section: SectionModel;
    theme: ThemeSettings;
}

export default function ExperienceTimeline({ section, theme }: Props) {
    const settings = section.settings || {};
    const title = settings.title as string || 'Experience';
    const subtitle = settings.subtitle as string || '';

    const experiences: ExperienceItem[] = (section.blocks || []).map(block => ({
        id: block.id,
        title: (block.settings.title as string) || 'Role',
        company: (block.settings.company as string) || '',
        startDate: (block.settings.startDate as string) || '',
        endDate: block.settings.endDate as string,
        description: block.settings.description as string,
        isCurrent: block.settings.isCurrent as boolean,
    }));

    return (
        <section className="py-16 md:py-24 px-4 md:px-8">
            <div className="container mx-auto max-w-3xl">
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

                {/* Timeline */}
                <div className="relative">
                    {/* Vertical line */}
                    <div
                        className="absolute left-6 md:left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2"
                        style={{ backgroundColor: `${theme.primaryColor}20` }}
                    />

                    <div className="space-y-8">
                        {experiences.map((exp, index) => (
                            <motion.div
                                key={exp.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className={`relative flex flex-col md:flex-row gap-4 md:gap-8 ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}
                            >
                                {/* Timeline dot */}
                                <div
                                    className="absolute left-6 md:left-1/2 w-3 h-3 rounded-full -translate-x-1/2 mt-6 z-10"
                                    style={{
                                        backgroundColor: exp.isCurrent ? theme.primaryColor : 'var(--card-bg)',
                                        border: `2px solid ${theme.primaryColor}`,
                                        boxShadow: `0 0 0 3px var(--background)`,
                                    }}
                                />

                                {/* Content */}
                                <div className={`ml-12 md:ml-0 md:w-[calc(50%-2rem)] ${index % 2 === 0 ? 'md:text-right' : ''}`}>
                                    <div className="card-theme p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                                        <div className={`flex items-center gap-2 mb-2 ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                                            <div
                                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                                style={{ backgroundColor: `${theme.primaryColor}15` }}
                                            >
                                                <Briefcase size={16} style={{ color: theme.primaryColor }} />
                                            </div>
                                            <span className="text-xs font-medium text-theme-muted">
                                                {exp.startDate} — {exp.isCurrent ? 'Present' : exp.endDate}
                                            </span>
                                        </div>
                                        <h3 className="text-base font-semibold">{exp.title}</h3>
                                        <p className="text-sm font-medium text-theme-secondary mb-2">{exp.company}</p>
                                        {exp.description && (
                                            <p className="text-sm text-theme-muted leading-relaxed">{exp.description}</p>
                                        )}
                                        {exp.isCurrent && (
                                            <span
                                                className="inline-block mt-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full"
                                                style={{ backgroundColor: `${theme.primaryColor}15`, color: theme.primaryColor }}
                                            >
                                                Current
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Empty State */}
                {experiences.length === 0 && (
                    <div className="text-center py-12 text-theme-muted">
                        <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
                        <p>No experience listed yet</p>
                    </div>
                )}
            </div>
        </section>
    );
}
