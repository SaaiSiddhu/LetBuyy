'use client';
import { useEffect, useRef, useState, type MouseEvent, type FormEvent, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input, Button, Search } from '@letbuyy/ui';
import { catalogDemoHref, catalogDemoNavigationTarget, CATALOG_DEMO_ROUTE_MESSAGE, resolveCatalogDemoRoute } from '@/lib/demo/catalog-demo-route';
import styles from './catalog-preview.module.css';
/** Keep sample-product navigation inside the selected catalog design. */
export default function CatalogPreviewNavigation({ slug, version, children }: {
    slug: string;
    version?: string;
    children: ReactNode;
}) {
    const router = useRouter();
    const query = useSearchParams();
    const currentRoute = resolveCatalogDemoRoute(query.get('demo_path') || '/');
    const path = currentRoute.path;
    const [notice, setNotice] = useState('');
    const content = useRef<HTMLDivElement>(null);
    const base = catalogDemoHref(slug, '/', version);
    useEffect(() => {
        if (window.parent !== window) window.parent.postMessage({ type: CATALOG_DEMO_ROUTE_MESSAGE, slug, path }, window.location.origin);
    }, [path, slug]);
    useEffect(() => {
        const root = content.current;
        if (!root) return;
        const rewrite = () => {
            for (const anchor of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
                if (anchor.dataset.catalogBlockedHref) continue;
                const href = anchor.getAttribute('href');
                if (!href || href.startsWith('#')) continue;
                const translated = catalogDemoNavigationTarget(href, window.location.origin, slug, version);
                if (translated) { if (anchor.getAttribute('href') !== translated) anchor.setAttribute('href', translated); }
                else { anchor.dataset.catalogBlockedHref = href; anchor.setAttribute('href', '#demo-link-unavailable'); }
            }
        };
        rewrite();
        const observer = new MutationObserver(rewrite);
        observer.observe(root, { childList: true, subtree: true });
        let hash = '';
        try { hash = decodeURIComponent(new URL(path, window.location.origin).hash.slice(1)); } catch { /* no invalid fragment authority */ }
        if (hash) document.getElementById(hash)?.scrollIntoView({ block: 'start' });
        return () => observer.disconnect();
    }, [path, slug, version]);
    function navigate(event: MouseEvent<HTMLDivElement>) {
        if ((event.target as Element).closest('[data-lb-add-to-cart],[data-lb-buy-now],lb-wishlist-toggle')) { event.preventDefault(); event.stopPropagation(); setNotice('Sample shopping is unavailable until this demo’s isolated cart session is ready. Your real store cart is unchanged.'); return; }
        const anchor = (event.target as Element).closest('a');
        if (anchor?.dataset.catalogBlockedHref) { event.preventDefault(); event.stopPropagation(); setNotice('This link leaves the sample store. External navigation is unavailable in the demo.'); return; }
        const href = anchor?.getAttribute('href');
        if (!href || href.startsWith('#'))
            return;
        event.preventDefault(); event.stopPropagation();
        const target = catalogDemoNavigationTarget(href, window.location.origin, slug, version);
        if (target) { setNotice(''); router.push(target); }
        else setNotice('This link leaves the sample store. External navigation and real account or provider actions are unavailable in the demo.');
    }
    function submit(event: FormEvent<HTMLDivElement>) {
        const form = event.target as HTMLFormElement;
        if (form.tagName !== 'FORM') return;
        event.preventDefault(); event.stopPropagation();
        const action = form.getAttribute('action') || path;
        if ((form.getAttribute('method') || 'get').toLowerCase() !== 'get') { setNotice('Demo form only. No message, subscription, account or order was sent.'); return; }
        let url: URL;
        try { url = new URL(action, window.location.origin); } catch { setNotice('This sample form is unavailable.'); return; }
        const fields = Array.from(new FormData(form)).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
        for (const key of new Set(fields.map(([key]) => key))) url.searchParams.delete(key);
        for (const [key, value] of fields) url.searchParams.append(key, value);
        const target = catalogDemoNavigationTarget(url.toString(), window.location.origin, slug, version);
        const destination = target ? resolveCatalogDemoRoute(new URL(target, window.location.origin).searchParams.get('demo_path') || '/') : null;
        if (target && destination && ['search','collection'].includes(destination.type)) { setNotice(''); router.push(target); }
        else setNotice('Demo form only. No message, subscription, account or order was sent.');
    }
    return <div onClickCapture={navigate} onSubmitCapture={submit}>
        {notice && <p role="status" className={styles.notice}>{notice}</p>}
        <nav aria-label="Sample store navigation" className={styles.demoNavigation}>
            <div className={styles.sampleLinks}><a href={base}>Sample home</a><a href={catalogDemoHref(slug, '/products', version)}>Products</a><a href={catalogDemoHref(slug, '/collections', version)}>Collections</a><a href={catalogDemoHref(slug, '/blog', version)}>Journal</a></div>
            <form action="/search" method="get" className={styles.sampleSearch}><Input unstyled key={path} aria-label="Search sample products" name="q" defaultValue={currentRoute.searchParams?.search || ''} maxLength={120} placeholder="Search sample products"/><Button type="submit" variant="ghost" aria-label="Search sample store"><Search size={16} aria-hidden="true"/></Button></form>
        </nav>
        <div ref={content} className="catalog-preview-storefront">{children}</div>
    </div>;
}
