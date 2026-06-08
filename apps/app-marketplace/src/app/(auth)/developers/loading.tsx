import { MarketplaceSkeleton } from '@/components/MarketplaceSkeleton';

export default function DevelopersLoading() {
    return (
        <main className="appstore-main">
            <MarketplaceSkeleton cards={4} />
        </main>
    );
}
