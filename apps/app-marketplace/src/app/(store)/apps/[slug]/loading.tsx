import { MarketplaceSkeleton } from '@/components/MarketplaceSkeleton';

export default function AppDetailLoading() {
    return (
        <main className="appstore-main">
            <MarketplaceSkeleton titleWidth="long" cards={3} />
        </main>
    );
}
