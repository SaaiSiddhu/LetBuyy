import { MarketplaceSkeleton } from '@/components/MarketplaceSkeleton';

export default function CategoriesLoading() {
    return (
        <main className="appstore-main">
            <MarketplaceSkeleton cards={8} />
        </main>
    );
}
