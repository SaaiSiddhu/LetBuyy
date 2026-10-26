import Image from 'next/image';
import { Search, Monitor, Smartphone } from '@letbuyy/ui';

export type MarketplaceArtworkKind = 'discover' | 'create' | 'learn' | 'support' | 'legal' | 'library';

export function artworkForHref(href: string): MarketplaceArtworkKind {
    if (/^\/(legal|pricing|checkout)/.test(href) || /licenses/.test(href)) return 'legal';
    if (/^\/(dashboard|install)/.test(href) || /updates-and-rollback|before-you-publish/.test(href)) return 'library';
    if (/^\/(support|contact|faq)/.test(href)) return 'support';
    if (/^\/(developer|for-creators)/.test(href) || /install-and-publish/.test(href)) return 'create';
    if (/choose-the-right-theme|preview-a-theme/.test(href)) return 'discover';
    if (/^\/(guides|docs)/.test(href)) return 'learn';
    return 'discover';
}

function BrowserBar() {
    return <div className="theme-scene-browser"><i /><i /><i /><span>Sample website</span></div>;
}

function Storefront({ fashion = false, priority = false }: { fashion?: boolean; priority?: boolean }) {
    const category = fashion ? 'wardrobe' : 'living';
    return <div className={`theme-scene-store ${fashion ? 'theme-scene-fashion' : ''}`}>
        <div className="theme-scene-store-nav"><b>{fashion ? 'STUDIO / EVERYDAY' : 'FORM & LIVING'}</b><span>Shop&nbsp;&nbsp; Our story&nbsp;&nbsp; Journal</span><Search /></div>
        <div className="theme-scene-hero-photo"><Image src={`/showcase/${category}.webp`} alt="" fill sizes="(max-width: 639px) 260px, 420px" priority={priority} /><div className="theme-scene-hero-copy"><small>{fashion ? 'THE EVERYDAY COLLECTION' : 'THOUGHTFUL OBJECTS. EVERYDAY LIVING.'}</small><strong>{fashion ? 'Wear your own story.' : 'A place to slow down.'}</strong><span>Explore the collection <span>↗</span></span></div></div>
        <div className="theme-scene-product-heading"><b>{fashion ? 'The everyday edit' : 'Considered, by design.'}</b><span>View collection ↗</span></div>
        <div className="theme-scene-products">{[category, `${category}-detail`, fashion ? 'outdoors-detail' : 'care-detail'].map((file,index) => <div key={file}><div className="theme-scene-product-photo"><Image src={`/showcase/${file}.webp`} alt="" fill sizes="100px" /></div><span>{index === 0 ? 'Made for everyday' : index === 1 ? 'The essentials' : 'A little detail'}</span></div>)}</div>
    </div>;
}

function ThemeEditor() {
    return <div className="theme-scene-editor">
        <div className="theme-scene-editor-bar"><b>Theme editor</b><span><Monitor /><Smartphone /></span><i>Draft</i></div>
        <div className="theme-scene-editor-body"><aside><b>Your storefront</b><span className="theme-scene-selected">Hero banner</span><span>Featured collection</span><span>Image with text</span><hr /><b>Brand settings</b><small>Colours</small><div className="theme-scene-swatches"><i /><i /><i /><i /></div><small>Typography</small><strong>Aa <span>Editorial</span></strong></aside><div className="theme-scene-editor-preview"><Storefront /></div></div>
    </div>;
}

function DocumentLayout({ kind }: { kind: 'learn' | 'support' | 'legal' }) {
    const support = kind === 'support', legal = kind === 'legal';
    return <div className="theme-scene-document"><div className="theme-scene-doc-nav"><b>LETBUYY THEMES</b><span>Explore&nbsp;&nbsp; Guides&nbsp;&nbsp; Help</span></div>
        <div className="theme-scene-doc-layout"><aside><b>{support ? 'Help center' : legal ? 'Information' : 'Theme guides'}</b><span className="theme-scene-selected">{support ? 'Getting started' : legal ? 'Privacy & data' : 'Find your theme'}</span><span>{legal ? 'Theme licensing' : 'Your store library'}</span><span>{legal ? 'Purchases' : 'Customise your look'}</span><span>{legal ? 'Contact options' : 'Prepare to publish'}</span></aside><div className="theme-scene-doc-content"><small>{legal ? 'POLICIES & INFORMATION' : support ? 'A LITTLE HELP, RIGHT HERE' : 'FROM FIRST LOOK TO YOUR OWN LOOK'}</small><strong>{legal ? 'Clear details. Confident choices.' : support ? 'What can we help you with?' : 'Make a theme feel like you.'}</strong>
            {support ? <div className="theme-scene-search"><Search /><span>Search theme questions</span></div> : <div className="theme-scene-doc-photo"><Image src={`/showcase/${legal ? 'living' : 'wardrobe'}.webp`} alt="" fill sizes="240px" /></div>}
            <div className="theme-scene-doc-lines"><i /><i /><i /></div><div className="theme-scene-doc-tiles"><span>{support ? 'Choosing a theme' : legal ? 'Your information' : '01  Explore a sample'}</span><span>{support ? 'Adding a design' : legal ? 'Your choices' : '02  Bring your brand'}</span></div>
        </div></div></div>;
}

/** Photographic sample layouts, never a catalog listing or actual editor/account state. */
export default function MarketplaceArtwork({ kind, priority = false }: { kind: MarketplaceArtworkKind; priority?: boolean }) {
    return <div className={`marketplace-artwork marketplace-artwork-${kind}`} aria-hidden="true" data-illustration="website-design">
        <div className={`theme-scene theme-scene-${kind}`}>
            {kind === 'discover' && <div className="theme-scene-alternate"><BrowserBar /><Storefront fashion /></div>}
            <div className="theme-scene-window"><BrowserBar />
                {kind === 'create' ? <ThemeEditor /> : kind === 'learn' || kind === 'support' || kind === 'legal' ? <DocumentLayout kind={kind} /> : <Storefront priority={priority} />}
            </div>
            {kind === 'library' && <><div className="theme-scene-phone"><div className="theme-scene-phone-notch" /><Storefront /></div><div className="theme-scene-device-note"><Monitor /><span>Review every screen</span></div></>}
            {kind === 'create' && <div className="theme-scene-editor-note"><span>YOUR COLOURS</span><i /><i /><i /></div>}
            <span className="theme-scene-caption">Illustrative sample layout</span>
        </div>
    </div>;
}
