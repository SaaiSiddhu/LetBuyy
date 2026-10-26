import type { ComponentProps } from 'react';
import { PageHeader } from '@letbuyy/ui';
import MarketplaceArtwork, { type MarketplaceArtworkKind } from './marketplace-artwork';

export default function MarketplacePageHeader({ artwork = 'discover', ...props }: ComponentProps<typeof PageHeader> & { artwork?: MarketplaceArtworkKind }) {
    return <div className="marketplace-editorial-masthead"><PageHeader showIcon={false} {...props} /><MarketplaceArtwork kind={artwork} priority /></div>;
}
