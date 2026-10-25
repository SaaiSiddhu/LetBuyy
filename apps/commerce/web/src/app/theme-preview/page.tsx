import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ExternalLink, Search, Input, Select, Button } from '@letbuyy/ui';
import { resolvePlatformDomain, type Theme } from '@letbuyy/shared-types';
import { LetbuyyApiError, type ThemeCatalogResponse } from '@letbuyy/api-client';
import { createStorefrontApiClient } from '@/lib/api/client';
import { publicCatalogHref, publicCatalogQuery, publicThemePrice } from '@/lib/demo/public-catalog';
import styles from './catalog.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Themes for your store · LetBuyy', description: 'Explore LetBuyy themes and their sample stores before choosing one for your business.' };
function merchantWorkspace() {
    try {
        const url = new URL(process.env.NEXT_PUBLIC_ADMIN_URL || `https://admin.${resolvePlatformDomain()}`);
        return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.origin : null;
    } catch { return null; }
}
function ThemeArtwork({ theme, priority = false }: { theme: Theme; priority?: boolean }) {
    return <div className={styles.artwork}>{theme.thumbnail_url ? <Image src={theme.thumbnail_url} alt={`${theme.name} storefront preview`} width={1440} height={1080} unoptimized priority={priority} /> : <span>Preview image unavailable</span>}</div>;
}
export default async function PublicThemeCatalog({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const parsed = publicCatalogQuery(await searchParams);
    const merchant = merchantWorkspace();
    const header = <header className={styles.header}><Link href="/theme-preview" className={styles.brand}>LetBuyy <span>Themes</span></Link>{merchant && <a href={merchant}>Open merchant workspace <ExternalLink size={14} aria-hidden="true" /></a>}</header>;
    if (!parsed.success) return <main className={styles.page}>{header}<section className={styles.message}><h1>These filters could not be applied</h1><p>Reset the filters to browse the catalog.</p><Link href="/theme-preview">Reset filters</Link></section></main>;
    const { theme: selected, ...query } = parsed.data;
    const api = createStorefrontApiClient();
    const [catalogRead, categoryRead, detailRead] = await Promise.allSettled([
        api.themes.listCatalog({ ...query, limit: 12 }), api.themes.categories(),
        selected ? api.themes.get(selected) : Promise.resolve(null),
    ]);
    const catalog: ThemeCatalogResponse | null = catalogRead.status === 'fulfilled' ? catalogRead.value : null;
    const categories = categoryRead.status === 'fulfilled' ? categoryRead.value : [];
    const detail = detailRead.status === 'fulfilled' ? detailRead.value : null;
    const missing = detailRead.status === 'rejected' && detailRead.reason instanceof LetbuyyApiError && detailRead.reason.status === 404;
    if (selected) return <main className={styles.page}>{header}<section className={styles.detail}>
        <Link className={styles.back} href={publicCatalogHref(query)}><ArrowLeft size={16} aria-hidden="true" /> Back to themes</Link>
        {!detail ? <div className={styles.message}><h1>{missing ? 'This theme is unavailable' : 'Theme details could not be loaded'}</h1><p>{missing ? 'Return to the catalog to choose another theme.' : 'The catalog service did not respond. Retry before choosing a theme.'}</p>{!missing && <Link href={publicCatalogHref(query, { theme: selected })}>Retry details</Link>}</div> : <div className={styles.detailGrid}>
            <ThemeArtwork theme={detail} priority />
            <div className={styles.detailCopy}><p className={styles.eyebrow}>{detail.category.replaceAll('_', ' ')}</p><h1>{detail.name}</h1><p className={styles.description}>{detail.description || 'Explore this theme’s sample store to see its layout and product presentation.'}</p><p className={styles.price}>{publicThemePrice(detail)} <span>Version {detail.version || 'unavailable'}</span></p>
                <a className={styles.primary} href={`/theme-preview/${encodeURIComponent(detail.slug)}?${new URLSearchParams({ version: detail.version })}`}>Explore sample store <ArrowRight size={18} aria-hidden="true" /></a>
                <p className={styles.explainer}>Sample products demonstrate the design. Adding a theme happens in your merchant workspace, where you choose the destination store and confirm the installation. Publishing is a separate action.</p>
                {merchant && <a className={styles.secondary} href={merchant}>Choose a store in merchant workspace <ExternalLink size={15} aria-hidden="true" /></a>}
                {detail.features?.length > 0 && <div className={styles.features}><h2>Included features</h2><ul>{detail.features.map(feature => <li key={feature}>{feature}</li>)}</ul></div>}
                <div className={styles.features}><h2>Make it your own</h2><p>After adding, open Customize in your Theme Library to edit the installed theme. Review your content, products and policies before publishing.</p></div>
            </div>
        </div>}
    </section></main>;
    return <main className={styles.page}>{header}<section className={styles.intro}><p className={styles.eyebrow}>A home for your business</p><h1>Find your store’s<br />point of view.</h1><p>Explore themes built around how your customers discover, compare and choose.</p></section>
        <section className={styles.discovery} aria-label="Theme catalog"><form className={styles.filters} action="/theme-preview" role="search">
            <label className={styles.search}><Search size={18} aria-hidden="true" /><span className={styles.srOnly}>Search themes</span><Input unstyled name="search" defaultValue={query.search} placeholder="Search themes and features" maxLength={120} /></label>
            <label>Category<Select unstyled name="category" defaultValue={query.category || ''} options={[{ value: '', label: 'All categories' }, ...categories.map(category => ({ value: category, label: category.replaceAll('_', ' ') }))]} /></label>
            <label>Sort by<Select unstyled name="sort" defaultValue={query.sort} options={[{ value: 'portfolio', label: 'Portfolio order' }, { value: 'name', label: 'Name' }, { value: 'new', label: 'Newest' }]} /></label><Button variant="secondary" className={styles.apply} type="submit">Apply filters</Button>
        </form>
        {categoryRead.status === 'rejected' && <p className={styles.subtle}>Category filters are temporarily unavailable. Search still works.</p>}
        {!catalog ? <div className={styles.message} role="status"><h2>The catalog could not be loaded</h2><p>Retry when the theme service is available. Your store is unchanged.</p><Link href={publicCatalogHref(query)}>Retry catalog</Link></div> : <>
            <div className={styles.resultBar}><p>{catalog.total} {catalog.total === 1 ? 'theme' : 'themes'}{query.search ? ` matching “${query.search}”` : ''}</p>{(query.search || query.category) && <Link href="/theme-preview">Clear filters</Link>}</div>
            {!catalog.data.length ? <div className={styles.message}><h2>No themes match these filters</h2><p>Try another search or browse all themes.</p><Link href="/theme-preview">Browse all themes</Link></div> : <div className={styles.grid}>{catalog.data.map((theme, index) => <article className={styles.card} key={theme.slug}><Link href={publicCatalogHref(query, { theme: theme.slug })} className={styles.cardLink}><ThemeArtwork theme={theme} priority={index < 3} /><div className={styles.cardHeading}><h2>{theme.name}</h2><span>{publicThemePrice(theme)}</span></div><p>{theme.description || theme.category.replaceAll('_', ' ')}</p><span className={styles.view}>View theme <ArrowRight size={16} aria-hidden="true" /></span></Link></article>)}</div>}
            <nav className={styles.pagination} aria-label="Theme catalog pages">{catalog.page > 1 && <Link href={publicCatalogHref(query, { page: catalog.page - 1 })}><ArrowLeft size={16} aria-hidden="true" /> Previous</Link>}<span>Page {catalog.page} of {Math.max(1, Math.ceil(catalog.total / Math.max(1, catalog.limit)))}</span>{catalog.has_more && <Link href={publicCatalogHref(query, { page: catalog.page + 1 })}>Next <ArrowRight size={16} aria-hidden="true" /></Link>}</nav>
        </>}
        </section><footer className={styles.footer}>Theme selection is just the beginning. Your products, content and policies make the store yours.</footer>
    </main>;
}
