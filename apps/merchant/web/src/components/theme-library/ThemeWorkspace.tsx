'use client';
import { MerchantNavigationLink as Link } from '@/components/MerchantNavigationLink';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useReadRequest } from '@/lib/api/use-read-request';
import type { ThemeCatalogItem } from '@letbuyy/api-client';
import { Badge, Banner, Button, Card, PageHeader, Dropdown, ExternalLink, Eye, MoreHorizontal, Modal, Palette, Input, Select, Skeleton, Store, Upload, useToast } from '@letbuyy/ui';
import { getStorefrontBaseUrl, getStorefrontStoreUrl } from '@/lib/public-urls';
import { ThemeLibraryWorkspace } from './ThemeLibraryWorkspace';
import { StorefrontVisibility } from './StorefrontVisibility';
import { addMarketplaceTheme } from '@/lib/themes/marketplace-contract';
import styles from './theme-workspace.module.css';
function errorMessage(payload: {
    error?: string | {
        message?: string;
    };
}, fallback: string) { return typeof payload.error === 'string' ? payload.error : payload.error?.message || fallback; }
export function ThemeWorkspace({ marketplace = false }: {
    marketplace?: boolean;
}) {
    const { store } = useParams<{
        store: string;
    }>();
    const [themes, setThemes] = useState<ThemeCatalogItem[]>([]), [current, setCurrent] = useState<ThemeCatalogItem | null>(null);
    const [storeId, setStoreId] = useState<string | null>(null), [status, setStatus] = useState('draft');
    const [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState<string | null>(null);
    const [revision, setRevision] = useState(0), [search, setSearch] = useState(''), [category, setCategory] = useState('all');
    const [storefrontRevision, setStorefrontRevision] = useState(0);
    const [publicPreview, setPublicPreview] = useState<{ store: string; visible: boolean } | null>(null);
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
            const response = await fetch(`/api/themes?store_name=${encodeURIComponent(store)}`, { cache: 'no-store', signal: request.signal }), payload = await response.json();
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
    const categories = [...new Set(themes.map(theme => theme.category?.toLowerCase()).filter(Boolean))];
    const filtered = themes.filter(theme => (category === 'all' || theme.category?.toLowerCase() === category) && `${theme.name} ${theme.description} ${theme.tags?.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
    const storefront = getStorefrontStoreUrl(store), editor = (slug: string) => `/${store}/online-store/themes/${encodeURIComponent(slug)}/editor`;
    return <div className={styles.workspace}>
  <PageHeader recipe="workbench" title={marketplace ? 'Theme marketplace' : 'Online Store'} icon={<Store aria-hidden="true" className="letbuyy-icon"/>} overflowAction={<div className={styles.actions}>
   {marketplace ? <Link href={`/${store}/online-store/themes`}>Back to themes</Link> : <StorefrontVisibility key={store} store={store} onLoaded={(loadedStore, visible) => setPublicPreview({ store: loadedStore, visible })} onChanged={() => { setStorefrontRevision(value => value + 1); void load(); }}/>}
   <a className="themes-button themes-button-secondary" href={storefront} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden="true"/>View store</a>
   <Dropdown align="end" trigger={<Button variant="secondary" aria-label="More online store actions"><MoreHorizontal size={16}/></Button>} items={[
            { id: 'preferences', label: 'Storefront preferences', onSelect: () => { router.push(`/${store}/online-store/preferences`); } },
            { id: 'marketplace', label: 'Browse theme marketplace', onSelect: () => { router.push(`/${store}/online-store/themes/marketplace`); } },
        ]}/></div>}/>
  {error && <Banner variant="critical" title="Themes could not load">{error}<Button variant="secondary" onClick={() => void load()}>Retry</Button></Banner>}
  {!error && <>
  {!marketplace && <>{loading ? <Skeleton variant="card"/> : <Card className={styles.hero} aria-label="Current theme">
   <div className={styles.heroMedia}>{current && publicPreview?.store === store && publicPreview.visible ? <iframe key={`${current.slug}:${storefrontRevision}`} title="Current storefront" src={storefront} loading="lazy" sandbox="allow-scripts allow-same-origin allow-forms" className="theme-current-storefront-frame"/> : current ? <div className={styles.empty}><Palette size={32}/><h2>{status === 'published' ? 'Preview your saved design' : 'Your store is not live yet'}</h2><p>Open the theme editor to preview your saved design.</p></div> : <div className={styles.empty}><Palette size={32}/><h2>Make your store your own</h2><p>Choose a design below and add it to your theme library.</p></div>}</div>
   <div className={styles.heroFooter}><div><h2>{current?.name || 'No current theme'}{current && <Badge label={status === 'published' ? 'Current theme' : 'Unpublished'} variant={status === 'published' ? 'success' : 'default'}/>}</h2><p>{current ? `Version ${current.version || '1.0'} · ${status === 'published' ? 'Published design' : 'Your store is not live yet'}` : 'Adding a theme keeps it private until you publish.'}</p></div>
    {current && <div className={styles.actions}><Dropdown align="end" trigger={<Button variant="secondary" aria-label="More current theme actions" disabled={!!busy}><MoreHorizontal size={16}/></Button>} items={[
                        { id: 'duplicate', label: 'Duplicate', onSelect: () => void duplicateCurrent() },
                        { id: 'editor', label: 'Customize', onSelect: () => { router.push(editor(current.slug)); } },
                        { id: 'recovery', label: 'Updates and recovery', onSelect: () => { router.push(`/${store}/online-store/themes/update?themeSlug=${encodeURIComponent(current.slug)}`); } },
                        { id: 'preferences', label: 'Storefront visibility', onSelect: () => { router.push(`/${store}/online-store/preferences`); } },
                    ]}/><Link className="themes-button themes-button-primary" href={editor(current.slug)}>Edit theme</Link></div>}
   </div></Card>}
   {storeId ? <ThemeLibraryWorkspace key={revision} store={store} storeId={storeId} onChanged={() => { setStorefrontRevision(value => value + 1); void load(); }}/> : <Skeleton variant="card"/>}
  </>}
  <section className={styles.section} aria-label={marketplace ? 'Theme marketplace catalog' : 'Discover themes'}>
   <div className={styles.sectionHeader}><div><h2>{marketplace ? 'Find your next look' : 'Discover themes'}</h2><p className={styles.muted}>Ten distinct storefront designs, all free to add. Preview each theme with sample products before making it your own.</p></div><div className={styles.actions}>
    {!marketplace && <Link className="themes-button themes-button-secondary" href={`/${store}/online-store/themes/marketplace`}>Visit Theme Store<ExternalLink size={14} aria-hidden="true"/></Link>}
    <Button variant="secondary" disabled={!!busy || !storeId} onClick={() => fileInput.current?.click()}><Upload size={14} aria-hidden="true"/>{busy === 'import' ? 'Importing…' : 'Import theme'}</Button>
    <Input unstyled type="file" ref={fileInput} accept="application/json,.json" hidden onChange={async (event) => { const file = event.target.files?.[0]; if (!file)
        return; try {
        await install(undefined, JSON.parse(await file.text()));
    }
    catch {
        notify({ title: 'Choose a valid JSON theme package', variant: 'critical' });
    } }}/>
   </div></div>
   <div className={styles.filters}><Input unstyled aria-label="Search themes" placeholder="Search themes" value={search} onChange={event => setSearch(event.target.value)}/><Select unstyled aria-label="Filter themes by category" value={category} onChange={event => setCategory(event.target.value)} options={[{ value: 'all', label: 'All categories' }, ...categories.map(value => ({ value: value || '', label: value ? value[0].toUpperCase() + value.slice(1) : '' }))]}/><span className={styles.muted}>{filtered.length} themes</span></div>
   {loading ? <div className={styles.grid}><Skeleton variant="card"/><Skeleton variant="card"/></div> : <div className={styles.grid}>{filtered.map(theme => <article key={theme.id} className={styles.card} aria-label={`${theme.name} catalog theme`}>
    <Button unstyled className={styles.previewButton} onClick={() => setPreview(theme)} aria-label={`Preview ${theme.name}`}><img src={theme.thumbnail_url || '/theme-previews/summit.svg'} alt={`${theme.name} sample storefront preview`} width={1274} height={796} loading="lazy" decoding="async"/></Button>
    <div className={styles.cardFooter}><div><h3>{theme.name}</h3><div className={styles.cardMeta}><span className={styles.muted}>by {'LetBuyy'}</span><Badge label="Free" variant="default"/></div><p>{theme.description}</p><span className={styles.muted}>Version {theme.version || '1.0'}</span></div>{theme.installed ? <Link className="themes-button themes-button-secondary" href={editor(theme.slug)}>Customize</Link> : <Button variant="secondary" aria-label={`Add ${theme.name}`} disabled={!!busy || !storeId || !theme.is_active} onClick={() => void install(theme.slug)}>{busy === theme.slug ? 'Adding…' : 'Add'}</Button>}</div>
   </article>)}</div>}
   {!loading && !filtered.length && <div className={styles.empty}><Palette size={24}/><h3>No themes found</h3><p>Try another name or category.</p><Button variant="secondary" onClick={() => { setSearch(''); setCategory('all'); }}>Clear filters</Button></div>}
  </section>
  </>}
  <Modal open={!!preview} onClose={() => setPreview(null)} title={preview ? `${preview.name} theme` : 'Theme preview'} className={styles.previewModal}><div className={styles.previewDetail}>{preview && <><img src={preview.thumbnail_url || '/theme-previews/summit.svg'} alt={`${preview.name} storefront preview`}/><p>{preview.description}</p><p className={styles.muted}>{preview.slug === 'letbuyy-sense' ? 'Threadline 2.0.0 · Actual package preview with sample merchandise. Supply campaign photographs, collections and garment facts for your own store.' : 'Open the interactive preview to explore this theme with sample content.'}</p><div className={styles.actions}><a className="themes-button themes-button-secondary" href={`${getStorefrontBaseUrl()}/theme-preview/${encodeURIComponent(preview.slug)}`} target="_blank" rel="noreferrer"><Eye size={14}/>Open interactive preview</a>{preview.installed ? <Link className="themes-button themes-button-primary" href={editor(preview.slug)}>Customize</Link> : <Button variant="primary" disabled={!!busy} onClick={() => void install(preview.slug)}>{busy === preview.slug ? 'Adding…' : 'Add to theme library'}</Button>}</div></>}</div></Modal>
 </div>;
}
