import { Star } from '@letbuyy/ui';

interface StarRatingProps {
    rating: number;
    reviewCount?: number;
    size?: number;
    single?: boolean;
    showValue?: boolean;
}

export function StarRating({ rating, reviewCount, size = 14, single = reviewCount !== undefined, showValue = true }: StarRatingProps) {
    const normalizedRating = Number.isFinite(rating) ? rating : 0;
    const count = Number(reviewCount ?? 0);
    const reviewLabel = `${normalizedRating.toFixed(1)} out of 5 stars${reviewCount !== undefined ? ` (${count.toLocaleString()})` : ''}`;

    if (single) {
        return (
            <span className="star-rating star-rating--single" aria-label={reviewLabel}>
                <Star className="star-rating__star star-rating__star--filled" size={size} fill="currentColor" stroke="currentColor" aria-hidden="true" />
                {showValue ? <span className="star-rating__value">{normalizedRating.toFixed(1)} out of 5 stars</span> : null}
                {reviewCount !== undefined ? (
                    <>
                        <span className="star-rating__count" aria-hidden="true">({count.toLocaleString()})</span>
                        <span className="sr-only">{count.toLocaleString()} total {count === 1 ? 'review' : 'reviews'}</span>
                    </>
                ) : null}
            </span>
        );
    }

    const fullStars = Math.floor(normalizedRating);
    const hasHalf = normalizedRating - fullStars >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

    return (
        <span className="star-rating" aria-label={`${normalizedRating.toFixed(1)} out of 5 stars`}>
            {Array.from({ length: fullStars }).map((_, i) => (
                <Star key={`full-${i}`} className="star-rating__star star-rating__star--filled" size={size} fill="currentColor" stroke="currentColor" aria-hidden="true" />
            ))}
            {hasHalf && (
                <Star key="half" className="star-rating__star star-rating__star--half" size={size} fill="currentColor" stroke="currentColor" aria-hidden="true" />
            )}
            {Array.from({ length: emptyStars }).map((_, i) => (
                <Star key={`empty-${i}`} className="star-rating__star star-rating__star--empty" size={size} fill="none" stroke="currentColor" aria-hidden="true" />
            ))}
            {showValue && (
                <span className="star-rating__value">{normalizedRating.toFixed(1)}</span>
            )}
        </span>
    );
}
