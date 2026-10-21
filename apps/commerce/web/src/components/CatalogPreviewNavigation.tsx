'use client';
import type { MouseEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
/** Keep sample-product navigation inside the selected catalog design. */
export default function CatalogPreviewNavigation({ slug, children }: {
    slug: string;
    children: ReactNode;
}) {
    const router = useRouter();
    const base = `/theme-preview/${encodeURIComponent(slug)}`;
    function navigate(event: MouseEvent<HTMLDivElement>) {
        const anchor = (event.target as Element).closest('a');
        const href = anchor?.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin || url.pathname.startsWith('/theme-preview/'))
            return;
        let route: 'index' | 'product' | 'collection' | null = null;
        if (/\/product\//.test(url.pathname))
            route = 'product';
        else if (/\/(shop|products|collections)(\/|$)/.test(url.pathname))
            route = 'collection';
        else if (/\/store\/[^/]+\/?$/.test(url.pathname))
            route = 'index';
        if (route) {
            event.preventDefault();
            router.push(route === 'index' ? base : `${base}?route_type=${route}`);
        }
    }
    return <div onClickCapture={navigate}>
        <nav aria-label="Sample preview pages" className="catalog-preview-pages">
            <a href={base}>Home</a><a href={`${base}?route_type=product`}>Product</a><a href={`${base}?route_type=collection`}>Collection</a>
        </nav>
        <div className="catalog-preview-storefront">{children}</div>
    </div>;
}
