import Image from 'next/image';

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

/** Editorial artwork only: never a listing preview, verification badge or account state. */
export default function MarketplaceArtwork({ kind, priority = false }: { kind: MarketplaceArtworkKind; priority?: boolean }) {
    return <div className={`marketplace-artwork marketplace-artwork-${kind}`} aria-hidden="true">
        <Image src={`/illustrations/${kind}.webp`} alt="" width={960} height={720} sizes="(max-width: 639px) 260px, (max-width: 1023px) 320px, 420px" priority={priority} />
    </div>;
}
