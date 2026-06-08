import { MarketplaceSkeleton } from '@/components/MarketplaceSkeleton';

export default function SearchLoading() {
    return (
        <main className="appstore-main">
            <MarketplaceSkeleton titleWidth="short" cards={8} />
        </main>
    );
}
