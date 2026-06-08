'use client';

import Link from 'next/link';
import { LayoutGrid } from '@letbuyy/ui';
import { themeCompareHref, useThemePreferenceSlugs } from '@/components/theme-preference-actions';

export default function ThemeCompareSelection() {
    const { compare, ready } = useThemePreferenceSlugs();

    if (!ready) {
        return (
            <div className="glass-card p-8 text-sm text-text-muted" role="status">
                Loading selected themes...
            </div>
        );
    }

    if (compare.length === 0) {
        return (
            <div className="glass-card p-8">
                <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface">
                        <LayoutGrid className="h-6 w-6 text-text-subtle" aria-hidden="true" />
                    </div>
                    <div>
                        <h2 className="m-0 text-lg font-semibold text-text-heading">No themes selected for compare</h2>
                        <p className="m-0 mt-2 text-sm leading-6 text-text-muted">
                            Add themes from catalog cards or detail pages to compare pricing, features, platforms, and marketplace proof.
                        </p>
                    </div>
                    <Link href="/themes" className="btn-primary text-sm">
                        Browse themes
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card p-8">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <LayoutGrid className="h-6 w-6 text-primary-light" aria-hidden="true" />
                </div>
                <div>
                    <h2 className="m-0 text-lg font-semibold text-text-heading">
                        {compare.length} selected theme{compare.length === 1 ? '' : 's'}
                    </h2>
                    <p className="m-0 mt-2 text-sm leading-6 text-text-muted">
                        Open the current local compare set from this device.
                    </p>
                </div>
                <Link href={themeCompareHref(compare)} className="btn-primary text-sm">
                    Open compare
                </Link>
            </div>
        </div>
    );
}
