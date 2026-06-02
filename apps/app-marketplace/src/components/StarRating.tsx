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
                <Star key={`full-${i}`} size={size} fill="#F59E0B" stroke="#F59E0B" />
            ))}
            {hasHalf && (
                <Star key="half" size={size} fill="#F59E0B" stroke="#F59E0B" style={{ clipPath: 'inset(0 50% 0 0)' }} />
            )}
            {Array.from({ length: emptyStars }).map((_, i) => (
                <Star key={`empty-${i}`} size={size} fill="none" stroke="#CBD5E1" />
            ))}
            {showValue && (
                <span style={{ marginLeft: 4, fontSize: size - 1 }}>{rating.toFixed(1)}</span>
            )}
        </span>
    );
}
