import Link from 'next/link';
import { ArrowRight, Download, ShoppingCart, LayoutGrid, PageHeader } from '@letbuyy/ui';
import type { Theme } from '@letbuyy/theme-engine';
import ThemeDevicePreview from './theme-device-preview';
import { CATEGORY_LABELS, formatThemePrice, themeCompareSingleHref } from '@/lib/utils';

export default function ThemeDetailHero({ theme, addHref, addLabel }: { theme: Theme; addHref: string; addLabel: string }) {
    const category = CATEGORY_LABELS[theme.category]?.label ?? theme.category;
    return <section className="theme-detail-hero" aria-label={`${theme.name} introduction`}>
        <div className="theme-detail-hero-copy"><PageHeader title={theme.name} eyebrow={`${category} theme`} description={theme.slug==='letbuyy-core'?'A flexible storefront for your next chapter. Bring your products, collections, and brand story together in one design.':theme.description} showIcon={false} showEyebrow showDescription showBreadcrumbs breadcrumbs={[{label:'Themes',href:'/themes'},{label:category,href:`/themes/category/${theme.category}`},{label:theme.name}]} />
            <div className="theme-detail-price"><strong>{formatThemePrice(theme)}</strong><span>{theme.letbuyy_pricing_type==='free'?'No theme purchase required':'Review the listing and purchase details before choosing.'}</span></div>
            <dl className="theme-detail-hero-meta"><div><dt>Designed by</dt><dd>{theme.author_name}</dd></div><div><dt>Version</dt><dd>{theme.version}</dd></div><div><dt>Theme category</dt><dd>{category}</dd></div></dl>
            <div className="theme-detail-hero-actions"><Link href={addHref} className="marketplace-action">{theme.letbuyy_pricing_type==='free'?<Download size={17} aria-hidden="true"/>:<ShoppingCart size={17} aria-hidden="true"/>}{addLabel}</Link><a href="#demo" className="marketplace-action marketplace-action-secondary">Preview options<ArrowRight size={17} aria-hidden="true"/></a><Link href={themeCompareSingleHref(theme.slug)} className="marketplace-text-link"><LayoutGrid size={16} aria-hidden="true"/>Compare</Link></div>
            <p className="theme-detail-library-note">Add to your store library, then customise and publish separately.</p>
        </div><div className="theme-detail-hero-media"><ThemeDevicePreview theme={theme}/></div>
    </section>;
}
