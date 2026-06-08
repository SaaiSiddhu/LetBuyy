import { MarketplaceSkeleton } from '@/components/MarketplaceSkeleton';

export default function CategoryLoading() {
    return (
        <main className="appstore-main">
            <MarketplaceSkeleton cards={8} />
        </main>
    );
}
