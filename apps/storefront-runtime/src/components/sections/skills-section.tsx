'use client';

import type { SectionModel, ThemeSettings } from '@letbuyy/theme-engine';
import type { SkillItem } from '@letbuyy/cms-core';
import { motion } from 'framer-motion';

interface Props {
    section: SectionModel;
    theme: ThemeSettings;
}

export default function SkillsSection({ section, theme }: Props) {
    const settings = section.settings || {};
    const title = settings.title as string || 'Skills & Expertise';
    const subtitle = settings.subtitle as string || '';
    const layout = (settings.layout as string) || 'bars';

    const skills: SkillItem[] = (section.blocks || []).map(block => ({
        id: block.id,
        name: (block.settings.name as string) || 'Skill',
        level: (block.settings.level as number) || 50,
        category: block.settings.category as string,
    }));

    // Group skills by category
    const grouped = skills.reduce<Record<string, SkillItem[]>>((acc, skill) => {
        const cat = skill.category || 'General';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(skill);
        return acc;
    }, {});

    return (
        <section className="py-16 md:py-24 px-4 md:px-8" style={{ backgroundColor: 'var(--surface)' }}>
            <div className="container mx-auto max-w-4xl">
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

                {layout === 'bars' ? (
                    /* Skill Bars */
                    <div className="space-y-10">
                        {Object.entries(grouped).map(([category, categorySkills]) => (
                            <div key={category}>
                                <h3 className="text-sm font-semibold text-theme-secondary uppercase tracking-wider mb-4">{category}</h3>
                                <div className="space-y-4">
                                    {categorySkills.map((skill, index) => (
                                        <motion.div
                                            key={skill.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            whileInView={{ opacity: 1, x: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ delay: index * 0.05 }}
                                        >
                                            <div className="flex justify-between items-center mb-1.5">
                                                <span className="text-sm font-medium">{skill.name}</span>
                                                <span className="text-xs text-theme-muted">{skill.level}%</span>
                                            </div>
                                            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${theme.primaryColor}15` }}>
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    whileInView={{ width: `${skill.level}%` }}
                                                    viewport={{ once: true }}
                                                    transition={{ duration: 0.8, delay: index * 0.05 }}
                                                    className="h-full rounded-full"
                                                    style={{ background: `linear-gradient(90deg, ${theme.primaryColor}, ${theme.secondaryColor})` }}
                                                />
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Tag Cloud */
                    <div className="flex flex-wrap justify-center gap-3">
                        {skills.map((skill, index) => (
                            <motion.span
                                key={skill.id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.03 }}
                                className="px-4 py-2 rounded-full text-sm font-medium border transition-all hover:scale-105"
                                style={{
                                    borderColor: `${theme.primaryColor}30`,
                                    backgroundColor: `${theme.primaryColor}${Math.round((skill.level / 100) * 25).toString(16).padStart(2, '0')}`,
                                    color: skill.level > 70 ? 'white' : theme.primaryColor,
                                }}
                            >
                                {skill.name}
                            </motion.span>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {skills.length === 0 && (
                    <div className="text-center py-12 text-theme-muted">
                        <p>No skills listed yet</p>
                    </div>
                )}
            </div>
        </section>
    );
}
