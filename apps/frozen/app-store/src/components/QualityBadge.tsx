import Link from 'next/link';
import { ShieldCheck } from '@letbuyy/ui';

interface QualityBadgeProps {
    compact?: boolean;
    href?: string;
    show?: boolean;
}

export function QualityBadge({
    compact = false,
    href = '/developers/review-requirements',
    show = true,
}: QualityBadgeProps) {
    if (!show) return null;

    if (compact) {
        return (
            <span className="quality-badge quality-badge--compact">
                <ShieldCheck size={13} aria-hidden="true" />
                Built for LetBuyy
            </span>
        );
    }

    return (
        <div className="quality-badge quality-badge--detail">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
                <strong>Built for LetBuyy</strong>
                <span>Meets LetBuyy standards for performance, design, and store integration.</span>
                <Link href={href}>Learn more</Link>
            </div>
        </div>
    );
}

