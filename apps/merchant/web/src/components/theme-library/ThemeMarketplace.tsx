'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import type { ThemeCatalogItem } from '@letbuyy/api-client';
import { ArrowLeft, Badge, Banner, Button, Card, ExternalLink, Eye, Input, Palette, Search, Select, Skeleton, Store } from '@letbuyy/ui';
import { MerchantNavigationLink as Link } from '@/components/MerchantNavigationLink';
import { MerchantEmptyArtwork } from '@/components/empty-states/MerchantEmptyState';
import { useReadRequest } from '@/lib/api/use-read-request';
import { getStorefrontBaseUrl } from '@/lib/public-urls';
import { addMarketplaceTheme, marketplaceQuery, payloadError, type MarketplaceCatalog } from '@/lib/themes/marketplace-contract';
import styles from './theme-workspace.module.css';

function priceLabel(theme: ThemeCatalogItem) {
    if (theme.pricing_type === 'free') return 'Free';
    return typeof theme.price_inr === 'number' ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(theme.price_inr) : 'See availability';
}

/** First-party discovery is a view of the existing catalog and owned library. */
export function ThemeMarketplace() {
    const { store } = useParams<{ store: string }>();
    const router = useRouter();
    const params = useSearchParams();
    const queryKey = params.toString();
    const selectedSlug = params.get('theme') || '';
    const showingDemo = params.get('view') === 'demo';
    const [catalog, setCatalog] = useState<MarketplaceCatalog | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState(params.get('search') || '');
    const [busy, setBusy] = useState(false);
    const [installError, setInstallError] = useState('');
    const [confirmed, setConfirmed] = useState<{ slug: string; href: string; replayed: boolean } | null>(null);
    const pendingInstall = useRef<object | null>(null);
    const focusTarget = useRef<HTMLHeadingElement>(null);
    const listingReturn = useRef<{ slug: string; scrollY: number } | null>(null);
    const beginRead = useReadRequest(`${store}:${queryKey}`);
    const pathname = `/${encodeURIComponent(store)}/online-store/themes/marketplace`;
    const href = (changes: Record<string, string | null>) => {
        const next = new URLSearchParams(queryKey);
        for (const [key, value] of Object.entries(changes)) { if (value === null) next.delete(key); else next.set(key, value); }
        return `${pathname}${next.size ? `?${next}` : ''}`;
    };
    const load = useCallback(async () => {
        const request = beginRead();
        setLoading(true); setError(''); setCatalog(null);
        const query = new URLSearchParams(queryKey);
        query.set('store_name', store);
        if (query.get('theme')) query.set('theme_slug', query.get('theme')!);
        if (!marketplaceQuery(query).success) { setError('These catalog filters are invalid. Clear filters to browse themes.'); setLoading(false); return; }
        try {
            const response = await fetch(`/api/themes?${query}`, { cache: 'no-store', signal: request.signal });
            const data = await response.json();
            if (!response.ok) throw new Error(payloadError(data, 'The theme catalog could not load.'));
            if (!Array.isArray(data.themes) || !Number.isInteger(data.total) || !data.storeId) throw new Error('The catalog response could not be confirmed for this store.');
            if (request.isCurrent()) setCatalog(data);
        } catch (cause) {
            if (request.isCurrent()) setError(cause instanceof Error ? cause.message : 'The theme catalog could not load.');
        } finally { if (request.isCurrent()) setLoading(false); }
    }, [beginRead, queryKey, store]);
    useEffect(() => { void load(); }, [load]);
    useEffect(() => { setSearch(params.get('search') || ''); }, [params]);
    useLayoutEffect(() => {
        pendingInstall.current = null;
        setInstallError(''); setConfirmed(null); setBusy(false);
        return () => { pendingInstall.current = null; };
    }, [store, selectedSlug]);
    useEffect(() => { if (!loading && selectedSlug) focusTarget.current?.focus(); }, [loading, selectedSlug]);
    useEffect(() => {
        if (selectedSlug || loading || error || !listingReturn.current) return;
        const previous = listingReturn.current;
        document.querySelector<HTMLAnchorElement>(`[data-marketplace-theme="${CSS.escape(previous.slug)}"]`)?.focus({ preventScroll: true });
        window.scrollTo({ top: previous.scrollY, behavior: 'instant' });
        listingReturn.current = null;
    }, [selectedSlug, loading, error]);
    const remember = (slug: string) => { listingReturn.current = { slug, scrollY: window.scrollY }; };

    const selected = catalog?.selectedTheme?.slug === selectedSlug ? catalog.selectedTheme : null;
    const runtime = catalog?.selectedRuntime?.slug === selectedSlug ? catalog.selectedRuntime : null;
    const runtimeReady = Boolean(runtime?.theme_package_id && runtime?.theme_package_version_id);
    const install = async () => {
        if (!selected || !runtimeReady || pendingInstall.current) return;
        const identity = {};
        pendingInstall.current = identity;
        setBusy(true); setInstallError('');
        try {
            const result = await addMarketplaceTheme({ store, slug: selected.slug, version: selected.version,
                packageId: runtime?.theme_package_id || undefined, packageVersionId: runtime?.theme_package_version_id || undefined });
            if (pendingInstall.current !== identity) return;
            setConfirmed({ slug: selected.slug, href: result.href, replayed: result.receipt.already_installed === true });
        } catch (cause) {
            if (pendingInstall.current === identity) setInstallError(cause instanceof Error ? cause.message : 'Adding the theme was not confirmed. Retry Add.');
        } finally { if (pendingInstall.current === identity) { pendingInstall.current = null; setBusy(false); } }
    };
    const submitSearch = (event: FormEvent) => { event.preventDefault(); router.push(href({ search: search.trim() || null, page: null, theme: null, view: null }), { scroll: false }); };
    const demoUrl = selected ? `${getStorefrontBaseUrl()}/theme-preview/${encodeURIComponent(selected.slug)}?version=${encodeURIComponent(selected.version || '')}&${showingDemo ? 'marketplace=1' : ''}` : '';
    const page = catalog?.page || 1;
    const selectedPending = selectedSlug && loading;

    return <div className={`${styles.workspace} ${styles.marketplace}`}>
        <div className={styles.marketplaceTop}><Link href={`/${store}/online-store/themes`}><ArrowLeft size={16} aria-hidden="true"/> Your theme library</Link><span className={styles.destination}><Store size={16} aria-hidden="true"/> Destination: {store}</span></div>
        {!selectedSlug && <header className={styles.discoveryIntro}><span className={styles.eyebrow}>LetBuyy themes</span><h1>A storefront that fits<br/>your business.</h1><p>Explore designs by catalog and style. Browse the sample store, then make the design your own in the theme editor.</p></header>}
        {error && <Banner variant="critical" title="Theme catalog unavailable">{error}<div className={styles.actions}><Button variant="secondary" onClick={() => void load()}>Retry</Button><Link href={pathname}>Clear filters</Link></div></Banner>}
        {selectedSlug ? <>
            <Link href={href({ theme: null, view: null })} className={styles.backLink}><ArrowLeft size={16} aria-hidden="true"/>Back to results</Link>
            {selectedPending && !error && <div className={styles.detailGrid}><Skeleton variant="card"/><Skeleton variant="card"/></div>}
            {!loading && !error && (catalog?.selectedThemeStatus !== 'ready' || !selected) && <Card className={styles.empty}><MerchantEmptyArtwork scene="theme-marketplace"/><h1 ref={focusTarget} tabIndex={-1}>{catalog?.selectedThemeStatus === 'missing' ? 'This theme is unavailable' : 'Theme details could not load'}</h1><p>{catalog?.selectedThemeStatus === 'missing' ? 'It may have been retired. Return to the catalog to choose an available design.' : 'Your selection is preserved. Retry to load its current details.'}</p><Button variant="secondary" onClick={() => void load()}>Retry details</Button></Card>}
            {!loading && !error && selected?.slug === selectedSlug && <>
                <div className={styles.detailGrid}>
                    <div className={styles.detailVisual}>{selected.thumbnail_url ? <Image unoptimized src={selected.thumbnail_url} width={1440} height={1000} sizes="(max-width: 640px) 100vw, 60vw" alt={`${selected.name} catalog preview`} /> : <div className={styles.empty}>No preview image recorded</div>}</div>
                    <div className={styles.detailSummary}><span className={styles.eyebrow}>Designed by LetBuyy</span><h1 ref={focusTarget} tabIndex={-1}>{selected.name}</h1><div className={styles.cardMeta}><Badge label={priceLabel(selected)}/><span>Version {selected.version || 'unavailable'}</span></div><p>{selected.description}</p>
                        <div className={styles.detailActions}><Link className="themes-button themes-button-primary" href={href({ view: showingDemo ? null : 'demo' })}><Eye size={16} aria-hidden="true"/>{showingDemo ? 'Close demo' : 'View demo'}</Link><Button variant="secondary" disabled={busy || !selected.is_active || !selected.version || !runtimeReady || priceLabel(selected) !== 'Free'} onClick={() => void install()}>{busy ? 'Confirming library…' : 'Add to library'}</Button></div>
                        {!runtimeReady && <Banner variant="warning" title="Package details unavailable">The exact package version could not be confirmed. You can explore the demo while retrying the package read.<Button variant="secondary" onClick={() => void load()}>Retry package details</Button></Banner>}
                        <p className={styles.muted}>Add to <strong>{store}</strong>. Your live theme, products and existing drafts stay in place.</p>
                        {priceLabel(selected) !== 'Free' && <p>Acquisition is unavailable here for this theme. No payment will be attempted.</p>}
                        {installError && <Banner variant="critical" title="Add has not been confirmed">{installError}<Button variant="secondary" onClick={() => void install()} disabled={busy}>Retry Add</Button><Link href={`/${store}/online-store/themes`}>Check library</Link></Banner>}
                        {confirmed?.slug === selected.slug && <Banner variant="success" title={confirmed.replayed ? 'Theme confirmed in your library' : 'Theme added to your library'}>The installed instance was read back from this store. It is ready to customize.<Link className="themes-button themes-button-primary" href={confirmed.href}>Customize theme</Link></Banner>}
                        <section className={styles.setupNote}><h2>Make it your own</h2><p>Use your products, photography, navigation and content. The demo contains sample merchandise; adding the theme does not import it.</p><p className={styles.muted}>Package: {selected.slug}</p></section>
                    </div>
                </div>
                {showingDemo && <section className={styles.embeddedDemo} aria-label={`${selected.name} demo store`}><header className={styles.sectionHeader}><div><h2>{selected.name} sample store</h2><p className={styles.muted}>Version {selected.version} · Sample content</p></div><a href={demoUrl} target="_blank" rel="noreferrer">Open separately<ExternalLink size={14} aria-hidden="true"/></a></header><iframe title={`${selected.name} demo workspace`} src={demoUrl} sandbox="allow-scripts allow-same-origin allow-forms" className={styles.demoWorkspace}/></section>}
                <section className={styles.capabilities}><h2>Theme features</h2>{selected.features?.length ? <ul>{selected.features.map(feature => <li key={feature}>{feature}</li>)}</ul> : <p>Detailed feature metadata has not been recorded for this version. Explore the actual demo before choosing.</p>}<p className={styles.muted}>Features are declared by the package catalog. Demo coverage and setup can vary.</p></section>
            </>}
        </> : <section className={styles.section} aria-label="Theme marketplace catalog" aria-busy={loading}>
            <form className={styles.marketplaceFilters} onSubmit={submitSearch}><label className={styles.searchField}><span>Search themes</span><div><Search size={16} aria-hidden="true"/><Input unstyled value={search} onChange={event => setSearch(event.target.value)} placeholder="Theme name or catalog type" aria-label="Search themes" maxLength={120}/></div></label><label><span>Catalog type</span><Select unstyled aria-label="Catalog type" value={params.get('category') || ''} onChange={event => router.push(href({ category: event.target.value || null, page: null }), { scroll: false })} options={[{ value: '', label: 'All categories' }, ...(catalog?.categories || []).map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))]}/></label><label><span>Sort</span><Select unstyled aria-label="Sort themes" value={params.get('sort') || 'portfolio'} onChange={event => router.push(href({ sort: event.target.value, page: null }), { scroll: false })} options={[{ value: 'portfolio', label: 'Portfolio order' }, { value: 'name', label: 'Name, A–Z' }, { value: 'new', label: 'Newest' }]}/></label><Button type="submit" variant="secondary">Search</Button></form>
            <div className={styles.resultsContext}><p role="status">{loading ? 'Loading themes…' : error ? 'Catalog unavailable' : `${catalog?.total ?? 0} ${(catalog?.total ?? 0) === 1 ? 'theme' : 'themes'}`}</p>{(params.get('search') || params.get('category') || params.get('feature')) && <Link href={pathname}>Clear filters</Link>}</div>
            {loading ? <div className={styles.marketplaceGrid}><Skeleton variant="card"/><Skeleton variant="card"/><Skeleton variant="card"/></div> : !error && <>
                {catalog?.themes.length ? <div className={styles.marketplaceGrid}>{catalog.themes.map(theme => <article key={theme.id} className={styles.card}><Link href={href({ theme: theme.slug })} className={styles.catalogArtwork} data-marketplace-theme={theme.slug} onClick={() => remember(theme.slug)} aria-label={`Explore ${theme.name}`}>{theme.thumbnail_url ? <Image unoptimized src={theme.thumbnail_url} width={960} height={686} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" alt={`${theme.name} catalog preview`} loading="lazy"/> : <Palette size={40} aria-hidden="true"/>}</Link><div className={styles.catalogCardTitle}><div><h2><Link href={href({ theme: theme.slug })} onClick={() => remember(theme.slug)}>{theme.name}</Link></h2><p className={styles.muted}>LetBuyy · {theme.category || 'Storefront'} · {theme.version}</p></div><Badge label={priceLabel(theme)}/></div><p className={styles.catalogDescription}>{theme.description}</p><div className={styles.cardMeta}><Link href={href({ theme: theme.slug })} onClick={() => remember(theme.slug)}>Explore theme</Link><Link href={href({ theme: theme.slug, view: 'demo' })} onClick={() => remember(theme.slug)}>View demo<Eye size={14} aria-hidden="true"/></Link>{theme.installed && <Badge label="In your library"/>}</div></article>)}</div> : <Card className={styles.empty}><MerchantEmptyArtwork scene="theme-marketplace"/><h2>No themes match</h2><p>Try another name or clear the filters.</p><Link href={pathname}>Show all themes</Link></Card>}
                {catalog && (page > 1 || catalog.has_more) && <nav aria-label="Theme results pages" className={styles.pagination}><Button variant="secondary" disabled={page === 1} onClick={() => router.push(href({ page: String(page - 1) }), { scroll: false })}>Previous</Button><span>Page {page}</span><Button variant="secondary" disabled={!catalog.has_more} onClick={() => router.push(href({ page: String(page + 1) }), { scroll: false })}>Next</Button></nav>}
            </>}
        </section>}
    </div>;
}
