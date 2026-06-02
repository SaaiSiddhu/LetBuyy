import { Star } from '@letbuyy/ui';

interface StarRatingProps {
    rating: number;
    size?: number;
    showValue?: boolean;
}

export function StarRating({ rating, size = 14, showValue = true }: StarRatingProps) {
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

    return (
        <span className="star-rating">
            {Array.from({ length: fullStars }).map((_, i) => (
                <Star key={`full-${i}`} className="star-rating__star star-rating__star--filled" size={size} fill="currentColor" stroke="currentColor" />
            ))}
            {hasHalf && (
                <Star key="half" className="star-rating__star star-rating__star--half" size={size} fill="currentColor" stroke="currentColor" />
            )}
            {Array.from({ length: emptyStars }).map((_, i) => (
                <Star key={`empty-${i}`} className="star-rating__star star-rating__star--empty" size={size} fill="none" stroke="currentColor" />
            ))}
            {showValue && (
                <span className="star-rating__value">{rating.toFixed(1)}</span>
            )}
        </span>
    );
}
