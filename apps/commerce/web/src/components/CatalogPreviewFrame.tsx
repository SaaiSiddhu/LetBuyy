'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, ExternalLink, Home, Monitor, RotateCcw, Smartphone } from '@letbuyy/ui';
import { Tablet } from 'lucide-react';
import { catalogDemoHref, isCatalogDemoRouteMessage, resolveCatalogDemoRoute } from '@/lib/demo/catalog-demo-route';
import styles from './catalog-preview.module.css';

/** Real iframe viewports, so theme media queries run at the chosen device width. */
export default function CatalogPreviewFrame({ slug, name, version, initialPath = '/', initialRoute = 'index' }: { slug: string; name: string; version?: string; initialPath?: string; initialRoute?: string }) {
    const [device, setDevice] = useState('desktop');
    const startingPath = initialPath !== '/' ? resolveCatalogDemoRoute(initialPath).path : initialRoute === 'collection' ? '/products' : '/';
    const [path, setPath] = useState(startingPath);
    const [frameSrc, setFrameSrc] = useState(catalogDemoHref(slug, startingPath, version));
    const [loading, setLoading] = useState(true);
    const [failure, setFailure] = useState(false);
    const [reload, setReload] = useState(0);
    const frame = useRef<HTMLIFrameElement>(null);
    const canvas = useRef<HTMLDivElement>(null);
    const [availableWidth, setAvailableWidth] = useState(0);
    useEffect(() => {
        const element = canvas.current;
        if (!element) return;
        const observer = new ResizeObserver(entries => setAvailableWidth(entries[0].contentRect.width));
        observer.observe(element); return () => observer.disconnect();
    }, []);
    useEffect(() => {
        const timer = setTimeout(() => { if (loading) setFailure(true); }, 20_000);
        return () => clearTimeout(timer);
    }, [loading, frameSrc]);
    useEffect(() => {
        function receive(event: MessageEvent) {
            if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || !isCatalogDemoRouteMessage(event.data, slug)) return;
            setPath(event.data.path); setLoading(false); setFailure(false);
            const next = new URL(window.location.href);
            next.searchParams.set('demo_path', event.data.path);
            if (version) next.searchParams.set('version', version);
            if (next.toString() !== window.location.href) window.history.pushState({}, '', next);
        }
        function restore() {
            const route = resolveCatalogDemoRoute(new URLSearchParams(window.location.search).get('demo_path') || '/');
            setPath(route.path); setFrameSrc(catalogDemoHref(slug, route.path, version)); setLoading(true); setFailure(false);
        }
        window.addEventListener('message', receive); window.addEventListener('popstate', restore);
        return () => { window.removeEventListener('message', receive); window.removeEventListener('popstate', restore); };
    }, [slug, version]);
    function visit(nextPath: string, forceReload = false) {
        const route = resolveCatalogDemoRoute(nextPath);
        const nextSource = catalogDemoHref(slug, route.path, version);
        if (forceReload || nextSource === frameSrc) setReload(value => value + 1);
        setPath(route.path); setFrameSrc(nextSource); setLoading(true); setFailure(false);
    }
    const width = device === 'mobile' ? 390 : device === 'tablet' ? 834 : 1440;
    const height = device === 'mobile' ? 844 : device === 'tablet' ? 1112 : 1000;
    const scale = availableWidth ? Math.min(1, availableWidth / width) : 1;
    return <main className={styles.workspace}>
        <header className={styles.toolbar}><div className={styles.identity}><h1>{name}</h1><span>{version ? `Version ${version} · ` : ''}Sample store</span></div>
            <div className={styles.devices} role="group" aria-label="Preview device">{[["desktop",Monitor],["tablet",Tablet],["mobile",Smartphone]].map(([key, Icon]) => { const DeviceIcon = Icon as typeof Monitor; return <Button key={String(key)} variant="ghost" aria-label={`${key} preview`} aria-pressed={device === key} onClick={() => setDevice(String(key))}><DeviceIcon size={18} aria-hidden="true"/></Button>; })}</div>
            <div className={styles.controls}><Button variant="ghost" aria-label="Demo home" onClick={() => visit('/')}><Home size={18} aria-hidden="true"/></Button><Button variant="ghost" aria-label="Reload demo page" onClick={() => visit(path, true)}><RotateCcw size={18} aria-hidden="true"/></Button><a href={catalogDemoHref(slug, path, version)} target="_blank" rel="noreferrer" aria-label="Open sample store separately"><ExternalLink size={18} aria-hidden="true"/></a></div>
        </header>
        <div className={styles.routeBar}><span>Your store is unchanged.</span><span className={styles.currentPath} aria-label="Current demo page">{path}</span><span>{width}px viewport</span></div>
        {loading && <p role="status" className={styles.notice}>Loading sample store…</p>}
        {failure && <div role="alert" className={styles.notice}><p>The sample store has not responded. Your selected theme and page are preserved.</p><Button variant="secondary" onClick={() => visit(path, true)}>Retry demo</Button></div>}
        <div ref={canvas} className={styles.canvas}><div style={{ width: width * scale, height: height * scale, marginInline: 'auto' }}><iframe key={reload} ref={frame} title={`${name} ${device} sample store`} src={frameSrc} width={width} height={height} style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }} sandbox="allow-scripts allow-same-origin allow-forms" referrerPolicy="no-referrer" onError={() => { setLoading(false); setFailure(true); }}/></div></div>
    </main>;
}
