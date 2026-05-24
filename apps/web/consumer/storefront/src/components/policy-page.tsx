'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Printer, Calendar, Shield, FileText, Truck, RefreshCcw } from 'lucide-react';
import { StoreModel, ThemeSettings } from '@/types/store';

interface PolicyPageProps {
    title: string;
    icon: 'privacy' | 'terms' | 'shipping' | 'returns';
    lastUpdated: string;
    store: StoreModel;
    children: React.ReactNode;
}

const icons = {
    privacy: Shield,
    terms: FileText,
    shipping: Truck,
    returns: RefreshCcw,
};

export default function PolicyPage({ title, icon, lastUpdated, store, children }: PolicyPageProps) {
    const theme: ThemeSettings = store.templateConfig?.themeSettings || {
        primaryColor: '#6366f1',
        secondaryColor: '#4f46e5',
        accentColor: '#a855f7',
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        fontFamily: 'Inter',
        headingFontFamily: 'Inter',
        borderRadius: 12,
        enableAnimations: true,
        enableShadows: true,
    };

    const Icon = icons[icon];
    const basePath = `/store/${store.subdomain}`;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen pt-20" style={{ backgroundColor: 'var(--background, #f9fafb)' }}>
            <div className="container mx-auto px-4 max-w-3xl pb-12">
                {/* Header */}
                <div className="py-4">
                    <Link
                        href={basePath}
                        className="inline-flex items-center text-sm text-theme-secondary hover:opacity-70 transition-opacity"
                    >
                        <ArrowLeft size={16} className="mr-2" /> Back to Store
                    </Link>
                </div>

                {/* Title Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card-theme rounded-2xl shadow-sm p-6 md:p-8 mb-6"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div
                                className="p-3 rounded-xl"
                                style={{ backgroundColor: `${theme.primaryColor}15` }}
                            >
                                <Icon size={24} style={{ color: theme.primaryColor }} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-theme">{title}</h1>
                                <p className="text-sm text-theme-secondary flex items-center gap-1 mt-1">
                                    <Calendar size={14} />
                                    Last updated: {lastUpdated}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handlePrint}
                            className="p-2 text-theme-muted hover:text-theme-secondary hover:bg-surface rounded-lg transition-colors print:hidden"
                            title="Print this page"
                        >
                            <Printer size={20} />
                        </button>
                    </div>
                </motion.div>

                {/* Content */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="card-theme rounded-2xl shadow-sm p-6 md:p-8"
                >
                    <div className="prose prose-gray max-w-none prose-headings:font-semibold prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-base prose-p:text-theme-secondary prose-li:text-theme-secondary prose-a:no-underline" style={{ '--tw-prose-links': theme.primaryColor } as React.CSSProperties}>
                        {children}
                    </div>
                </motion.div>

                {/* Footer */}
                <div className="mt-6 text-center text-sm text-theme-muted">
                    <p>If you have any questions, please contact us at <a href="mailto:help@letbuyy.com" className="underline" style={{ color: theme.primaryColor }}>help@letbuyy.com</a></p>
                </div>
            </div>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body {
                        background: white !important;
                    }
                    header, footer, nav {
                        display: none !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
