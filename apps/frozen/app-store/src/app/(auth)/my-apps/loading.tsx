import { MarketplaceSkeleton } from '@/components/MarketplaceSkeleton';

export default function MyAppsLoading() {
    return (
        <main className="appstore-main">
            <MarketplaceSkeleton cards={4} />
        </main>
    );
}
