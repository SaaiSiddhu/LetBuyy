'use client';
import { MerchantNavigationLink as Link } from '@/components/MerchantNavigationLink';
import { MerchantEmptyArtwork } from '@/components/empty-states/MerchantEmptyState';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useReadRequest } from '@/lib/api/use-read-request';
import type { ThemeCatalogItem } from '@letbuyy/api-client';
import { Badge, Banner, Button, Card, PageHeader, Dropdown, ExternalLink, Eye, MoreHorizontal, Modal, Palette, Input, Skeleton, Store, useToast } from '@letbuyy/ui';
import { getStorefrontBaseUrl, getStorefrontStoreUrl } from '@/lib/public-urls';
import { ThemeLibraryWorkspace } from './ThemeLibraryWorkspace';
import { StorefrontVisibility } from './StorefrontVisibility';
import { addMarketplaceTheme } from '@/lib/themes/marketplace-contract';
import { catalogArtworkUrl } from '@/lib/themes/catalog-artwork';
import styles from './theme-workspace.module.css';
function errorMessage(payload: {
    error?: string | {
        message?: string;
    };
}, fallback: string) { return typeof payload.error === 'string' ? payload.error : payload.error?.message || fallback; }
export function ThemeWorkspace({ view = 'overview' }: { view?: 'overview' | 'library' }) {
    const { store } = useParams<{
        store: string;
    }>();
    const [themes, setThemes] = useState<ThemeCatalogItem[]>([]), [current, setCurrent] = useState<ThemeCatalogItem | null>(null);
    const [storeId, setStoreId] = useState<string | null>(null), [status, setStatus] = useState('draft');
    const [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    const [preview, setPreview] = useState<ThemeCatalogItem | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const { notify } = useToast();
    const router = useRouter();
    const beginRead = useReadRequest(store);
    const load = useCallback(async () => {
        const request = beginRead();
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`/api/themes?store_name=${encodeURIComponent(store)}&sort=portfolio&limit=5`, { cache: 'no-store', signal: request.signal }), payload = await response.json();
            if (!request.isCurrent()) return;
            if (!response.ok)
                throw new Error(errorMessage(payload, 'The theme catalog could not load.'));
            setThemes(payload.themes);
            setCurrent(payload.currentTheme || null);
            setStoreId(payload.storeId);
            setStatus(payload.storeStatus || 'draft');
        }
        catch (cause) {
            if (!request.isCurrent()) return;
            setError(cause instanceof Error ? cause.message : 'The theme catalog could not load.');
        }
        finally {
            if (request.isCurrent()) setLoading(false);
        }
    }, [beginRead, store]);
    useEffect(() => { void load(); }, [load]);
    const install = async (themeSlug?: string, bundle?: unknown) => {
        if (busy || !storeId)
            return;
        setBusy(themeSlug || 'import');
        try {
            await addMarketplaceTheme({ store, slug: themeSlug || '', version: themes.find(theme => theme.slug === themeSlug)?.version, bundle });
            await load();
            setRevision(value => value + 1);
            setPreview(value => value && value.slug === themeSlug ? { ...value, installed: true } : value);
            notify({ title: 'Theme added to your library', description: 'Customize it when you’re ready. Your live theme has not changed.', variant: 'success' });
        }
        catch (cause) {
            notify({ title: 'Add has not been confirmed', description: cause instanceof Error ? cause.message : 'Retry Add.', variant: 'critical' });
        }
        finally {
            setBusy(null);
            if (fileInput.current)
                fileInput.current.value = '';
        }
    };
    const duplicateCurrent = async () => {
        if (!current || busy)
            return;
        setBusy(current.slug);
        try {
            const response = await fetch(`/api/themes/${encodeURIComponent(current.slug)}/duplicate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store_name: store }) }), payload = await response.json();
            if (!response.ok)
                throw new Error(errorMessage(payload, 'Theme duplication failed.'));
            setRevision(value => value + 1);
            notify({ title: 'Theme duplicated', variant: 'success' });
        }
        catch (cause) {
            notify({ title: 'Theme could not be duplicated', description: cause instanceof Error ? cause.message : 'Retry duplication.', variant: 'critical' });
        }
        finally {
            setBusy(null);
        }
    };
    const storefront = getStorefrontStoreUrl(store), editor = (slug: string) => `/${store}/online-store/themes/${encodeURIComponent(slug)}/editor`;
    const overviewHref = `/${store}/online-store/themes`;
    const libraryHref = `${overviewHref}?view=library`;
    const currentArtwork = current ? catalogArtworkUrl(current) : null;
    return <div className={styles.workspace}>
        <PageHeader recipe="workbench" title="Online Store" icon={<Store aria-hidden="true" className="letbuyy-icon" />} overflowAction={<div className={styles.actions}>
            <StorefrontVisibility key={store} store={store} onChanged={() => void load()} />
            <a className="themes-button themes-button-secondary" href={storefront} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden="true" />View store</a>
            <Dropdown align="end" trigger={<Button variant="secondary" size="icon" aria-label="More online store actions"><MoreHorizontal size={16} /></Button>} items={[
                { id: 'library', label: 'Manage themes', onSelect: () => router.push(libraryHref) },
                { id: 'marketplace', label: 'Explore all themes', onSelect: () => router.push(`${overviewHref}/marketplace`) },
                { id: 'import', label: 'Import theme', disabled: !storeId || !!busy, onSelect: () => fileInput.current?.click() },
                { id: 'preferences', label: 'Storefront preferences', onSelect: () => router.push(`/${store}/online-store/preferences`) },
            ]} />
        </div>} />

        <Input unstyled type="file" ref={fileInput} accept="application/json,.json" hidden aria-label="Import theme package" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try { await install(undefined, JSON.parse(await file.text())); }
            catch { notify({ title: 'Choose a valid JSON theme package', variant: 'critical' }); }
        }} />

        {error && <Banner variant="critical" title="Themes could not load" action={<Button variant="secondary" onClick={() => void load()}>Retry</Button>}>{error}</Banner>}

        {!error && view === 'library' && <section className={styles.libraryView} aria-label="Your theme library">
            <div className={styles.sectionHeader}>
                <div><h2>Your themes</h2><p className={styles.muted}>Manage saved designs and choose what to publish.</p></div>
                <Link className="themes-button themes-button-secondary" href={overviewHref}>Back to overview</Link>
            </div>
            {storeId ? <ThemeLibraryWorkspace key={revision} store={store} storeId={storeId} onChanged={() => void load()} /> : loading ? <Skeleton variant="card" /> : null}
        </section>}

        {!error && view === 'overview' && <>
            {loading ? <Skeleton variant="card" /> : <Card className={styles.hero} aria-label="Current theme">
                <div className={styles.heroMedia}>
                    {currentArtwork ? <><img src={currentArtwork} alt={`${current?.name} theme artwork`} width={1274} height={796} /><span className={styles.artworkLabel}>Theme artwork · Preview saved design in editor</span></>
                        : <div className={styles.heroPlaceholder}><Palette size={30} aria-hidden="true" /><h2>{current ? 'Preview your saved design' : 'Make your store your own'}</h2><p>{current ? 'Open the theme editor to see your saved changes.' : 'Choose a theme below to begin designing your storefront.'}</p></div>}
                </div>
                <div className={styles.heroFooter}>
                    <div><h2>{current?.name || 'No current theme'}{current && <Badge label={status === 'published' ? 'Current theme' : 'Unpublished'} variant={status === 'published' ? 'success' : 'default'} />}</h2><p>{current ? (status === 'published' ? 'Published design' : 'Your storefront is not published yet') : 'Adding a theme will not publish your store.'}</p></div>
                    <div className={styles.actions}>
                        <Link className="themes-button themes-button-secondary" href={libraryHref}>Manage themes</Link>
                        {current && <><Dropdown align="end" trigger={<Button variant="secondary" size="icon" aria-label="More current theme actions" disabled={!!busy}><MoreHorizontal size={16} /></Button>} items={[
                            { id: 'duplicate', label: 'Duplicate', onSelect: () => void duplicateCurrent() },
                            { id: 'recovery', label: 'Updates and recovery', onSelect: () => router.push(`${overviewHref}/update?themeSlug=${encodeURIComponent(current.slug)}`) },
                            { id: 'preferences', label: 'Storefront visibility', onSelect: () => router.push(`/${store}/online-store/preferences`) },
                        ]} /><Link className="themes-button themes-button-primary" href={editor(current.slug)}>Edit theme</Link></>}
                    </div>
                </div>
            </Card>}

            <section className={styles.section} aria-label="Discover themes">
                <div className={styles.sectionHeader}><div><h2>Discover themes</h2><p className={styles.muted}>Five storefront designs to get you started.</p></div><Link className="themes-button themes-button-secondary" href={`${overviewHref}/marketplace`}>Explore all themes</Link></div>
                {loading ? <div className={styles.grid}><Skeleton variant="card" /><Skeleton variant="card" /><Skeleton variant="card" /></div>
                    : themes.length ? <div className={styles.grid}>
                        {themes.slice(0, 5).map(theme => <article key={theme.id} className={styles.card} aria-label={`${theme.name} theme`}>
                            <Button unstyled className={styles.previewButton} onClick={() => setPreview(theme)} aria-label={`Preview ${theme.name}`}><img src={theme.thumbnail_url || '/theme-previews/summit.svg'} alt={`${theme.name} sample storefront preview`} width={1274} height={796} loading="lazy" decoding="async" /></Button>
                            <div className={styles.cardFooter}><div><h3>{theme.name}</h3><p>by LetBuyy</p></div>{theme.installed ? <Link className="themes-button themes-button-secondary" href={editor(theme.slug)}>Customize</Link> : <Button size="sm" variant="secondary" aria-label={`Add ${theme.name}`} disabled={!!busy || !storeId || theme.is_active === false} onClick={() => void install(theme.slug)}>{busy === theme.slug ? 'Adding…' : 'Add'}</Button>}</div>
                        </article>)}
                        <div className={styles.exploreTile}><div><Store size={24} aria-hidden="true" /><h3>Explore more themes</h3><p>Find the right look for your store in the full theme collection.</p></div><Link className="themes-button themes-button-secondary" href={`${overviewHref}/marketplace`}>Explore all themes</Link></div>
                    </div> : <Card className={styles.discoveryEmpty}><MerchantEmptyArtwork scene="themes" /><h3>No featured themes available</h3><p>Explore the theme collection or try again later.</p><Link className="themes-button themes-button-secondary" href={`${overviewHref}/marketplace`}>Explore all themes</Link></Card>}
            </section>
        </>}

        <Modal open={!!preview} onClose={() => setPreview(null)} title={preview ? `${preview.name} theme` : 'Theme preview'} className={styles.previewModal}><div className={styles.previewDetail}>{preview && <><img src={preview.thumbnail_url || '/theme-previews/summit.svg'} alt={`${preview.name} storefront preview`} /><p>{preview.description}</p><p className={styles.muted}>This sample preview shows the theme design. Adding it keeps your current storefront unchanged until you publish.</p><div className={styles.actions}><a className="themes-button themes-button-secondary" href={`${getStorefrontBaseUrl()}/theme-preview/${encodeURIComponent(preview.slug)}`} target="_blank" rel="noreferrer"><Eye size={14} />Open interactive preview</a>{preview.installed ? <Link className="themes-button themes-button-primary" href={editor(preview.slug)}>Customize</Link> : <Button variant="primary" disabled={!!busy} onClick={() => void install(preview.slug)}>{busy === preview.slug ? 'Adding…' : 'Add to theme library'}</Button>}</div></>}</div></Modal>
    </div>;
}
