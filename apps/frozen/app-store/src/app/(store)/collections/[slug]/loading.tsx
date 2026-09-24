import { MarketplaceSkeleton } from '@/components/MarketplaceSkeleton';

export default function CollectionLoading() {
    return (
        <main className="appstore-main">
            <MarketplaceSkeleton cards={6} />
        </main>
    );
}
