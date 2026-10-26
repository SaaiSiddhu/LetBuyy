import type { ReactNode } from 'react';
import MarketplaceArtwork, { type MarketplaceArtworkKind } from './marketplace-artwork';

export default function MarketplaceTaskTitle({ children, artwork = 'library' }: { children: ReactNode; artwork?: MarketplaceArtworkKind }) {
    return <div className="marketplace-task-title"><h1>{children}</h1><MarketplaceArtwork kind={artwork} /></div>;
}
